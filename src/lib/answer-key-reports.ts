'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from '@/supabase';
import type { AnswerKeyReport, AnswerKeyReportStatus } from './types';
import type { AnswerKeyOverrides } from './test-logic';
import { answerKeyValuesEqual } from './test-logic';

export const THROWOUT_ANSWER: string[] = ['A', 'B', 'C', 'D', 'E'];
export const SUPERSEDED_REPORT_NOTE =
  'Auto-closed: another correction was approved for this question.';
export const ANSWER_KEY_ARCHIVE_DAYS = 30;
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
  return Array.isArray(value)
    ? value.length >= 5
      ? 'Throwout'
      : value.join('/')
    : value;
}

export function firestoreOverridesToMap(
  raw: Record<string, string | string[]> | undefined
): AnswerKeyOverrides {
  if (!raw) return {};
  const result: AnswerKeyOverrides = {};
  for (const [key, value] of Object.entries(raw)) {
    const questionNumber = Number(key);
    if (questionNumber >= 1) result[questionNumber] = value;
  }
  return result;
}

function reportId(userId: string, testId: string, questionNumber: number) {
  return `${userId}_${testId}_q${questionNumber}`;
}

function toReport(row: Record<string, any>): AnswerKeyReport {
  return {
    id: row.id,
    testId: row.test_id,
    testName: row.test_name,
    questionNumber: row.question_number,
    currentAnswer: row.current_answer,
    proposedAnswer: row.proposed_answer,
    userAnswer: row.user_answer,
    message: row.message ?? '',
    userId: row.user_id,
    userDisplayName: row.user_display_name,
    status: row.status as AnswerKeyReportStatus,
    createdAt: new Date(row.created_at),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    adminNote: row.admin_note ?? undefined,
  };
}

export function proposedAnswerToFormValue(
  proposed: string | string[]
): string {
  return Array.isArray(proposed)
    ? proposed.length >= 5
      ? 'THROWOUT'
      : proposed.join('/')
    : proposed;
}

export function parseProposedAnswerSelection(
  proposed: string | string[]
): { isThrowout: boolean; letters: string[] } {
  if (Array.isArray(proposed)) {
    if (proposed.length >= 5) return { isThrowout: true, letters: [] };
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
  return sorted.length === 0 ? null : sorted.length === 1 ? sorted[0] : sorted;
}

export async function getUserAnswerKeyReportForQuestion(
  db: SupabaseClient,
  userId: string,
  testId: string,
  questionNumber: number
): Promise<AnswerKeyReport | null> {
  const { data, error } = await db
    .from('answer_key_reports')
    .select('*')
    .eq('id', reportId(userId, testId, questionNumber))
    .maybeSingle();
  if (error) throw error;
  return data ? toReport(data) : null;
}

export async function updatePendingAnswerKeyReport(
  db: SupabaseClient,
  userId: string,
  input: {
    testId: string;
    questionNumber: number;
    currentAnswer: string | string[];
    proposedAnswer: string | string[];
    message: string;
  }
): Promise<void> {
  const message = input.message.trim();
  if (message.length > 500) throw new Error('Message must be 500 characters or fewer.');
  const { data: existing, error: readError } = await db
    .from('answer_key_reports')
    .select('user_id,status')
    .eq('id', reportId(userId, input.testId, input.questionNumber))
    .maybeSingle();
  if (readError) throw readError;
  if (!existing || existing.status !== 'pending' || existing.user_id !== userId) {
    throw new Error('This dispute is no longer pending.');
  }
  const { error } = await db
    .from('answer_key_reports')
    .update({
      current_answer: input.currentAnswer,
      proposed_answer: input.proposedAnswer,
      message,
    })
    .eq('id', reportId(userId, input.testId, input.questionNumber));
  if (error) throw error;
}

export async function cancelPendingAnswerKeyReport(
  db: SupabaseClient,
  userId: string,
  testId: string,
  questionNumber: number
): Promise<void> {
  const { data: existing, error: readError } = await db
    .from('answer_key_reports')
    .select('user_id,status')
    .eq('id', reportId(userId, testId, questionNumber))
    .maybeSingle();
  if (readError) throw readError;
  if (!existing || existing.status !== 'pending' || existing.user_id !== userId) {
    throw new Error('This dispute is no longer pending.');
  }
  const { error } = await db
    .from('answer_key_reports')
    .delete()
    .eq('id', reportId(userId, testId, questionNumber));
  if (error) throw error;
}

export async function submitAnswerKeyReport(
  db: SupabaseClient,
  user: AppUser,
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
  const message = input.message.trim();
  if (message.length > 500) throw new Error('Message must be 500 characters or fewer.');

  const id = reportId(user.uid, input.testId, input.questionNumber);
  const { data: existing, error: existingError } = await db
    .from('answer_key_reports')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === 'pending') throw new DuplicateAnswerKeyReportError();

  const { error } = await db.from('answer_key_reports').upsert({
    id,
    test_id: input.testId,
    test_name: input.testName,
    question_number: input.questionNumber,
    current_answer: input.currentAnswer,
    proposed_answer: input.proposedAnswer,
    user_answer: input.userAnswer ?? null,
    message,
    user_id: user.uid,
    user_display_name: user.displayName || 'Anonymous User',
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return id;
}

export async function getUserPendingReportQuestions(
  db: SupabaseClient,
  userId: string,
  testId: string
): Promise<Set<number>> {
  const { data, error } = await db
    .from('answer_key_reports')
    .select('question_number')
    .eq('user_id', userId)
    .eq('test_id', testId)
    .eq('status', 'pending');
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.question_number));
}

