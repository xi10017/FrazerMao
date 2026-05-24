import type { TestSubmission } from './types';

export const DEFAULT_WEEKLY_GOAL = 3;
export const DEFAULT_STREAK_GOAL = 7;

export const MIN_WEEKLY_GOAL = 1;
export const MIN_STREAK_GOAL = 1;

export const ROLLING_AVERAGE_WINDOW = 5;

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return startOfLocalDay(date).toISOString().slice(0, 10);
}

function startOfLocalWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function countTestsThisWeek(submissions: TestSubmission[]): number {
  const weekStart = startOfLocalWeek(new Date()).getTime();
  return submissions.filter((s) => s.submittedAt.getTime() >= weekStart).length;
}

/** Consecutive days with at least one submission, ending today or yesterday. */
export function computePracticeStreak(submissions: TestSubmission[]): number {
  if (submissions.length === 0) return 0;

  const activeDays = new Set(submissions.map((s) => dayKey(s.submittedAt)));

  let cursor = startOfLocalDay(new Date());
  const todayKey = dayKey(cursor);
  if (!activeDays.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Average FAMAT score over the most recent submissions (up to `window` tests). */
export function computeRollingAverage(
  submissions: TestSubmission[],
  window: number = ROLLING_AVERAGE_WINDOW
): { averageScore: number; testCount: number; window: number } | null {
  if (submissions.length === 0) return null;

  const recent = [...submissions]
    .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
    .slice(0, window);

  const totalScore = recent.reduce(
    (sum, sub) => sum + sub.score.totalScore,
    0
  );

  return {
    averageScore: totalScore / recent.length,
    testCount: recent.length,
    window,
  };
}

export function formatTimerRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
