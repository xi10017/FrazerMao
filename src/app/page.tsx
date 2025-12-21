import LibraryClient from '@/components/pages/library/LibraryClient';
import famatTests from '@/data/famat_tests.json';
import type { FamatTest, AnyFamatTest } from '@/lib/types';
import { getTestId } from '@/lib/test-logic';

export default function LibraryPage() {
  // We only want to display the tests, not the solutions, in the library.
  const tests = (famatTests as AnyFamatTest[])
    .filter((t) => t.document_type === 'Test')
    .map((t) => ({ ...t, id: getTestId(t) })) as FamatTest[];

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <LibraryClient tests={tests} />
    </div>
  );
}
