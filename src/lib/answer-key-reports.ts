'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  deleteDoc,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { AnswerKeyReport, AnswerKeyReportStatus } from './types';
import type { AnswerKeyOverrides } from './test-logic';
import { answerKeyValuesEqual } from './test-logic';

export const THROWOUT_ANSWER: string[] = ['A', 'B', 'C', 'D', 'E'];

export const SUPERSEDED_REPORT_NOTE =
  'Auto-closed: another correction was approved for this question.';

export const ANSWER_KEY_ARCHIVE_DAYS = 30;

/** Single Firestore doc holding all per-test answer key overrides. */
export const GLOBAL_OVERRIDES_DOC_ID = 'global';

export type AnswerKeyReportGroup = {
  key: string;
  testId: string;
  testName: string;
  questionNumber: number;
  reports: AnswerKeyReport[];
  hasConflictingProposals: boolean;
};

export class DuplicateAnswerKeyReportError extends Error {
  constructor() {
    super('You already have a pending report for this question.');
    this.name = 'DuplicateAnswerKeyReportError';
  }
}

export function formatAnswerKeyValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length >= 5 ? 'Throwout' : value.join('/');
  }
  return value;
}

export function firestoreOverridesToMap(
  raw: Record<string, string | string[]> | undefined
): AnswerKeyOverrides {
  if (!raw) return {};
  const result: AnswerKeyOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    const q = Number(key);
    if (q >= 1) result[q] = value;
  }
  return result;
}

function globalOverridesRef(db: Firestore) {
  return doc(db, 'answer_key_overrides', GLOBAL_OVERRIDES_DOC_ID);
}

function parseByTestField(
  byTest: Record<string, Record<string, string | string[]>> | undefined
): Record<string, AnswerKeyOverrides> {
  if (!byTest) return {};
  const result: Record<string, AnswerKeyOverrides> = {};
  for (const [testId, raw] of Object.entries(byTest)) {
    result[testId] = firestoreOverridesToMap(raw);
  }
  return result;
}

/** Merge legacy per-test override docs into a single map (pre-migration). */
async function fetchLegacyPerTestOverrides(
  db: Firestore
): Promise<Record<string, AnswerKeyOverrides>> {
  const snap = await getDocs(collection(db, 'answer_key_overrides'));
  const result: Record<string, AnswerKeyOverrides> = {};
  snap.forEach((docSnap) => {
    if (docSnap.id === GLOBAL_OVERRIDES_DOC_ID) return;
    const data = docSnap.data();
    const testId = (data.testId as string) || docSnap.id;
    result[testId] = firestoreOverridesToMap(
      data.overrides as Record<string, string | string[]> | undefined
    );
  });
  return result;
}

function reportDocToModel(id: string, data: Record<string, unknown>): AnswerKeyReport {
  return {
    id,
    testId: data.testId as string,
    testName: data.testName as string,
    questionNumber: data.questionNumber as number,
    currentAnswer: data.currentAnswer as string | string[],
    proposedAnswer: data.proposedAnswer as string | string[],
    userAnswer: data.userAnswer as string | null | undefined,
    message: data.message as string,
    userId: data.userId as string,
    userDisplayName: data.userDisplayName as string,
    status: data.status as AnswerKeyReportStatus,
    createdAt: (data.createdAt as Timestamp).toDate(),
    reviewedAt: data.reviewedAt
      ? (data.reviewedAt as Timestamp).toDate()
      : undefined,
    reviewedBy: data.reviewedBy as string | undefined,
    adminNote: data.adminNote as string | undefined,
  };
}

function reportDocId(userId: string, testId: string, questionNumber: number): string {
  return `${userId}_${testId}_q${questionNumber}`;
}

export function proposedAnswerToFormValue(
  proposed: string | string[]
): string {
  if (Array.isArray(proposed)) {
    return proposed.length >= 5 ? 'THROWOUT' : proposed.join('/');
  }
  return proposed;
}

export function parseProposedAnswerSelection(
  proposed: string | string[]
): { isThrowout: boolean; letters: string[] } {
  if (Array.isArray(proposed)) {
    if (proposed.length >= 5) {
      return { isThrowout: true, letters: [] };
    }
    return { isThrowout: false, letters: [...proposed].sort() };
  }
  return { isThrowout: false, letters: [proposed] };
}

export function buildProposedAnswerFromSelection(
  letters: readonly string[],
  isThrowout: boolean
): string | string[] | null {
  if (isThrowout) return THROWOUT_ANSWER;
  const sorted = [...letters].sort();
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  return sorted;
}

export async function getUserAnswerKeyReportForQuestion(
  db: Firestore,
  userId: string,
  testId: string,
  questionNumber: number
): Promise<AnswerKeyReport | null> {
  const ref = doc(db, 'answer_key_reports', reportDocId(userId, testId, questionNumber));
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return reportDocToModel(snap.id, snap.data());
}

