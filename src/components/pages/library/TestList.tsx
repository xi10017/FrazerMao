'use client';

import React from 'react';
import Link from 'next/link';
import { getTestName } from '@/lib/test-logic';
import type { FamatTest } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface TestListProps {
  tests: FamatTest[];
}

export const TestList: React.FC<TestListProps> = ({ tests }) => {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold tracking-tight">
        Available Tests ({tests.length})
      </h2>
      {tests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => (
            <Card key={test.id} className="flex flex-col justify-between transition-all hover:shadow-lg hover:border-primary">
              <CardHeader>
                <CardTitle>{test.division}</CardTitle>
                <CardDescription>{getTestName(test)}</CardDescription>
              </CardHeader>
              <div className="p-6 pt-0">
                <Button asChild className="w-full">
                  <Link href={`/practice/${test.id}`}>
                    Start Practice <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
            <h3 className="text-xl font-semibold">No Tests Found</h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters to find more tests.
            </p>
        </div>
      )}
    </div>
  );
};
