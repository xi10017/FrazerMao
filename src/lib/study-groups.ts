'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from '@/supabase';
import type { GroupMembership, StudyGroup, GroupMember } from './types';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function toStudyGroup(row: Record<string, any>): StudyGroup {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    memberCount: row.member_count ?? 0,
    createdAt: new Date(row.created_at),
  };
}

async function getUserGroupStats(
  db: SupabaseClient,
  userId: string
): Promise<{ testsCompleted: number; showOnLeaderboard: boolean }> {
  const [{ count, error: submissionsError }, { data: profile, error: profileError }] =
    await Promise.all([
      db
        .from('test_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      db
        .from('profiles')
        .select('show_on_leaderboard')
        .eq('id', userId)
        .maybeSingle(),
    ]);
  if (submissionsError) throw submissionsError;
  if (profileError) throw profileError;
  return {
    testsCompleted: count ?? 0,
    showOnLeaderboard: profile?.show_on_leaderboard ?? true,
  };
}

function buildMemberData(
  user: AppUser,
  stats: { testsCompleted: number; showOnLeaderboard: boolean }
) {
  return {
    user_id: user.uid,
    display_name: user.displayName || 'Anonymous User',
    photo_url: user.photoURL,
    tests_completed: stats.testsCompleted,
    show_on_leaderboard: stats.showOnLeaderboard,
  };
}

export async function createStudyGroup(
  db: SupabaseClient,
  user: AppUser,
  name: string
): Promise<StudyGroup> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Group name is required');

  const { data: group, error: groupError } = await db
    .from('study_groups')
    .insert({
      name: trimmed,
      invite_code: generateInviteCode(),
      created_by: user.uid,
      member_count: 1,
    })
    .select()
    .single();
  if (groupError) throw groupError;

  const stats = await getUserGroupStats(db, user.uid);
  const { error: memberError } = await db
    .from('study_group_members')
    .insert({ group_id: group.id, ...buildMemberData(user, stats) });
  if (memberError) throw memberError;

  const { error: membershipError } = await db
    .from('group_memberships')
    .insert({
      user_id: user.uid,
      group_id: group.id,
      group_name: trimmed,
      invite_code: group.invite_code,
    });
  if (membershipError) throw membershipError;

  return toStudyGroup(group);
}

export async function joinStudyGroup(
  db: SupabaseClient,
  user: AppUser,
  inviteCode: string
): Promise<StudyGroup> {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) throw new Error('Invite code is required');

  const { data: group, error: groupError } = await db
    .from('study_groups')
    .select('*')
    .eq('invite_code', normalized)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error('Invalid invite code');

  const stats = await getUserGroupStats(db, user.uid);
  const { error: memberError } = await db
    .from('study_group_members')
    .upsert({ group_id: group.id, ...buildMemberData(user, stats) });
  if (memberError) throw memberError;

  const { error: membershipError } = await db
    .from('group_memberships')
    .upsert({
      user_id: user.uid,
      group_id: group.id,
      group_name: group.name,
      invite_code: group.invite_code,
    });
  if (membershipError) throw membershipError;

  return toStudyGroup(group);
}

export async function updateGroupMemberStats(
  db: SupabaseClient,
  user: AppUser,
  testsCompleted: number,
  showOnLeaderboard: boolean
): Promise<void> {
  const { data: memberships, error: membershipsError } = await db
    .from('group_memberships')
    .select('group_id')
    .eq('user_id', user.uid);
  if (membershipsError) throw membershipsError;
  if (!memberships?.length) return;

  const rows = memberships.map((membership) => ({
    group_id: membership.group_id,
    ...buildMemberData(user, { testsCompleted, showOnLeaderboard }),
  }));
  const { error } = await db
    .from('study_group_members')
    .upsert(rows);
  if (error) throw error;
}

export async function syncUserGroupMemberStats(
  db: SupabaseClient,
  user: AppUser
): Promise<void> {
  const stats = await getUserGroupStats(db, user.uid);
  await updateGroupMemberStats(
    db,
    user,
    stats.testsCompleted,
    stats.showOnLeaderboard
  );
}

export async function leaveStudyGroup(
  db: SupabaseClient,
  user: AppUser,
  groupId: string
): Promise<void> {
  const { error: memberError } = await db
    .from('study_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.uid);
  if (memberError) throw memberError;

  const { error: membershipError } = await db
    .from('group_memberships')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.uid);
  if (membershipError) throw membershipError;

  const { data: members, error: membersError } = await db
    .from('study_group_members')
    .select('user_id')
    .eq('group_id', groupId);
  if (membersError) throw membersError;

  if (!members?.length) {
    const { error } = await db.from('study_groups').delete().eq('id', groupId);
    if (error) throw error;
  } else {
    const { error } = await db
      .from('study_groups')
      .update({ member_count: members.length })
      .eq('id', groupId);
    if (error) throw error;
  }
}

export async function deleteStudyGroup(
  db: SupabaseClient,
  user: AppUser,
  groupId: string
): Promise<void> {
  const { data: group, error: groupError } = await db
    .from('study_groups')
    .select('created_by')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error('Group not found');
  if (group.created_by !== user.uid) {
    throw new Error('Only the group creator can delete this group');
  }

  const { error } = await db.from('study_groups').delete().eq('id', groupId);
  if (error) throw error;
}

export async function removeUserFromAllGroups(
  db: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: memberships, error: membershipsError } = await db
    .from('group_memberships')
    .select('group_id')
    .eq('user_id', userId);
  if (membershipsError) throw membershipsError;
  if (!memberships?.length) return;

  const groupIds = memberships.map((membership) => membership.group_id);
  const { error: membersError } = await db
    .from('study_group_members')
    .delete()
    .eq('user_id', userId)
    .in('group_id', groupIds);
  if (membersError) throw membersError;
  const { error: membershipError } = await db
    .from('group_memberships')
    .delete()
    .eq('user_id', userId);
  if (membershipError) throw membershipError;
}

export function buildShareText(testName: string | undefined, totalScore: number): string {
  const base = `I scored ${totalScore}/150`;
  if (testName) return `${base} on ${testName} using ΜΑΘPractice!`;
  return `${base} on ΜΑΘPractice!`;
}