export async function updatePendingAnswerKeyReport(
  db: Firestore,
  userId: string,
  input: {
    testId: string;
    questionNumber: number;
    currentAnswer: string | string[];
    proposedAnswer: string | string[];
    message: string;
  }
): Promise<void> {
  const trimmedMessage = input.message.trim();
  if (trimmedMessage.length > 500) {
    throw new Error('Message must be 500 characters or fewer.');
  }

  const ref = doc(
    db,
    'answer_key_reports',
    reportDocId(userId, input.testId, input.questionNumber)
  );
  const existing = await getDoc(ref);
  if (!existing.exists() || existing.data()?.status !== 'pending') {
    throw new Error('This dispute is no longer pending.');
  }
  if (existing.data()?.userId !== userId) {
    throw new Error('Not allowed to edit this report.');
  }

  await updateDoc(ref, {
    currentAnswer: input.currentAnswer,
    proposedAnswer: input.proposedAnswer,
    message: trimmedMessage,
  });
}

export async function cancelPendingAnswerKeyReport(
  db: Firestore,
  userId: string,
  testId: string,
  questionNumber: number
): Promise<void> {
  const ref = doc(
    db,
    'answer_key_reports',
    reportDocId(userId, testId, questionNumber)
  );
  const existing = await getDoc(ref);
  if (!existing.exists() || existing.data()?.status !== 'pending') {
    throw new Error('This dispute is no longer pending.');
  }
  if (existing.data()?.userId !== userId) {
    throw new Error('Not allowed to cancel this report.');
  }

  await deleteDoc(ref);
}

