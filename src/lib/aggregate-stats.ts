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

function statsDocId(division?: string): string {
  if (!division || division === 'Overall') return 'overall';
  return division.toLowerCase().replace(/\s+/g, '_');
}

export async function incrementAggregateStats(
  db: Firestore,
  division: string,
  score: number
): Promise<void> {
  const ids = new Set([statsDocId(), statsDocId(division)]);

  await Promise.all(
    [...ids].map((id) =>
      setDoc(
        doc(db, 'aggregate_stats', id),
        {
          submissionCount: increment(1),
          totalScoreSum: increment(score),
        },
        { merge: true }
      )
    )
  );
}

export function formatAverageScore(stats: AggregateStats | null): string | null {
  if (!stats || stats.submissionCount === 0) return null;
  const average = stats.totalScoreSum / stats.submissionCount;
  return average.toFixed(1);
}
