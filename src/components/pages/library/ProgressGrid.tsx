
'use client';

import React, { useMemo } from 'react';
import type {
  FamatTestWithHistory,
  ReviewData,
  MarkedQuestions,
  UserAnswers,
  TestSubmission,
} from '@/lib/types';
import {
  findSolutionForTest,
  resolveRetakeDisplayAnswers,
  resolveRetakeDisplayScore,
} from '@/lib/test-logic';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
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
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Flag } from 'lucide-react';

const TOTAL_QUESTIONS = 30;

type ResultStatus =
  | 'correct'
  | 'incorrect'
  | 'omitted'
  | 'in_progress'
  | 'not_taken';

interface CellData {
  status: ResultStatus;
  userAnswer: string | null | undefined;
  correctAnswer: string | string[];
  note: string;
}

const createReviewDataFromAttempt = (
  answers: UserAnswers,
  solution: ReturnType<typeof findSolutionForTest>
): ReviewData | null => {
  if (!solution) return null;
  const reviewData: ReviewData = {};
  for (let i = 0; i < solution.answers.length; i++) {
    const qNum = i + 1;
    const userAnswer = answers[qNum];
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

function getDisplayAttempt(
  submissions: TestSubmission[],
  solution: ReturnType<typeof findSolutionForTest>
): TestSubmission | undefined {
  if (submissions.length === 0 || !solution) return undefined;

  const latest = submissions[0];
  if (!latest.isRetake) return latest;

  const answers = resolveRetakeDisplayAnswers(
    latest,
    submissions,
    solution.answers
  );
  return {
    ...latest,
    answers,
    score: resolveRetakeDisplayScore(latest, submissions, solution.answers),
  };
}

const ResultCell: React.FC<{ data: CellData | null }> = ({ data }) => {
  const getCellInfo = () => {
    if (!data) {
      return {
        colorClass: 'bg-muted/30 border-transparent',
        text: '',
        tooltipText: 'Not Taken',
        note: '',
      };
    }

    let colorClass = '';
    let statusText = '';
    let text = data.userAnswer || '';

    switch (data.status) {
      case 'correct':
        colorClass =
          'bg-green-500/20 border-green-500/30 text-green-800 dark:text-green-200';
        statusText = 'Correct';
        break;
      case 'incorrect':
        colorClass =
          'bg-red-500/20 border-red-500/30 text-red-800 dark:text-red-200';
        statusText = 'Incorrect';
        break;
      case 'omitted':
        colorClass =
          'bg-yellow-500/20 border-yellow-500/30 text-yellow-800 dark:text-yellow-200';
        statusText = 'Omitted';
        break;
      case 'in_progress':
        colorClass = 'bg-blue-500/20 border-blue-500/30';
        statusText = 'In Progress';
        text = '...';
        break;
      default:
        colorClass = 'bg-muted/30 border-transparent';
        statusText = 'Not Taken';
        break;
    }

    const correctAnswerText = Array.isArray(data.correctAnswer)
      ? data.correctAnswer.join('/')
      : data.correctAnswer;

    let tooltipText = '';
    if (data.status === 'correct' || data.status === 'incorrect') {
      tooltipText = `${statusText} (You: ${text} | Ans: ${correctAnswerText})`;
    } else if (data.status === 'omitted') {
      tooltipText = `${statusText} (Ans: ${correctAnswerText})`;
    } else {
      tooltipText = statusText;
    }

    return { colorClass, text, tooltipText, note: data.note };
  };

  const { colorClass, text, tooltipText, note } = getCellInfo();
  const isMarked = note !== undefined;

  return (
    <TableCell className="h-6 w-14 p-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'relative flex h-full w-full items-center justify-center border text-xs font-bold',
                colorClass,
                data?.status === 'not_taken' && 'border-transparent'
              )}
            >
              {text}
              {isMarked && (
                <Flag className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-primary fill-primary" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
            {isMarked && note && (
              <p className="font-bold text-primary max-w-xs">Note: {note}</p>
            )}
             {isMarked && !note && (
              <p className="font-bold text-primary">Marked for Review</p>
            )}
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
  const questionNumbers = useMemo(
    () => Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1),
    []
  );

  const gridData = useMemo(() => {
    const data = new Map<string, Map<number, CellData>>();
    tests.forEach((test) => {
      const solution = findSolutionForTest(test);
      const testMap = new Map<number, CellData>();

      const hasHistory = test.history.length > 0;
      const isInProgress = test.inProgress !== undefined;

      let reviewData: ReviewData | null = null;
      let markedQuestions: MarkedQuestions = {};
      let status: ResultStatus = 'not_taken';

      if (hasHistory) {
        const lastAttempt = getDisplayAttempt(test.history, solution);
        if (lastAttempt) {
          reviewData = createReviewDataFromAttempt(
            lastAttempt.answers,
            solution
          );
        }
        markedQuestions = test.markedForReview || {};
      } else if (isInProgress) {
        status = 'in_progress';
        markedQuestions = test.inProgressFlags || {};
      }

      questionNumbers.forEach((qNum) => {
        const note = markedQuestions[qNum];
        let cellData: Partial<CellData> = { note };
        const correctAnswer = solution?.answers[qNum - 1] || 'N/A';

        if (reviewData && reviewData[qNum]) {
          const { userAnswer, isCorrect } = reviewData[qNum];
          cellData = {
            ...cellData,
            status: userAnswer
              ? isCorrect
                ? 'correct'
                : 'incorrect'
              : 'omitted',
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
          };
        } else {
          cellData = {
            ...cellData,
            status: status,
            userAnswer: null,
            correctAnswer: correctAnswer,
          };
        }
        testMap.set(qNum, cellData as CellData);
      });
      data.set(test.id, testMap);
    });
    return data;
  }, [tests, questionNumbers]);

  const getShortTestType = (testType: string) => {
    if (testType === 'Regional') return 'Reg';
    if (testType === 'Invitational') return 'Inv';
    return testType.substring(0, 3);
  };

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
        <CardDescription>
          Your most recent attempt for each test (retakes include prior
          answers you did not change). In-progress tests are blue. A flag
          indicates a question you&apos;ve marked for review.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="border-t border-b table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card w-12 min-w-12 text-center font-bold border-r p-1 h-auto">
                Q#
              </TableHead>
              {tests.map((test) => {
                const solution = findSolutionForTest(test);
                const displayAttempt = test.history?.length
                  ? getDisplayAttempt(test.history, solution)
                  : undefined;
                const score = displayAttempt?.score.totalScore;
                const isInProgress = test.inProgress !== undefined;
                return (
                  <TableHead
                    key={test.id}
                    className="w-14 min-w-14 text-center text-xs p-1 h-auto"
                  >
                    <Link
                      href={
                        isInProgress
                          ? `/practice/${test.id}`
                          : `/history/${test.id}`
                      }
                      className="flex flex-col hover:underline"
                    >
                      <div
                        className={cn(
                          'font-bold text-lg',
                          score !== undefined
                            ? 'text-primary'
                            : isInProgress
                            ? 'text-blue-500'
                            : 'text-muted-foreground'
                        )}
                      >
                        {score !== undefined
                          ? score
                          : isInProgress
                          ? '...'
                          : 'N/A'}
                      </div>
                      <div className="font-bold">{test.division}</div>
                      <div>{test.year}</div>
                      <div>{test.month ? test.month.substring(0, 3) : ''}</div>
                      <div className="text-muted-foreground">
                        {getShortTestType(test.test_type)}
                      </div>
                    </Link>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {questionNumbers.map((qNum) => (
              <TableRow key={qNum} className="h-6">
                <TableCell className="sticky left-0 z-10 bg-card font-medium text-center border-r p-1 text-xs">
                  {qNum}
                </TableCell>
                {tests.map((test) => {
                  const cellData = gridData.get(test.id)?.get(qNum) || null;
                  return (
                    <ResultCell key={`${test.id}-${qNum}`} data={cellData} />
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
