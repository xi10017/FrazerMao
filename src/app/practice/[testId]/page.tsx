import { notFound } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest, getTestId } from '@/lib/test-logic';
import type { FamatTest, AnyFamatTest, UserAnswers } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

type Props = {
  params: { testId: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default function PracticePage({ params, searchParams }: Props) {
  const { testId } = params;
  const allTests = famatTests as AnyFamatTest[];

  const test = allTests
    .filter((t) => t.document_type === 'Test')
    .map((t) => ({ ...t, id: getTestId(t) }))
    .find((t) => t.id === testId) as FamatTest | undefined;

  if (!test) {
    notFound();
  }

  const solution = findSolutionForTest(test);
  
  const fromHistoryParam = searchParams?.fromHistory;
  const isReviewFromHistory = fromHistoryParam === 'true';
  const submissionId = searchParams?.submissionId as string | undefined;

  let initialAnswers: UserAnswers | undefined = undefined;
  const submissionParam = searchParams?.submission;
  if(typeof submissionParam === 'string') {
    try {
        initialAnswers = JSON.parse(decodeURIComponent(submissionParam));
    } catch(e) {
        console.error("Failed to parse submission data from URL");
    }
  }

  return (
    <PracticeArena
      test={test}
      solution={solution}
      initialAnswers={initialAnswers}
      isReviewFromHistory={isReviewFromHistory}
      submissionId={submissionId}
    />
  );
}

export function generateStaticParams() {
    const tests = (famatTests as AnyFamatTest[]).filter(t => t.document_type === 'Test');
    return tests.map((test) => ({
      testId: getTestId(test),
    }));
}
