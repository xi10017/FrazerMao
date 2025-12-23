'use client';

import React, { useMemo } from 'react';
import type { FamatTestWithHistory, ReviewData, MarkedQuestions } from '@/lib/types';
import { findSolutionForTest } from '@/lib/test-logic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Flag } from 'lucide-react';

const TOTAL_QUESTIONS = 30;

type ResultStatus = 'correct' | 'incorrect' | 'omitted' | 'not_taken';

interface CellData {
    status: ResultStatus;
    userAnswer: string | null | undefined;
    correctAnswer: string | string[];
    isMarked: boolean;
}

const createReviewDataFromLastAttempt = (test: FamatTestWithHistory): ReviewData | null => {
    if (test.history.length === 0) return null;
    
    const lastAttempt = test.history[0]; // Assumes history is pre-sorted
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


const ResultCell: React.FC<{ data: CellData | null }> = ({ data }) => {
    
  const getCellInfo = () => {
    if (!data) {
        return {
            colorClass: 'bg-muted/30 border-transparent',
            text: '',
            tooltipText: 'Not Taken',
            isMarked: false,
        };
    }
    
    let colorClass = '';
    let statusText = '';
    let text = data.userAnswer || '';

    switch(data.status) {
        case 'correct':
            colorClass = 'bg-green-500/20 border-green-500/30 text-green-800 dark:text-green-200';
            statusText = 'Correct';
            break;
        case 'incorrect':
            colorClass = 'bg-red-500/20 border-red-500/30 text-red-800 dark:text-red-200';
            statusText = 'Incorrect';
            break;
        case 'omitted':
            colorClass = 'bg-yellow-500/20 border-yellow-500/30 text-yellow-800 dark:text-yellow-200';
            statusText = 'Omitted';
            break;
        default:
            colorClass = 'bg-muted/30 border-transparent';
            statusText = 'Not Taken';
            break;
    }

    const correctAnswerText = Array.isArray(data.correctAnswer) ? data.correctAnswer.join('/') : data.correctAnswer;
    const tooltipText = data.userAnswer 
        ? `${statusText} (You: ${text} | Ans: ${correctAnswerText})`
        : data.status !== 'not_taken' ? `${statusText} (Ans: ${correctAnswerText})` : statusText;

    return { colorClass, text, tooltipText, isMarked: data.isMarked };
  }

  const { colorClass, text, tooltipText, isMarked } = getCellInfo();

  return (
    <TableCell className="h-6 w-14 p-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("relative flex h-full w-full items-center justify-center border text-xs font-bold", colorClass, data?.status === 'not_taken' && 'border-transparent')}>
              {text}
              {isMarked && <Flag className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-primary fill-primary" />}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
            {isMarked && <p className="font-bold text-primary">Marked for Review</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </TableCell>
  );
};


interface ProgressGridProps {
  tests: FamatTestWithHistory[];
}

export const ProgressGrid: React.FC<ProgressGridProps> = ({ tests }) => {
  const questionNumbers = useMemo(() => Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1), []);
  
  const gridData = useMemo(() => {
    const data = new Map<string, Map<number, CellData>>();
    tests.forEach(test => {
        const reviewData = createReviewDataFromLastAttempt(test);
        const testMap = new Map<number, CellData>();
        const solution = findSolutionForTest(test);
        const markedQuestions = test.markedForReview || {};
        
        questionNumbers.forEach(qNum => {
            const isMarked = !!markedQuestions[qNum];
            if (reviewData && reviewData[qNum]) {
                const { userAnswer, correctAnswer, isCorrect } = reviewData[qNum];
                let status: ResultStatus = 'omitted';
                if (userAnswer) {
                    status = isCorrect ? 'correct' : 'incorrect';
                }
                testMap.set(qNum, { status, userAnswer, correctAnswer, isMarked });
            } else {
                 // Even if test isn't taken, we want to store correct answer for tooltip
                 const correctAnswer = solution?.answers[qNum-1] || 'N/A';
                 testMap.set(qNum, { status: 'not_taken', userAnswer: null, correctAnswer, isMarked: false });
            }
        });
        data.set(test.id, testMap);
    });
    return data;
  }, [tests, questionNumbers]);

  const getShortTestType = (testType: string) => {
    if (testType === 'Regional') return 'Reg';
    if (testType === 'Invitational') return 'Inv';
    return testType.substring(0,3);
  }

  if (tests.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
            <h3 className="text-xl font-semibold">No Tests Found</h3>
            <p className="mt-2 text-muted-foreground">
              Try adjusting your filters to see progress.
            </p>
        </div>
    );
  }

  return (
    <Card>
      <CardHeader>
          <CardTitle>Progress Grid</CardTitle>
          <CardDescription>Performance on your last attempt for each test. Rows are questions, columns are tests. A flag indicates a question you've marked for review.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
          <Table className='border-t border-b table-fixed'>
              <TableHeader>
              <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card w-12 min-w-12 text-center font-bold border-r p-1 h-auto">Q#</TableHead>
                  {tests.map(test => {
                    const lastAttempt = test.history?.[0];
                    const score = lastAttempt?.score.totalScore;
                    return (
                      <TableHead key={test.id} className="w-14 min-w-14 text-center text-xs p-1 h-auto">
                          <Link href={`/history/${test.id}`} className="flex flex-col hover:underline">
                            <div className={cn("font-bold text-lg", score ? 'text-primary' : 'text-muted-foreground')}>
                              {score !== undefined ? score : 'N/A'}
                            </div>
                            <div className='font-bold'>{test.division}</div>
                            <div>{test.year}</div>
                            <div>{test.month.substring(0,3)}</div>
                            <div className='text-muted-foreground'>{getShortTestType(test.test_type)}</div>
                          </Link>
                      </TableHead>
                    )
                  })}
              </TableRow>
              </TableHeader>
              <TableBody>
              {questionNumbers.map(qNum => (
                  <TableRow key={qNum} className='h-6'>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium text-center border-r p-1 text-xs">{qNum}</TableCell>
                  {tests.map(test => {
                      const cellData = gridData.get(test.id)?.get(qNum) || null;
                      return <ResultCell key={`${test.id}-${qNum}`} data={cellData} />;
                  })}
                  </TableRow>
              ))}
              </TableBody>
          </Table>
      </CardContent>
    </Card>
  );
};
