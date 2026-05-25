'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { FamatTestWithHistory, TestSubmission } from '@/lib/types';
import { getTestName, buildRetakePracticeUrl } from '@/lib/test-logic';
import {
  countTestsThisWeek,
  computePracticeStreak,
  computeRollingAverage,
  formatTimerRemaining,
  MIN_WEEKLY_GOAL,
  MIN_STREAK_GOAL,
} from '@/lib/study-stats';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Flame, Play, TrendingUp, CalendarDays, History, Settings2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { CancelRetakeButton } from '@/components/CancelRetakeButton';
import { CancelPracticeButton } from '@/components/CancelPracticeButton';

interface LibraryHomeSectionsProps {
  tests: FamatTestWithHistory[];
  submissions: TestSubmission[];
  weeklyGoal: number;
  streakGoal: number;
  onSaveGoals: (weeklyGoal: number, streakGoal: number) => Promise<void>;
  onRetakeCancelled?: (testId: string) => void;
}

export const LibraryHomeSections: React.FC<LibraryHomeSectionsProps> = ({
  tests,
  submissions,
  weeklyGoal,
  streakGoal,
  onSaveGoals,
  onRetakeCancelled,
}) => {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [draftWeekly, setDraftWeekly] = useState(String(weeklyGoal));
  const [draftStreak, setDraftStreak] = useState(String(streakGoal));
  const [isSavingGoals, setIsSavingGoals] = useState(false);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  const inProgressTests = useMemo(
    () => tests.filter((test) => test.inProgress !== undefined),
    [tests]
  );

  const retakeInProgressTests = useMemo(
    () => tests.filter((test) => test.retakeInProgress !== undefined),
    [tests]
  );

  const recentlyCompleted = useMemo(() => {
    const inProgressIds = new Set([
      ...inProgressTests.map((t) => t.id),
      ...retakeInProgressTests.map((t) => t.id),
    ]);
    const seen = new Set<string>();
    const result: { test: FamatTestWithHistory; submission: TestSubmission }[] =
      [];

    const sorted = [...submissions].sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
    );

    for (const sub of sorted) {
      if (inProgressIds.has(sub.testId) || seen.has(sub.testId)) continue;
      const test = tests.find((t) => t.id === sub.testId);
      if (!test) continue;
      seen.add(sub.testId);
      result.push({ test, submission: sub });
      if (result.length >= 4) break;
    }
    return result;
  }, [submissions, tests, inProgressTests, retakeInProgressTests]);

  const testsThisWeek = useMemo(
    () => countTestsThisWeek(submissions),
    [submissions]
  );
  const streak = useMemo(() => computePracticeStreak(submissions), [submissions]);
  const rollingAverage = useMemo(
    () => computeRollingAverage(submissions),
    [submissions]
  );
  const weeklyProgress = Math.min(100, (testsThisWeek / weeklyGoal) * 100);
  const streakProgress = Math.min(100, (streak / streakGoal) * 100);

  const showContinue =
    inProgressTests.length > 0 ||
    retakeInProgressTests.length > 0 ||
    recentlyCompleted.length > 0;

  const openGoalsDialog = () => {
    setDraftWeekly(String(weeklyGoal));
    setDraftStreak(String(streakGoal));
    setGoalsError(null);
    setGoalsOpen(true);
  };

  const handleSaveGoals = async () => {
    const weekly = parseInt(draftWeekly, 10);
    const streakTarget = parseInt(draftStreak, 10);
    if (
      Number.isNaN(weekly) ||
      Number.isNaN(streakTarget) ||
      weekly < MIN_WEEKLY_GOAL ||
      streakTarget < MIN_STREAK_GOAL
    ) {
      setGoalsError(
        `Enter whole numbers of at least ${MIN_WEEKLY_GOAL} test/week and ${MIN_STREAK_GOAL} streak day.`
      );
      return;
    }

    setGoalsError(null);
    setIsSavingGoals(true);
    try {
      await onSaveGoals(weekly, streakTarget);
      setGoalsOpen(false);
    } finally {
      setIsSavingGoals(false);
    }
  };

  return (
    <div className="mb-6 space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">Your study stats</CardTitle>
          <Dialog open={goalsOpen} onOpenChange={setGoalsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" onClick={openGoalsDialog}>
                <Settings2 className="mr-2 h-4 w-4" />
                Edit goals
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Study goals</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="weekly-goal">Tests per week</Label>
                  <Input
                    id="weekly-goal"
                    type="number"
                    min={MIN_WEEKLY_GOAL}
                    value={draftWeekly}
                    onChange={(e) => setDraftWeekly(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="streak-goal">Day streak target</Label>
                  <Input
                    id="streak-goal"
                    type="number"
                    min={MIN_STREAK_GOAL}
                    value={draftStreak}
                    onChange={(e) => setDraftStreak(e.target.value)}
                  />
                </div>
              </div>
              {goalsError && (
                <p className="text-sm text-destructive">{goalsError}</p>
              )}
              <DialogFooter>
                <Button onClick={handleSaveGoals} disabled={isSavingGoals}>
                  {isSavingGoals ? 'Saving…' : 'Save goals'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                This week
              </div>
              <p className="text-2xl font-bold">
                {testsThisWeek}
                <span className="text-base font-normal text-muted-foreground">
                  {' '}
                  / {weeklyGoal} tests
                </span>
              </p>
              <Progress value={weeklyProgress} className="h-2" />
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Flame className="h-4 w-4 text-orange-500" />
                Streak
              </div>
              <p className="text-2xl font-bold">
                {streak}
                <span className="text-base font-normal text-muted-foreground">
                  {' '}
                  / {streakGoal} days
                </span>
              </p>
              <Progress value={streakProgress} className="h-2" />
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Rolling average
              </div>
              {rollingAverage ? (
                <>
                  <p className="text-2xl font-bold">
                    {rollingAverage.averageScore.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last {rollingAverage.testCount} test
                    {rollingAverage.testCount === 1 ? '' : 's'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete a test to track your average
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showContinue && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Continue where you left off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {inProgressTests.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Practice in progress
                </p>
                <p className="text-xs text-muted-foreground">
                  Syncs to your account when signed in.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {inProgressTests.map((test) => {
                    const answeredCount = Object.keys(
                      test.inProgress ?? {}
                    ).filter((k) => test.inProgress?.[Number(k)] != null).length;
                    return (
                      <div
                        key={test.id}
                        className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium truncate">
                            {getTestName(test)}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{answeredCount}/30 answered</span>
                            {test.timerState && (
                              <span>
                                {formatTimerRemaining(
                                  test.timerState.timeRemaining
                                )}{' '}
                                left
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link href={`/practice/${test.id}`}>
                              <Play className="mr-2 h-4 w-4" />
                              Continue
                            </Link>
                          </Button>
                          <CancelPracticeButton
                            testId={test.id}
                            size="sm"
                            label="Cancel"
                            onCancelled={() => onRetakeCancelled?.(test.id)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {retakeInProgressTests.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Retakes in progress
                </p>
                <p className="text-xs text-muted-foreground">
                  Only one retake per test at a time. Resume from History or here.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {retakeInProgressTests.map((test) => {
                    const answeredCount = Object.keys(
                      test.retakeInProgress ?? {}
                    ).filter(
                      (k) => test.retakeInProgress?.[Number(k)] != null
                    ).length;
                    return (
                      <div
                        key={test.id}
                        className="flex flex-col justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium truncate">
                            {getTestName(test)}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>{answeredCount}/30 answered</span>
                            {test.retakeTimerState && (
                              <span>
                                {formatTimerRemaining(
                                  test.retakeTimerState.timeRemaining
                                )}{' '}
                                left
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button asChild size="sm">
                            <Link
                              href={buildRetakePracticeUrl(
                                test.id,
                                { id: '', answers: {} },
                                { continueSession: true }
                              )}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Continue
                            </Link>
                          </Button>
                          <CancelRetakeButton
                            testId={test.id}
                            size="sm"
                            label="Cancel"
                            onCancelled={() => onRetakeCancelled?.(test.id)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentlyCompleted.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Recently completed
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentlyCompleted.map(({ test, submission }) => (
                    <div
                      key={submission.id}
                      className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium truncate">
                          {getTestName(test)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {submission.isRetake && (
                            <Badge variant="outline">Retake</Badge>
                          )}
                          <Badge variant="secondary">
                            Score: {submission.score.totalScore}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(submission.submittedAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                      >
                        <Link href={`/history/${test.id}`}>
                          <History className="mr-2 h-4 w-4" />
                          History
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
