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
  const allTests = famatTests as AnyFamatTest[];

  const test = allTests.find(
    (t) => 'id' in t && t.id === testId && t.test_type === 'Test'
  ) as FamatTest | undefined;

  if (!test) {
    notFound();
  }

  const solution = findSolutionForTest(test);

  // The 'id' property doesn't exist on the solution object, so we create one.
  const testWithId = { ...test, id: testId };

  return <PracticeArena test={testWithId} solution={solution} />;
}

export function generateStaticParams() {
    const tests = famatTests.filter(t => t.test_type === 'Test');
    return tests.map((test) => ({
      testId: 'id' in test ? test.id : undefined,
    })).filter(p => p.testId);
}