export async function getPendingAnswerKeyReports(
  db: SupabaseClient
): Promise<AnswerKeyReport[]> {
  const { data, error } = await db
    .from('answer_key_reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReport);
}

export async function getArchivedAnswerKeyReports(
  db: SupabaseClient,
  days: number = ANSWER_KEY_ARCHIVE_DAYS
): Promise<AnswerKeyReport[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { data, error } = await db
    .from('answer_key_reports')
    .select('*')
    .in('status', ['approved', 'rejected'])
    .gte('reviewed_at', cutoff.toISOString())
    .order('reviewed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReport);
}

export async function getPendingReportsForQuestion(
  db: SupabaseClient,
  testId: string,
  questionNumber: number
): Promise<AnswerKeyReport[]> {
  const { data, error } = await db
    .from('answer_key_reports')
    .select('*')
    .eq('test_id', testId)
    .eq('question_number', questionNumber)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toReport);
}

export function groupPendingAnswerKeyReports(
  reports: AnswerKeyReport[]
): AnswerKeyReportGroup[] {
  const buckets = new Map<string, AnswerKeyReport[]>();
  for (const report of reports) {
    const key = `${report.testId}_q${report.questionNumber}`;
    buckets.set(key, [...(buckets.get(key) ?? []), report]);
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => {
      const sorted = [...bucket].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      return {
        key,
        testId: sorted[0].testId,
        testName: sorted[0].testName,
        questionNumber: sorted[0].questionNumber,
        reports: sorted,
        hasConflictingProposals:
          new Set(sorted.map((report) => JSON.stringify(report.proposedAnswer))).size > 1,
      };
    })
    .sort((a, b) => b.reports[0].createdAt.getTime() - a.reports[0].createdAt.getTime());
}

export function reportsProposeChange(
  report: AnswerKeyReport,
  effectiveAnswer: string | string[] | null
): boolean {
  return effectiveAnswer == null || !answerKeyValuesEqual(report.proposedAnswer, effectiveAnswer);
}

export async function fetchAnswerKeyOverridesForTest(
  db: SupabaseClient,
  testId: string
): Promise<AnswerKeyOverrides> {
  const { data, error } = await db
    .from('answer_key_overrides')
    .select('question_number,answer')
    .eq('test_id', testId);
  if (error) throw error;
  const result: AnswerKeyOverrides = {};
  for (const row of data ?? []) result[row.question_number] = row.answer;
  return result;
}

export async function fetchAllAnswerKeyOverrides(
  db: SupabaseClient
): Promise<Record<string, AnswerKeyOverrides>> {
  const { data, error } = await db
    .from('answer_key_overrides')
    .select('test_id,question_number,answer');
  if (error) throw error;
  const result: Record<string, AnswerKeyOverrides> = {};
  for (const row of data ?? []) {
    result[row.test_id] ??= {};
    result[row.test_id][row.question_number] = row.answer;
  }
  return result;
}

export async function approveAnswerKeyReport(
  db: SupabaseClient,
  adminUid: string,
  report: AnswerKeyReport
): Promise<{ rejectedIds: string[] }> {
  const { error: overrideError } = await db
    .from('answer_key_overrides')
    .upsert({
      test_id: report.testId,
      question_number: report.questionNumber,
      answer: report.proposedAnswer,
      updated_by: adminUid,
      last_source_report_id: report.id,
    });
  if (overrideError) throw overrideError;

  const { data: siblings, error: siblingsError } = await db
    .from('answer_key_reports')
    .select('id')
    .eq('test_id', report.testId)
    .eq('question_number', report.questionNumber)
    .eq('status', 'pending');
  if (siblingsError) throw siblingsError;

  const rejectedIds = (siblings ?? [])
    .map((row) => row.id)
    .filter((id) => id !== report.id);
  const now = new Date().toISOString();
  const { error: approvedError } = await db
    .from('answer_key_reports')
    .update({ status: 'approved', reviewed_at: now, reviewed_by: adminUid })
    .eq('id', report.id);
  if (approvedError) throw approvedError;

  if (rejectedIds.length) {
    const { error } = await db
      .from('answer_key_reports')
      .update({
        status: 'rejected',
        reviewed_at: now,
        reviewed_by: adminUid,
        admin_note: SUPERSEDED_REPORT_NOTE,
      })
      .in('id', rejectedIds);
    if (error) throw error;
  }
  return { rejectedIds };
}

export async function rejectAnswerKeyReport(
  db: SupabaseClient,
  adminUid: string,
  reportId: string,
  adminNote?: string
): Promise<void> {
  const { error } = await db
    .from('answer_key_reports')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUid,
      admin_note: adminNote?.trim() || null,
    })
    .eq('id', reportId);
  if (error) throw error;
}
