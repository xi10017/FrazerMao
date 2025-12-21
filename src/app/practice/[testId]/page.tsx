import { notFound } from 'next/navigation';
import famatTests from '@/data/famat_tests.json';
import { findSolutionForTest } from '@/lib/test-logic';
import type { FamatTest, FamatSolution, AnyFamatTest } from '@/lib/types';
import PracticeArena from '@/components/pages/practice/PracticeArena';

type Props = {
  params: { testId: string };
};

export default function PracticePage({ params }: Props) {
  const { testId } = params;
  const allTests = famatTests.tests as AnyFamatTest[];

  const test = allTests.find(
    (t) => t.id === testId && t.test_type === 'Test'
  ) as FamatTest | undefined;

  if (!test) {
    notFound();
  }

  const solution = findSolutionForTest(test);

  return <PracticeArena test={test} solution={solution} />;
}

export function generateStaticParams() {
    const tests = famatTests.tests.filter(t => t.test_type === 'Test');
    return tests.map((test) => ({
      testId: test.id,
    }));
}
