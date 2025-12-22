'use client';

import React, { useMemo } from 'react';
import type { FamatTestWithHistory, ReviewData } from '@/lib/types';
import { findSolutionForTest, getTestName } from '@/lib/test-logic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const TOTAL_QUESTIONS = 30;

const createReviewDataFromLastAttempt = (test: FamatTestWithHistory): ReviewData | null => {
    if (test.history.length === 0) return null;
    
    // Assumes history is pre-sorted with the most recent attempt first
    const lastAttempt = test.history[0];
    const solution = findSolutionForTest(test);
    if (!solution) return null;

    const reviewData: ReviewData = {};
    for (let i = 0; i < solution.answers.length; i++) {
        const qNum = i + 1;
        const userAnswer = lastAttempt.answers[qNum];
        const correctAnswer = solution.answers[i];
        let isCorrect = false;

        if (userAnswer) {
            isCorrect = Array.isArray(correctAnswer)
              ? correctAnswer.includes(userAnswer)
              : userAnswer === correctAnswer;
        }

        reviewData[qNum] = {
            userAnswer,
            correctAnswer,
            isCorrect,
        };
    }
    return reviewData;
};

const QuestionSquare: React.FC<{
  qNum: number;
  status: 'correct' | 'incorrect' | 'omitted';
  userAnswer: string | null | undefined;
}> = ({ qNum, status, userAnswer }) => {
    
  const colorClass = useMemo(() => {
    if (status === 'correct') return 'bg-green-500/80 hover:bg-green-500';
    if (status === 'incorrect') return 'bg-red-500/80 hover:bg-red-500';
    return 'bg-yellow-500/80 hover:bg-yellow-500';
  }, [status]);

  const statusText = status.charAt(0).toUpperCase() + status.slice(1);
  const tooltipText = `Q${qNum}: ${statusText}${userAnswer ? ` (You answered: ${userAnswer})` : ''}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('h-5 w-5 rounded-sm', colorClass)} />
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
};


interface ProgressGridProps {
  tests: FamatTestWithHistory[];
}

export const ProgressGrid: React.FC<ProgressGridProps> = ({ tests }) => {
  const testsWithAttempts = useMemo(() => tests.filter(t => t.history.length > 0), [tests]);

  if (testsWithAttempts.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
            <h3 className="text-xl font-semibold">No Progress to Show</h3>
            <p className="mt-2 text-muted-foreground">
              Take a test from the library to see your progress here.
            </p>
        </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {testsWithAttempts.map((test) => {
          const reviewData = createReviewDataFromLastAttempt(test);
          if (!reviewData) return null;

          const lastAttempt = test.history[0];

          return (
            <Link href={`/history/${test.id}`} key={test.id} className="block">
              <Card className="transition-all hover:shadow-lg hover:border-primary">
                <CardHeader>
                  <div className='flex justify-between items-start'>
                    <div>
                        <CardTitle>{test.division}</CardTitle>
                        <CardDescription>{getTestName(test)}</CardDescription>
                    </div>
                    <div className='text-right'>
                        <p className='text-lg font-bold text-primary'>{lastAttempt.score.totalScore}</p>
                        <p className='text-xs text-muted-foreground'>Last Score</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-15 sm:grid-cols-30 gap-1">
                    {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1).map((qNum) => {
                      const result = reviewData[qNum];
                      let status: 'correct' | 'incorrect' | 'omitted' = 'omitted';
                      if (result) {
                        if (result.userAnswer) {
                          status = result.isCorrect ? 'correct' : 'incorrect';
                        }
                      }
                      return <QuestionSquare key={qNum} qNum={qNum} status={status} userAnswer={result?.userAnswer} />;
                    })}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </TooltipProvider>
  );
};
