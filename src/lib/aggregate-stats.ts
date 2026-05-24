'use client';

import {
  doc,
  setDoc,
  increment,
  type Firestore,
} from 'firebase/firestore';

export type AggregateStats = {
  submissionCount: number;
  totalScoreSum: number;
};

/** Only show community average when enough submissions exist. */
export const MIN_AGGREGATE_SAMPLE = 5;

export async function incrementAggregateStats(
  db: Firestore,
  testId: string,
  score: number
): Promise<void> {
  await setDoc(
    doc(db, 'aggregate_stats', testId),
    {
      submissionCount: increment(1),
      totalScoreSum: increment(score),
    },
    { merge: true }
  );
}

export function formatAverageScore(stats: AggregateStats | null): string | null {
  if (!stats || stats.submissionCount === 0) return null;
  const average = stats.totalScoreSum / stats.submissionCount;
  return average.toFixed(1);
}

export function shouldShowAggregate(stats: AggregateStats | null): boolean {
  return !!stats && stats.submissionCount >= MIN_AGGREGATE_SAMPLE;
}
