import { notFound } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest, getTestId } from '@/lib/test-logic';
import type { FamatTest, AnyFamatTest, UserAnswers } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

type Props = {
  params: { testId: string };
  searchParams: { fromHistory?: string, submission?: string };
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
  
  let initialAnswers: UserAnswers | undefined = undefined;
  if(searchParams.submission) {
    try {
        initialAnswers = JSON.parse(decodeURIComponent(searchParams.submission));
    } catch(e) {
        console.error("Failed to parse submission data from URL");
    }
  }

  return <PracticeArena test={test} solution={solution} initialAnswers={initialAnswers} isReviewFromHistory={!!searchParams.fromHistory} />;
}

export function generateStaticParams() {
    const tests = (famatTests as AnyFamatTest[]).filter(t => t.document_type === 'Test');
    return tests.map((test) => ({
      testId: getTestId(test),
    }));
}
