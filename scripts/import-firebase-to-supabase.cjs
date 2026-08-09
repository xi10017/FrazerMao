#!/usr/bin/env node

const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const [authExportPath, firestoreExportPath, applyFlag] = process.argv.slice(2);
const APPLY = applyFlag === '--apply';

if (!authExportPath || !firestoreExportPath) {
  console.error('Usage: node scripts/import-firebase-to-supabase.cjs <firebase-auth.json> <firestore.json> [--apply]');
  process.exit(1);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

const env = {
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...loadEnvFile('.env.migration.local'),
  ...process.env,
};

const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const authExport = JSON.parse(fs.readFileSync(authExportPath, 'utf8'));
const firestoreExport = JSON.parse(fs.readFileSync(firestoreExportPath, 'utf8'));

function decodeValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('bytesValue' in value) return value.bytesValue;
  if ('referenceValue' in value) return value.referenceValue;
  if ('geoPointValue' in value) return value.geoPointValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return Object.fromEntries(
    Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decodeValue(child)]),
  );
  return value;
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, decodeValue(value)]));
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toISOString();
  return null;
}

function uuidFromName(name) {
  const namespace = Buffer.from('6ba7b8109dad11d180b400c04fd430c8', 'hex');
  const hash = crypto.createHash('sha1').update(namespace).update(name).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function chunk(items, size = 100) {
  const result = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function row(path) {
  const document = firestoreExport.documents.find((entry) => entry.path === path);
  return document ? decodeFields(document.document.fields) : null;
}

const entries = firestoreExport.documents.map((entry) => ({
  path: entry.path,
  parts: entry.path.split('/'),
  data: decodeFields(entry.document.fields),
}));

const byPath = new Map(entries.map((entry) => [entry.path, entry]));
const authUsers = authExport.users || [];

function firebaseUserIdForEntry(entry) {
  return entry.parts[0] === 'users' ? entry.parts[1] : null;
}

function firebaseUserIdFromData(data) {
  return data.firebaseUid || data.firebase_uid || data.uid || data.userId || data.user_id || null;
}

async function listSupabaseUsers(client) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data.users || []));
    if (!data.users || data.users.length < 1000) break;
    page += 1;
  }
  return users;
}

async function ensureUserMap(client) {
  const supabaseUsers = APPLY ? await listSupabaseUsers(client) : [];
  const byEmail = new Map(
    supabaseUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user]),
  );
  const firebaseToSupabase = new Map();
  let existing = 0;
  let created = 0;
  let missing = 0;

  for (const firebaseUser of authUsers) {
    const email = firebaseUser.email?.toLowerCase();
    if (!email) continue;

    let supabaseUser = byEmail.get(email);
    if (!supabaseUser && APPLY) {
      const { data, error } = await client.auth.admin.createUser({
        email: firebaseUser.email,
        email_confirm: Boolean(firebaseUser.emailVerified),
        user_metadata: {
          full_name: firebaseUser.displayName || null,
          avatar_url: firebaseUser.photoUrl || null,
          firebase_uid: firebaseUser.localId,
        },
        app_metadata: {
          firebase_uid: firebaseUser.localId,
          providers: ['google'],
        },
      });
      if (error) throw error;
      supabaseUser = data.user;
      byEmail.set(email, supabaseUser);
      created += 1;
    } else if (supabaseUser) {
      existing += 1;
    } else {
      missing += 1;
    }

    if (supabaseUser) firebaseToSupabase.set(firebaseUser.localId, supabaseUser.id);
  }

  return { firebaseToSupabase, existing, created, missing };
}

function mappedUserId(firebaseToSupabase, dataOrUid) {
  const firebaseUid = typeof dataOrUid === 'string' ? dataOrUid : firebaseUserIdFromData(dataOrUid);
  return firebaseUid ? firebaseToSupabase.get(firebaseUid) || null : null;
}

