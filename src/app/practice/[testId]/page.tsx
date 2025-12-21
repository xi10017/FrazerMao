import { notFound } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest, getTestId } from '@/lib/test-logic';
import type { FamatTest, FamatSolution, AnyFamatTest } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

type Props = {
  params: { testId: string };
};

export default function PracticePage({ params }: Props) {
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

  return <PracticeArena test={test} solution={solution} />;
}

export function generateStaticParams() {
    const tests = famatTests.filter(t => t.document_type === 'Test');
    return tests.map((test) => ({
      testId: getTestId(test),
    }));
}