export async function submitAnswerKeyReport(
  db: Firestore,
  user: User,
  input: {
    testId: string;
    testName: string;
    questionNumber: number;
    currentAnswer: string | string[];
    proposedAnswer: string | string[];
    userAnswer?: string | null;
    message: string;
  }
): Promise<string> {
  const trimmedMessage = input.message.trim();
  if (trimmedMessage.length > 500) {
    throw new Error('Message must be 500 characters or fewer.');
  }

  const id = reportDocId(user.uid, input.testId, input.questionNumber);
  const ref = doc(db, 'answer_key_reports', id);
  const existing = await getDoc(ref);
  if (existing.exists() && existing.data()?.status === 'pending') {
    throw new DuplicateAnswerKeyReportError();
  }

  await setDoc(ref, {
    testId: input.testId,
    testName: input.testName,
    questionNumber: input.questionNumber,
    currentAnswer: input.currentAnswer,
    proposedAnswer: input.proposedAnswer,
    userAnswer: input.userAnswer ?? null,
    message: trimmedMessage,
    userId: user.uid,
    userDisplayName: user.displayName || 'Anonymous User',
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  return id;
}

export async function getUserPendingReportQuestions(
  db: Firestore,
  userId: string,
  testId: string
): Promise<Set<number>> {
  try {
    const q = query(
      collection(db, 'answer_key_reports'),
      where('userId', '==', userId),
      where('testId', '==', testId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const result = new Set<number>();
    snap.forEach((docSnap) => {
      const qNum = docSnap.data().questionNumber as number;
      if (qNum) result.add(qNum);
    });
    return result;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied' || code === 'failed-precondition') {
      return new Set();
    }
    throw error;
  }
}

export async function getPendingAnswerKeyReports(
  db: Firestore
): Promise<AnswerKeyReport[]> {
  const q = query(
    collection(db, 'answer_key_reports'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) =>
    reportDocToModel(docSnap.id, docSnap.data())
  );
}

export async function getArchivedAnswerKeyReports(
  db: Firestore,
  days: number = ANSWER_KEY_ARCHIVE_DAYS
): Promise<AnswerKeyReport[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffMs = cutoff.getTime();

  // Uses existing status + createdAt index; reviewedAt filtered client-side.
  const base = collection(db, 'answer_key_reports');
  const [approvedSnap, rejectedSnap] = await Promise.all([
    getDocs(
      query(
        base,
        where('status', '==', 'approved'),
        orderBy('createdAt', 'desc')
      )
    ),
    getDocs(
      query(
        base,
        where('status', '==', 'rejected'),
        orderBy('createdAt', 'desc')
      )
    ),
  ]);

  const merged = [
    ...approvedSnap.docs.map((docSnap) =>
      reportDocToModel(docSnap.id, docSnap.data())
    ),
    ...rejectedSnap.docs.map((docSnap) =>
      reportDocToModel(docSnap.id, docSnap.data())
    ),
  ];

  return merged
    .filter(
      (report) =>
        report.reviewedAt != null && report.reviewedAt.getTime() >= cutoffMs
    )
    .sort(
      (a, b) =>
        (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0)
    );
}

export async function getPendingReportsForQuestion(
  db: Firestore,
  testId: string,
  questionNumber: number
): Promise<AnswerKeyReport[]> {
  const q = query(
    collection(db, 'answer_key_reports'),
    where('testId', '==', testId),
    where('questionNumber', '==', questionNumber),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) =>
    reportDocToModel(docSnap.id, docSnap.data())
  );
}

/** Group pending reports by test + question (newest report first within each group). */
export function groupPendingAnswerKeyReports(
  reports: AnswerKeyReport[]
): AnswerKeyReportGroup[] {
  const byKey = new Map<string, AnswerKeyReport[]>();
  for (const report of reports) {
    const key = `${report.testId}_q${report.questionNumber}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(report);
    else byKey.set(key, [report]);
  }

  const groups: AnswerKeyReportGroup[] = [];
  for (const [key, bucket] of byKey) {
    const sorted = [...bucket].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const proposals = new Set(
      sorted.map((r) => JSON.stringify(r.proposedAnswer))
    );
    groups.push({
      key,
      testId: sorted[0].testId,
      testName: sorted[0].testName,
      questionNumber: sorted[0].questionNumber,
      reports: sorted,
      hasConflictingProposals: proposals.size > 1,
    });
  }

  return groups.sort(
    (a, b) =>
      b.reports[0].createdAt.getTime() - a.reports[0].createdAt.getTime()
  );
}

export function reportsProposeChange(
  report: AnswerKeyReport,
  effectiveAnswer: string | string[] | null
): boolean {
  if (effectiveAnswer == null) return true;
  return !answerKeyValuesEqual(report.proposedAnswer, effectiveAnswer);
}

export async function fetchAnswerKeyOverridesForTest(
  db: Firestore,
  testId: string
): Promise<AnswerKeyOverrides> {
  const all = await fetchAllAnswerKeyOverrides(db);
  return all[testId] ?? {};
}

export async function fetchAllAnswerKeyOverrides(
  db: Firestore
): Promise<Record<string, AnswerKeyOverrides>> {
  try {
    const globalSnap = await getDoc(globalOverridesRef(db));
    if (globalSnap.exists()) {
      return parseByTestField(
        globalSnap.data().byTest as
          | Record<string, Record<string, string | string[]>>
          | undefined
      );
    }

    // Fallback while legacy per-test docs still exist.
    return await fetchLegacyPerTestOverrides(db);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      return {};
    }
    throw error;
  }
}

async function mergeApprovedOverride(
  db: Firestore,
  testId: string,
  questionNumber: number,
  proposedAnswer: string | string[],
  adminUid: string,
  sourceReportId: string
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = globalOverridesRef(db);
    const snap = await transaction.get(ref);
    const byTest: Record<string, Record<string, string | string[]>> = snap.exists()
      ? {
          ...(snap.data().byTest as Record<
            string,
            Record<string, string | string[]>
          >),
        }
      : {};

    const testOverrides = { ...(byTest[testId] ?? {}) };
    testOverrides[String(questionNumber)] = proposedAnswer;
    byTest[testId] = testOverrides;

    transaction.set(
      ref,
      {
        byTest,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
        lastSourceReportId: sourceReportId,
      },
      { merge: true }
    );
  });
}

export async function approveAnswerKeyReport(
  db: Firestore,
  adminUid: string,
  report: AnswerKeyReport
): Promise<{ rejectedIds: string[] }> {
  await mergeApprovedOverride(
    db,
    report.testId,
    report.questionNumber,
    report.proposedAnswer,
    adminUid,
    report.id
  );

  const pendingSiblings = await getPendingReportsForQuestion(
    db,
    report.testId,
    report.questionNumber
  );
  const batch = writeBatch(db);
  const rejectedIds: string[] = [];

  for (const sibling of pendingSiblings) {
    const ref = doc(db, 'answer_key_reports', sibling.id);
    if (sibling.id === report.id) {
      batch.update(ref, {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
      });
    } else {
      rejectedIds.push(sibling.id);
      batch.update(ref, {
        status: 'rejected',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminUid,
        adminNote: SUPERSEDED_REPORT_NOTE,
      });
    }
  }

  if (pendingSiblings.length === 0) {
    await updateDoc(doc(db, 'answer_key_reports', report.id), {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    });
  } else {
    await batch.commit();
  }

  return { rejectedIds };
}

export async function rejectAnswerKeyReport(
  db: Firestore,
  adminUid: string,
  reportId: string,
  adminNote?: string
): Promise<void> {
  await updateDoc(doc(db, 'answer_key_reports', reportId), {
    status: 'rejected',
    reviewedAt: serverTimestamp(),
    reviewedBy: adminUid,
    ...(adminNote?.trim() ? { adminNote: adminNote.trim() } : {}),
  });
}
