import type { SupabaseClient } from '@supabase/supabase-js';

export type AggregateStats = {
  submissionCount: number;
  totalScoreSum: number;
};

/** Only show community average when enough submissions exist. */
export const MIN_AGGREGATE_SAMPLE = 5;

export async function incrementAggregateStats(
  db: SupabaseClient,
  testId: string,
  score: number
): Promise<void> {
  const { data: existing, error: readError } = await db
    .from('aggregate_stats')
    .select('submission_count,total_score_sum')
    .eq('test_id', testId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await db.from('aggregate_stats').upsert({
    test_id: testId,
    submission_count: (existing?.submission_count ?? 0) + 1,
    total_score_sum: (existing?.total_score_sum ?? 0) + score,
  });
  if (error) throw error;
}

export function formatAverageScore(stats: AggregateStats | null): string | null {
  if (!stats || stats.submissionCount === 0) return null;
  const average = stats.totalScoreSum / stats.submissionCount;
  return average.toFixed(1);
}

export function shouldShowAggregate(stats: AggregateStats | null): boolean {
  return !!stats && stats.submissionCount >= MIN_AGGREGATE_SAMPLE;
}
