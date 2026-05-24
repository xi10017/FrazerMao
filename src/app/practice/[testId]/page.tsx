import { notFound } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest, getTestId } from '@/lib/test-logic';
import type { FamatTest, AnyFamatTest, UserAnswers } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

type Props = {
  params: { testId: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function PracticePage({ params, searchParams }: Props) {
  const { testId } = await params;
  const sParams = await searchParams;
  const allTests = famatTests as AnyFamatTest[];

  const test = allTests
    .filter((t) => t.document_type === 'Test')
    .map((t) => ({ ...t, id: getTestId(t) }))
    .find((t) => t.id === testId) as FamatTest | undefined;

  if (!test) {
    notFound();
  }

  const solution = findSolutionForTest(test);

  const fromHistoryParam = sParams?.fromHistory;
  const isReviewFromHistory = fromHistoryParam === 'true';
  const fromRetakeParam = sParams?.retake;
  const isRetakeMode = fromRetakeParam === 'true';
  const continueRetakeParam = sParams?.continue;
  const continueRetake = continueRetakeParam === 'true';
  const freshParam = sParams?.fresh;
  const startFresh = freshParam === 'true';
  const submissionId = sParams?.submissionId as string | undefined;

  let initialAnswers: UserAnswers | undefined = undefined;
  const submissionParam = sParams?.submission;
  if (typeof submissionParam === 'string') {
    try {
      initialAnswers = JSON.parse(decodeURIComponent(submissionParam));
    } catch (e) {
      console.error('Failed to parse submission data from URL');
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
    />
  );
}

export function generateStaticParams() {
  const tests = (famatTests as AnyFamatTest[]).filter(
    (t) => t.document_type === 'Test'
  );
  return tests.map((test) => ({
    testId: getTestId(test),
  }));
}