function profileRows(firebaseToSupabase) {
  return entries
    .filter((entry) => entry.parts.length === 2 && entry.parts[0] === 'users')
    .map((entry) => {
      const userId = mappedUserId(firebaseToSupabase, entry.parts[1]);
      if (!userId) return null;
      const data = entry.data;
      return {
        id: userId,
        firebase_uid: entry.parts[1],
        display_name: data.displayName || 'Anonymous User',
        email: data.email || null,
        photo_url: data.photoURL || null,
        show_on_leaderboard: data.showOnLeaderboard !== false,
        bookmarked_test_ids: data.bookmarkedTestIds || [],
        weekly_test_goal: data.weeklyTestGoal ?? null,
        streak_goal: data.streakGoal ?? null,
      };
    })
    .filter(Boolean);
}

function submissionRows(firebaseToSupabase) {
  const rows = entries
    .filter((entry) => entry.parts.length === 4 && entry.parts[0] === 'users' && entry.parts[2] === 'testCompletions')
    .map((entry) => {
      const firebaseUid = entry.parts[1];
      const userId = mappedUserId(firebaseToSupabase, firebaseUid);
      if (!userId) return null;
      const data = entry.data;
      const sourceId = data.retakeSourceSubmissionId || data.sourceSubmissionId;
      const sourcePath = sourceId ? `users/${firebaseUid}/testCompletions/${sourceId}` : null;
      return {
        id: uuidFromName(entry.path),
        user_id: userId,
        firebase_id: entry.parts[3],
        test_id: data.testId || entry.parts[3],
        answers: data.answers || {},
        score: data.score || {},
        submitted_at: toIso(data.submittedAt) || new Date(0).toISOString(),
        division: data.division || 'Unknown',
        test_name: data.testName || data.testId || 'Unknown Test',
        completion_date: toIso(data.completionDate) || toIso(data.submittedAt) || new Date(0).toISOString(),
        is_retake: data.isRetake === true,
        retake_source_submission_id: sourcePath ? uuidFromName(sourcePath) : null,
        marked_questions: data.markedQuestions || data.marked_questions || {},
      };
    })
    .filter(Boolean);

  const knownIds = new Set(rows.map((submission) => submission.id));
  for (const submission of rows) {
    if (submission.retake_source_submission_id && !knownIds.has(submission.retake_source_submission_id)) {
      submission.retake_source_submission_id = null;
    }
  }

  // Retake submissions reference their original submission. Insert each source
  // first so Postgres can satisfy the self-referencing foreign key.
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(rows.map((submission) => [submission.id, submission]));
  function visit(submission) {
    if (visited.has(submission.id)) return;
    if (visiting.has(submission.id)) throw new Error(`Circular retake reference at ${submission.id}`);
    visiting.add(submission.id);
    if (submission.retake_source_submission_id) {
      visit(byId.get(submission.retake_source_submission_id));
    }
    visiting.delete(submission.id);
    visited.add(submission.id);
    ordered.push(submission);
  }
  for (const submission of rows) visit(submission);
  return ordered;
}

function progressRows(firebaseToSupabase, collectionName) {
  return entries
    .filter((entry) => entry.parts.length === 4 && entry.parts[0] === 'users' && entry.parts[2] === collectionName)
    .map((entry) => {
      const userId = mappedUserId(firebaseToSupabase, entry.parts[1]);
      if (!userId) return null;
      const data = entry.data;
      const { updatedAt, ...state } = data;
      return {
        user_id: userId,
        test_id: entry.parts[3],
        state,
        updated_at: toIso(updatedAt) || new Date(0).toISOString(),
      };
    })
    .filter(Boolean);
}

function groupId(firebaseGroupId) {
  return uuidFromName(`study_groups/${firebaseGroupId}`);
}

