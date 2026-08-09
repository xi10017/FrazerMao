import { Suspense } from 'react';
import famatTests from '@/data/famat_tests.json';
import { getTestId } from '@/lib/test-logic';
import type { AnyFamatTest } from '@/lib/types';
import PracticePageClient from './PracticePageClient';

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <PracticePageClient />
    </Suspense>
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
