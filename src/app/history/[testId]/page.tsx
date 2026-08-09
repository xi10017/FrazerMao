'use client';

import { useMemo, useState, useEffect } from 'react';
import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useFirestore } from '@/supabase';
import type { FamatTest, TestSubmission, AnyFamatTest } from '@/lib/types';
import famatTests from '@/data/famat_tests.json';
import {
  getTestId,
  getTestName,
  getDivisionLabel,
  findSolutionForTest,
  buildRetakePracticeUrl,
  resolveRetakeDisplayAnswers,
  resolveSubmissionDisplayScore,
  getEffectiveAnswerKey,
} from '@/lib/test-logic';
import { useAnswerKeyOverridesForTest } from '@/contexts/AnswerKeyOverridesContext';
import { getSubmissionsForTest, readRetakeInProgressForTest, readPracticeInProgressForTest } from '@/lib/user-data';
import { CancelRetakeButton } from '@/components/CancelRetakeButton';
import { CancelPracticeButton } from '@/components/CancelPracticeButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, ChevronLeft, Play, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ShareResultButton } from '@/components/ShareResultButton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Lock } from 'lucide-react';

function HistoryPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRetakeInProgress, setHasRetakeInProgress] = useState(false);
  const [hasPracticeInProgress, setHasPracticeInProgress] = useState(false);
  const [activeRetakeSubmissionId, setActiveRetakeSubmissionId] = useState<
    string | null
  >(null);

  const test = useMemo(() => {
    return (famatTests as AnyFamatTest[])
      .filter((t) => t.document_type === 'Test')
      .map((t) => ({ ...t, id: getTestId(t) }))
      .find((t) => t.id === testId) as FamatTest | undefined;
  }, [testId]);

  const solution = useMemo(
    () => (test ? findSolutionForTest(test) : undefined),
    [test]
  );

  const keyOverrides = useAnswerKeyOverridesForTest(testId);

  const getDisplayScore = (sub: TestSubmission) =>
    resolveSubmissionDisplayScore(
      sub,
      submissions,
      solution?.answers,
      keyOverrides
    );

  useEffect(() => {
    let cancelled = false;
    const fetchSubmissions = async () => {
      if (user && testId && firestore) {
        setIsLoading(true);
        const testSubmissions = await getSubmissionsForTest(
          firestore,
          user.uid,
          testId
        );
        if (cancelled) return;
        setSubmissions(testSubmissions);
        const [retakeInProgress, practiceInProgress] = await Promise.all([
          readRetakeInProgressForTest(firestore, user.uid, testId),
          readPracticeInProgressForTest(firestore, user.uid, testId),
        ]);
        if (cancelled) return;
        setHasRetakeInProgress(retakeInProgress != null);
        setHasPracticeInProgress(practiceInProgress != null);
        setActiveRetakeSubmissionId(
          retakeInProgress?.sourceSubmissionId ?? null
        );
        setIsLoading(false);
      } else if (!isUserLoading) {
        setSubmissions([]);
        setHasRetakeInProgress(false);
        setHasPracticeInProgress(false);
        setActiveRetakeSubmissionId(null);
        setIsLoading(false);
      }
    };
    fetchSubmissions();
    return () => { cancelled = true; };
  }, [user, testId, firestore, isUserLoading]);

  if (isLoading || isUserLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center">
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-3/4 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!test) {
    notFound();
  }

  const handleReview = (submission: TestSubmission) => {
    const effectiveKey = solution
      ? getEffectiveAnswerKey(solution.answers, keyOverrides)
      : [];
    const displayAnswers =
      submission.isRetake && solution
        ? resolveRetakeDisplayAnswers(
            submission,
            submissions,
            effectiveKey
          )
        : submission.answers;
    const submissionData = encodeURIComponent(JSON.stringify(displayAnswers));
    router.push(
      `/practice/${testId}?fromHistory=true&submissionId=${submission.id}&submission=${submissionData}`
    );
  };

  const handleRetake = (submission: TestSubmission) => {
    router.push(buildRetakePracticeUrl(testId, submission));
  };

  const handleContinueRetake = () => {
    router.push(
      buildRetakePracticeUrl(testId, { id: '', answers: {} }, {
        continueSession: true,
      })
    );
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" onClick={() => router.push('/')} className="mb-4">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to Library
      </Button>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-2xl">
            History for: <span className="text-primary">{getDivisionLabel(test.division)}</span>
          </CardTitle>
          <CardDescription>{getTestName(test)}</CardDescription>
          {(hasRetakeInProgress || hasPracticeInProgress) ? (
            <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {hasRetakeInProgress
                      ? 'Retake in progress'
                      : 'Practice in progress'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasRetakeInProgress
                      ? 'Finish or cancel the active retake before starting a new practice or retaking another attempt.'
                      : 'Finish or cancel your current practice before retaking an attempt.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm">
                    <Link
                      href={
                        hasRetakeInProgress
                          ? `/practice/${test.id}?retake=true&continue=true`
                          : `/practice/${test.id}`
                      }
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Continue
                    </Link>
                  </Button>
                  {hasRetakeInProgress ? (
                    <CancelRetakeButton
                      testId={testId}
                      size="sm"
                      label="Cancel"
                      onCancelled={() => {
                        setHasRetakeInProgress(false);
                        setActiveRetakeSubmissionId(null);
                      }}
                    />
                  ) : (
                    <CancelPracticeButton
                      testId={testId}
                      size="sm"
                      label="Cancel"
                      onCancelled={() => setHasPracticeInProgress(false)}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <Button asChild>
                <Link href={`/practice/${test.id}?fresh=true`}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Start New Practice
                </Link>
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Date Taken</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Correct</TableHead>
                  <TableHead className="text-center">Incorrect</TableHead>
                  <TableHead className="text-center">Omitted</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub, index) => {
                  const displayScore = getDisplayScore(sub);
                  const isActiveRetakeRow =
                    hasRetakeInProgress &&
                    (activeRetakeSubmissionId
                      ? sub.id === activeRetakeSubmissionId
                      : index === 0);
                  return (
                  <TableRow
                    key={sub.id}
                    className={
                      isActiveRetakeRow ? 'bg-primary/5' : undefined
                    }
                  >
                    <TableCell className="font-medium">
                      {format(sub.submittedAt, 'PPP p')}
                      {sub.isRetake && (
                        <Badge variant="outline" className="ml-2">
                          Retake
                        </Badge>
                      )}
                      {isActiveRetakeRow && (
                        <Badge className="ml-2">In progress</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-lg font-bold text-primary">
                      {displayScore.totalScore}
                    </TableCell>
                    <TableCell className="text-center font-medium text-green-600 dark:text-green-400">
                      {displayScore.correctCount}
                    </TableCell>
                    <TableCell className="text-center font-medium text-red-600 dark:text-red-400">
                      {displayScore.incorrectCount}
                    </TableCell>
                    <TableCell className="text-center font-medium text-yellow-600 dark:text-yellow-400">
                      {displayScore.omitCount}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ShareResultButton
                          testName={getTestName(test)}
                          totalScore={displayScore.totalScore}
                          correctCount={displayScore.correctCount}
                          incorrectCount={displayScore.incorrectCount}
                          omitCount={displayScore.omitCount}
                          size="sm"
                        />
                        <Button
                          variant="outline"
                          onClick={() => handleReview(sub)}
                        >
                          Review
                        </Button>
                        {hasRetakeInProgress ? (
                          isActiveRetakeRow ? (
                            <>
                              <Button onClick={handleContinueRetake}>
                                <Play className="mr-2 h-4 w-4" />
                                Continue
                              </Button>
                              <CancelRetakeButton
                                testId={testId}
                                size="sm"
                                label="Cancel"
                                onCancelled={() => {
                                  setHasRetakeInProgress(false);
                                  setActiveRetakeSubmissionId(null);
                                }}
                              />
                            </>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0}>
                                    <Button disabled variant="secondary">
                                      <Lock className="mr-2 h-4 w-4" />
                                      Locked
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    Finish or cancel your current retake first.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )
                        ) : hasPracticeInProgress ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button disabled variant="secondary">
                                    <Lock className="mr-2 h-4 w-4" />
                                    Locked
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  Finish your current practice session first.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Button onClick={() => handleRetake(sub)}>
                            Retake <RefreshCw className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 py-20 text-center">
              <h3 className="text-xl font-semibold">No History Found</h3>
              <p className="mt-2 text-muted-foreground">
                You haven't taken this test yet.
              </p>
              <Button asChild className="mt-4">
                <Link href={`/practice/${test.id}`}>
                  Take Test
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HistoryPage;
