import LibraryClient from '@/components/pages/library/LibraryClient';
import famatTests from '@/data/famat_tests.json';
import type { FamatTest } from '@/lib/types';

export default function LibraryPage() {
  // We only want to display the tests, not the solutions, in the library.
  const tests = famatTests.tests.filter(
    (t) => t.test_type === 'Test'
  ) as FamatTest[];

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <LibraryClient tests={tests} />
    </div>
  );
}
