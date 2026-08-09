import famatTests from '@/data/famat_tests.json';
import { getTestId } from '@/lib/test-logic';
import type { AnyFamatTest } from '@/lib/types';
import HistoryPageClient from './HistoryPageClient';

export default function HistoryPage() {
  return <HistoryPageClient />;
}

export function generateStaticParams() {
  const tests = (famatTests as AnyFamatTest[]).filter(
    (t) => t.document_type === 'Test'
  );
  return tests.map((test) => ({
    testId: getTestId(test),
  }));
}
