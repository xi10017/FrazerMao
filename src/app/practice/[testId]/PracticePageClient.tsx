'use client';

import { notFound, useParams, useSearchParams } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest, getTestId } from '@/lib/test-logic';
import type { FamatTest, AnyFamatTest, UserAnswers } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

export default function PracticePageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params.testId as string;
  const allTests = famatTests as AnyFamatTest[];

  const test = allTests
    .filter((t) => t.document_type === 'Test')
    .map((t) => ({ ...t, id: getTestId(t) }))
    .find((t) => t.id === testId) as FamatTest | undefined;

  if (!test) {
    notFound();
  }

  const solution = findSolutionForTest(test);
  const isReviewFromHistory = searchParams.get('fromHistory') === 'true';
  const isRetakeMode = searchParams.get('retake') === 'true';
  const continueRetake = searchParams.get('continue') === 'true';
  const startFresh = searchParams.get('fresh') === 'true';
  const submissionId = searchParams.get('submissionId') ?? undefined;
  const isBrowseMode = searchParams.get('browse') === 'true';
  const returnTo = searchParams.get('returnTo') ?? undefined;

  let initialAnswers: UserAnswers | undefined;
  const submissionParam = searchParams.get('submission');
  if (submissionParam) {
    try {
      initialAnswers = JSON.parse(decodeURIComponent(submissionParam));
    } catch (error) {
      console.error('Failed to parse submission data from URL', error);
    }
  }

  return (
    <PracticeArena
      test={test}
      solution={solution}
      initialAnswers={initialAnswers}
      isReviewFromHistory={isReviewFromHistory}
      isRetakeMode={isRetakeMode}
      continueRetake={continueRetake}
      startFresh={startFresh}
      submissionId={submissionId}
      isBrowseMode={isBrowseMode}
      returnTo={returnTo}
    />
  );
}