function groupRows(firebaseToSupabase) {
  return entries
    .filter((entry) => entry.parts.length === 2 && entry.parts[0] === 'study_groups')
    .map((entry) => {
      const data = entry.data;
      const createdBy = mappedUserId(firebaseToSupabase, data.createdBy || data.created_by);
      if (!createdBy) return null;
      return {
        id: groupId(entry.parts[1]),
        name: data.name || 'Study Group',
        invite_code: data.inviteCode || data.invite_code || entry.parts[1],
        created_by: createdBy,
        member_count: Number(data.memberCount || data.member_count || 0),
        created_at: toIso(data.createdAt) || new Date(0).toISOString(),
        updated_at: toIso(data.updatedAt) || new Date(0).toISOString(),
      };
    })
    .filter(Boolean);
}

function groupMemberRows(firebaseToSupabase) {
  return entries
    .filter((entry) => entry.parts.length === 4 && entry.parts[0] === 'study_groups' && entry.parts[2] === 'members')
    .map((entry) => {
      const data = entry.data;
      const userId = mappedUserId(firebaseToSupabase, entry.parts[3]);
      if (!userId) return null;
      return {
        group_id: groupId(entry.parts[1]),
        user_id: userId,
        display_name: data.displayName || 'Anonymous User',
        photo_url: data.photoURL || null,
        tests_completed: Number(data.testsCompleted || 0),
        show_on_leaderboard: data.showOnLeaderboard !== false,
        joined_at: toIso(data.joinedAt) || new Date(0).toISOString(),
      };
    })
    .filter(Boolean);
}

function membershipRows(firebaseToSupabase) {
  return entries
    .filter((entry) => entry.parts.length === 4 && entry.parts[0] === 'users' && entry.parts[2] === 'groupMemberships')
    .map((entry) => {
      const userId = mappedUserId(firebaseToSupabase, entry.parts[1]);
      if (!userId) return null;
      const data = entry.data;
      return {
        user_id: userId,
        group_id: groupId(entry.parts[3]),
        group_name: data.groupName || data.group_name || 'Study Group',
        invite_code: data.inviteCode || data.invite_code || '',
        joined_at: toIso(data.joinedAt) || new Date(0).toISOString(),
      };
    })
    .filter(Boolean);
}

function aggregateRows() {
  return entries
    .filter((entry) => entry.parts.length === 2 && entry.parts[0] === 'aggregate_stats')
    .map((entry) => ({
      test_id: entry.parts[1],
      submission_count: Number(entry.data.submissionCount || 0),
      total_score_sum: Number(entry.data.totalScoreSum || 0),
      updated_at: toIso(entry.data.updatedAt) || new Date(0).toISOString(),
    }));
}

function leaderboardRows(firebaseToSupabase, division) {
  return entries
    .filter((entry) => entry.parts.length === 2 && entry.parts[0] === division)
    .map((entry) => {
      const data = entry.data;
      const userId = mappedUserId(firebaseToSupabase, data.userId || entry.parts[1]);
      if (!userId) return null;
      const base = {
        user_id: userId,
        division: data.division || (division === 'leaderboard_overall' ? 'Overall' : 'Unknown'),
        tests_completed: Number(data.testsCompleted || 0),
        display_name: data.displayName || 'Anonymous User',
        photo_url: data.photoURL || null,
        show_on_leaderboard: data.showOnLeaderboard !== false,
        updated_at: toIso(data.updatedAt) || new Date(0).toISOString(),
      };
      return division === 'leaderboard_overall' ? base : base;
    })
    .filter(Boolean);
}

function overrideRows(firebaseToSupabase) {
  const entry = byPath.get('answer_key_overrides/global');
  if (!entry) return [];
  const byTest = entry.data.byTest || {};
  const updatedBy = mappedUserId(firebaseToSupabase, entry.data.updatedBy || entry.data.updated_by);
  const sourceReportId = entry.data.lastSourceReportId || entry.data.last_source_report_id || null;
  const hasSourceReport = sourceReportId && entries.some(
    (candidate) => candidate.parts[0] === 'answer_key_reports' && candidate.parts[1] === sourceReportId,
  );
  const rows = [];
  for (const [testId, questions] of Object.entries(byTest)) {
    for (const [questionNumber, answer] of Object.entries(questions || {})) {
      rows.push({
        test_id: testId,
        question_number: Number(questionNumber),
        answer,
        updated_at: toIso(entry.data.updatedAt) || new Date(0).toISOString(),
        updated_by: updatedBy,
        last_source_report_id: hasSourceReport ? sourceReportId : null,
      });
    }
  }
  return rows;
}

