
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getTestName } from '@/lib/test-logic';
import type { FamatTestWithHistory } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, History, RefreshCw, Play, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TestListProps {
  tests: FamatTestWithHistory[];
  bookmarkedTestIds: string[];
  onToggleBookmark: (testId: string, isBookmarked: boolean) => void;
  isBookmarkSaving?: boolean;
}

export const TestList: React.FC<TestListProps> = ({
  tests,
  bookmarkedTestIds,
  onToggleBookmark,
  isBookmarkSaving = false,
}) => {
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  const displayedTests = showSavedOnly
    ? tests.filter((test) => bookmarkedTestIds.includes(test.id))
    : tests;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">
          {showSavedOnly ? 'Saved Tests' : 'Available Tests'} ({displayedTests.length})
        </h2>
        <Button
          variant={showSavedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowSavedOnly((prev) => !prev)}
        >
          <Star
            className={cn(
              'mr-2 h-4 w-4',
              showSavedOnly && 'fill-current'
            )}
          />
          {showSavedOnly ? 'Show All' : 'Saved Only'}
        </Button>
      </div>
      {displayedTests.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {displayedTests.map((test) => {
            const hasHistory = test.history && test.history.length > 0;
            const mostRecentScore = hasHistory
              ? test.history[0].score.totalScore
              : null;
            const isInProgress = test.inProgress !== undefined;
            const hasRetakeInProgress = test.retakeInProgress !== undefined;
            const isBookmarked = bookmarkedTestIds.includes(test.id);

            return (
              <Card
                key={test.id}
                className="flex flex-col justify-between transition-all hover:shadow-lg hover:border-primary"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{test.division}</CardTitle>
                    <div className="flex items-center gap-2">
                      {hasHistory && mostRecentScore !== null && (
                        <Badge variant="secondary">
                          Last Score: {mostRecentScore}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={isBookmarkSaving}
                        aria-label={
                          isBookmarked ? 'Remove bookmark' : 'Save for later'
                        }
                        onClick={() => onToggleBookmark(test.id, isBookmarked)}
                      >
                        <Star
                          className={cn(
                            'h-4 w-4',
                            isBookmarked && 'fill-yellow-400 text-yellow-400'
                          )}
                        />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>{getTestName(test)}</CardDescription>
                </CardHeader>
                <div className="grid grid-cols-2 gap-2 p-6 pt-0">
                  {hasHistory && (
                    <Button asChild variant="outline">
                      <Link href={`/history/${test.id}`}>
                        <History className="mr-2 h-4 w-4" />
                        History
                      </Link>
                    </Button>
                  )}

                  {hasRetakeInProgress ? (
                    <Button asChild className={!hasHistory ? 'col-span-2' : ''}>
                      <Link href={`/practice/${test.id}?retake=true&continue=true`}>
                        <Play className="mr-2 h-4 w-4" />
                        Continue
                      </Link>
                    </Button>
                  ) : isInProgress ? (
                    <Button asChild className={!hasHistory ? 'col-span-2' : ''}>
                      <Link href={`/practice/${test.id}`}>
                        <Play className="mr-2 h-4 w-4" />
                        Continue
                      </Link>
                    </Button>
                  ) : hasHistory ? (
                    <Button asChild>
                      <Link href={`/practice/${test.id}?fresh=true`}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Take Again
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild className="w-full col-span-2">
                      <Link href={`/practice/${test.id}`}>
                        Start Practice <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
          <h3 className="text-xl font-semibold">
            {showSavedOnly ? 'No Saved Tests' : 'No Tests Found'}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {showSavedOnly
              ? 'Star tests in the library to save them for later.'
              : 'Try adjusting your filters to find more tests.'}
          </p>
        </div>
      )}
    </div>
  );
};
