'use client';

import React, { useMemo } from 'react';
import type { FamatTestWithHistory, ReviewData } from '@/lib/types';
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

const TOTAL_QUESTIONS = 30;

type ResultStatus = 'correct' | 'incorrect' | 'omitted' | 'not_taken';

interface CellData {
    status: ResultStatus;
    userAnswer: string | null | undefined;
    correctAnswer: string | string[];
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
            colorClass: 'bg-muted/30',
            text: '',
            tooltipText: 'Not Taken'
        };
    }
    
    let colorClass = '';
    let statusText = '';

    switch(data.status) {
        case 'correct':
            colorClass = 'bg-green-500/70 hover:bg-green-500/90 text-white';
            statusText = 'Correct';
            break;
        case 'incorrect':
            colorClass = 'bg-red-500/70 hover:bg-red-500/90 text-white';
            statusText = 'Incorrect';
            break;
        case 'omitted':
            colorClass = 'bg-yellow-500/70 hover:bg-yellow-500/90 text-black';
            statusText = 'Omitted';
            break;
        default:
            colorClass = 'bg-muted/30';
            statusText = 'Not Taken';
            break;
    }

    const correctAnswerText = Array.isArray(data.correctAnswer) ? data.correctAnswer.join('/') : data.correctAnswer;
    const tooltipText = data.userAnswer 
        ? `${statusText} (You: ${data.userAnswer} | Ans: ${correctAnswerText})`
        : data.status !== 'not_taken' ? `${statusText} (Ans: ${correctAnswerText})` : statusText;

    return { colorClass, text: data.userAnswer || '', tooltipText };
  }

  const { colorClass, text, tooltipText } = getCellInfo();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TableCell className={cn('w-[60px] min-w-[60px] text-center font-bold text-xs p-0', colorClass)}>
            {text}
        </TableCell>
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
  const questionNumbers = useMemo(() => Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1), []);
  
  const gridData = useMemo(() => {
    const data = new Map<string, Map<number, CellData>>();
    tests.forEach(test => {
        const reviewData = createReviewDataFromLastAttempt(test);
        const testMap = new Map<number, CellData>();
        const solution = findSolutionForTest(test);
        
        questionNumbers.forEach(qNum => {
            if (reviewData && reviewData[qNum]) {
                const { userAnswer, correctAnswer, isCorrect } = reviewData[qNum];
                let status: ResultStatus = 'omitted';
                if (userAnswer) {
                    status = isCorrect ? 'correct' : 'incorrect';
                }
                testMap.set(qNum, { status, userAnswer, correctAnswer });
            } else {
                 // Even if test isn't taken, we want to store correct answer for tooltip
                 const correctAnswer = solution?.answers[qNum-1] || 'N/A';
                 testMap.set(qNum, { status: 'not_taken', userAnswer: null, correctAnswer });
            }
        });
        data.set(test.id, testMap);
    });
    return data;
  }, [tests, questionNumbers]);

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
    <TooltipProvider>
      <Card>
        <CardHeader>
            <CardTitle>Progress Grid</CardTitle>
            <CardDescription>Performance on your last attempt for each test. Rows are questions, columns are tests.</CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-x-auto">
          <Table className='border table-fixed'>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background w-10 min-w-10 text-center font-bold border-r p-1 h-auto">Q#</TableHead>
                {tests.map(test => (
                  <TableHead key={test.id} className="w-[60px] min-w-[60px] text-center text-xs p-1 h-auto">
                     <Link href={`/history/${test.id}`} className="hover:underline">
                        <div className='font-bold'>{test.division}</div>
                        <div className='font-normal'>{`${test.year} ${test.month.substring(0,3)}`}</div>
                        <div className='font-normal text-muted-foreground'>{test.test_type.substring(0,4)}</div>
                    </Link>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionNumbers.map(qNum => (
                <TableRow key={qNum} className='h-6'>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium text-center border-r p-1 text-xs">{qNum}</TableCell>
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
    </TooltipProvider>
  );
};