function adminRows(firebaseToSupabase) {
  return entries
    .filter((entry) => entry.parts.length === 2 && entry.parts[0] === 'admins')
    .map((entry) => {
      const userId = mappedUserId(firebaseToSupabase, entry.parts[1]);
      return userId ? { user_id: userId } : null;
    })
    .filter(Boolean);
}

async function upsert(client, table, rows, onConflict) {
  for (const batch of chunk(rows)) {
    if (!batch.length) continue;
    const { error } = await client.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function main() {
  if (!APPLY) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      firebaseAccounts: authUsers.length,
      firestoreDocuments: entries.length,
      profiles: entries.filter((entry) => entry.parts.length === 2 && entry.parts[0] === 'users').length,
      submissions: entries.filter((entry) => entry.parts[2] === 'testCompletions').length,
      inProgress: entries.filter((entry) => entry.parts[2] === 'inProgress').length,
      retakeInProgress: entries.filter((entry) => entry.parts[2] === 'retakeInProgress').length,
      note: 'No Supabase writes performed. Add SUPABASE_SERVICE_ROLE_KEY to .env.migration.local and rerun with --apply.',
    }, null, 2));
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Apply mode requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.migration.local.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const mapping = await ensureUserMap(client);
  const tables = {
    profiles: profileRows(mapping.firebaseToSupabase),
    test_submissions: submissionRows(mapping.firebaseToSupabase),
    in_progress: progressRows(mapping.firebaseToSupabase, 'inProgress'),
    retake_in_progress: progressRows(mapping.firebaseToSupabase, 'retakeInProgress'),
    study_groups: groupRows(mapping.firebaseToSupabase),
    study_group_members: groupMemberRows(mapping.firebaseToSupabase),
    group_memberships: membershipRows(mapping.firebaseToSupabase),
    leaderboard_overall: leaderboardRows(mapping.firebaseToSupabase, 'leaderboard_overall'),
    leaderboard_by_division: leaderboardRows(mapping.firebaseToSupabase, 'leaderboard_by_division'),
    aggregate_stats: aggregateRows(),
    answer_key_overrides: overrideRows(mapping.firebaseToSupabase),
    admins: adminRows(mapping.firebaseToSupabase),
  };

  await upsert(client, 'profiles', tables.profiles, 'id');
  await upsert(client, 'test_submissions', tables.test_submissions, 'id');
  await upsert(client, 'in_progress', tables.in_progress, 'user_id,test_id');
  await upsert(client, 'retake_in_progress', tables.retake_in_progress, 'user_id,test_id');
  await upsert(client, 'study_groups', tables.study_groups, 'id');
  await upsert(client, 'study_group_members', tables.study_group_members, 'group_id,user_id');
  await upsert(client, 'group_memberships', tables.group_memberships, 'user_id,group_id');
  await upsert(client, 'leaderboard_overall', tables.leaderboard_overall, 'user_id');
  await upsert(client, 'leaderboard_by_division', tables.leaderboard_by_division, 'user_id,division');
  await upsert(client, 'aggregate_stats', tables.aggregate_stats, 'test_id');
  await upsert(client, 'answer_key_overrides', tables.answer_key_overrides, 'test_id,question_number');
  await upsert(client, 'admins', tables.admins, 'user_id');

  console.log(JSON.stringify({ mode: 'applied', userMapping: mapping, imported: Object.fromEntries(Object.entries(tables).map(([key, value]) => [key, value.length])) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
