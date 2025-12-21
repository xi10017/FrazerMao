'use client';

import React from 'react';
import Link from 'next/link';
import { getTestName } from '@/lib/test-logic';
import type { FamatTestWithHistory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, History, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TestListProps {
  tests: FamatTestWithHistory[];
}

export const TestList: React.FC<TestListProps> = ({ tests }) => {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold tracking-tight">
        Available Tests ({tests.length})
      </h2>
      {tests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tests.map((test) => {
            const hasHistory = test.history && test.history.length > 0;
            const mostRecentScore = hasHistory ? test.history![0].score.totalScore : null;

            return (
              <Card key={test.id} className="flex flex-col justify-between transition-all hover:shadow-lg hover:border-primary">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{test.division}</CardTitle>
                    {hasHistory && mostRecentScore !== null && (
                        <Badge variant="secondary">
                            Last Score: {mostRecentScore}
                        </Badge>
                    )}
                  </div>
                  <CardDescription>{getTestName(test)}</CardDescription>
                </CardHeader>
                <div className="grid grid-cols-2 gap-2 p-6 pt-0">
                  {hasHistory ? (
                    <>
                      <Button asChild variant="outline">
                        <Link href={`/history/${test.id}`}>
                          <History className="mr-2 h-4 w-4" />
                          History
                        </Link>
                      </Button>
                      <Button asChild>
                        <Link href={`/practice/${test.id}`}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Retake
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild className="w-full col-span-2">
                        <Link href={`/practice/${test.id}`}>
                        Start Practice <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
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
