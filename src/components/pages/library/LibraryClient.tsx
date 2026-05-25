
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type {
  FamatTest,
  FamatTestWithHistory,
  TestSubmission,
  MarkedQuestions,
  UserAnswers,
  InProgressTestState,
} from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import {
  getSubmissionsForUser,
  getReviewMarks,
  getAllCloudInProgress,
  getAllCloudRetakeInProgress,
  getLocalInProgressBundle,
  getLocalInProgressTestIds,
  getLocalRetakeInProgressBundle,
  getLocalRetakeInProgressTestIds,
  pickNewerInProgress,
  persistInProgressLocally,
  persistRetakeInProgressLocally,
  saveCloudInProgress,
  saveCloudRetakeInProgress,
  toggleBookmark,
} from '@/lib/user-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressGrid } from './ProgressGrid';
import { Leaderboard } from './Leaderboard';
import { LandingPage } from '@/components/pages/landing/LandingPage';
import { LibraryHomeSections } from './LibraryHomeSections';
import { doc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_WEEKLY_GOAL,
  DEFAULT_STREAK_GOAL,
} from '@/lib/study-stats';

interface LibraryClientProps {
  tests: FamatTest[];
}

const LibraryClient: React.FC<LibraryClientProps> = ({ tests }) => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allMarks, setAllMarks] = useState<Record<string, MarkedQuestions>>({});
  const [inProgress, setInProgress] = useState<Record<string, UserAnswers>>(
    {}
  );
  const [inProgressFlags, setInProgressFlags] = useState<
    Record<string, MarkedQuestions>
  >({});
  const [inProgressTimers, setInProgressTimers] = useState<
    Record<string, InProgressTestState['timerState']>
  >({});
  const [retakeInProgress, setRetakeInProgress] = useState<
    Record<string, InProgressTestState>
  >({});
  const [retakeTimers, setRetakeTimers] = useState<
    Record<string, InProgressTestState['timerState']>
  >({});
  const [bookmarkedTestIds, setBookmarkedTestIds] = useState<string[]>([]);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    setBookmarkedTestIds(userProfile?.bookmarkedTestIds ?? []);
  }, [userProfile?.bookmarkedTestIds]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (user && firestore) {
        setIsLoading(true);
        const storedSubmissions = await getSubmissionsForUser(
          firestore,
          user.uid
        );
        setSubmissions(storedSubmissions);

        const marks: Record<string, MarkedQuestions> = {};
        for (const sub of storedSubmissions) {
          marks[sub.id] = getReviewMarks(user.uid, sub.id);
        }
        setAllMarks(marks);

        const cloudInProgress = await getAllCloudInProgress(
          firestore,
          user.uid
        );

        const activeTestIds = new Set([
          ...Object.keys(cloudInProgress),
          ...getLocalInProgressTestIds(user.uid),
        ]);

        const inProgressAnswers: Record<string, UserAnswers> = {};
        const inProgFlags: Record<string, MarkedQuestions> = {};
        const inProgTimers: Record<string, InProgressTestState['timerState']> =
          {};

        for (const testId of activeTestIds) {
          const local = getLocalInProgressBundle(user.uid, testId);
          const cloud = cloudInProgress[testId] ?? null;
          const winner = pickNewerInProgress(local, cloud);
          if (!winner) continue;

          const localMs = local?.updatedAt.getTime() ?? -1;
          const cloudMs = cloud?.updatedAt.getTime() ?? -1;
          const winnerMs = winner.updatedAt.getTime();

          if (!local || localMs < winnerMs) {
            persistInProgressLocally(user.uid, testId, winner);
          }

          if (!cloud || cloudMs < winnerMs) {
            void saveCloudInProgress(firestore, user.uid, testId, winner);
          }

          inProgressAnswers[testId] = winner.answers;
          inProgFlags[testId] = winner.flags;
          if (winner.timerState) {
            inProgTimers[testId] = winner.timerState;
          }
        }

        setInProgress(inProgressAnswers);
        setInProgressFlags(inProgFlags);
        setInProgressTimers(inProgTimers);

        const cloudRetakes = await getAllCloudRetakeInProgress(
          firestore,
          user.uid
        );
        const retakeTestIds = new Set([
          ...Object.keys(cloudRetakes),
          ...getLocalRetakeInProgressTestIds(user.uid),
        ]);
        const retakeBundles: Record<string, InProgressTestState> = {};

        for (const testId of retakeTestIds) {
          const local = getLocalRetakeInProgressBundle(user.uid, testId);
          const cloud = cloudRetakes[testId] ?? null;
          const winner = pickNewerInProgress(local, cloud);
          if (!winner) continue;

          const localMs = local?.updatedAt.getTime() ?? -1;
          const cloudMs = cloud?.updatedAt.getTime() ?? -1;
          const winnerMs = winner.updatedAt.getTime();

          if (!local || localMs < winnerMs) {
            persistRetakeInProgressLocally(user.uid, testId, winner);
          }

          if (!cloud || cloudMs < winnerMs) {
            void saveCloudRetakeInProgress(firestore, user.uid, testId, winner);
          }

          retakeBundles[testId] = winner;
        }

        setRetakeInProgress(retakeBundles);
        setRetakeTimers(
          Object.fromEntries(
            Object.entries(retakeBundles)
              .filter(([, b]) => b.timerState)
              .map(([id, b]) => [id, b.timerState!])
          )
        );

        setIsLoading(false);
      } else if (!isUserLoading) {
        setSubmissions([]);
        setAllMarks({});
        setInProgress({});
        setInProgressFlags({});
        setInProgressTimers({});
        setRetakeInProgress({});
        setRetakeTimers({});
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [user, firestore, isUserLoading, tests]);

  const testsWithHistory = useMemo((): FamatTestWithHistory[] => {
    const submissionsByTestId = submissions.reduce((acc, sub) => {
      if (!acc[sub.testId]) {
        acc[sub.testId] = [];
      }
      acc[sub.testId].push(sub);
      return acc;
    }, {} as { [key: string]: TestSubmission[] });

    return tests.map((test) => {
      const testSubmissions = submissionsByTestId[test.id] || [];
      testSubmissions.sort(
        (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime()
      );

      const lastSubmission = testSubmissions[0];
      const markedForReview = lastSubmission
        ? allMarks[lastSubmission.id] || {}
        : {};

      const inProgressAnswers = inProgress[test.id];
      const inProgFlags = inProgressFlags[test.id];
      const retakeBundle = retakeInProgress[test.id];

      return {
        ...test,
        history: testSubmissions,
        inProgress: test.id in inProgress ? inProgressAnswers : undefined,
        markedForReview: markedForReview,
        inProgressFlags: inProgFlags,
        timerState: inProgressTimers[test.id] ?? undefined,
        retakeInProgress: retakeBundle?.answers,
        retakeSourceAnswers: retakeBundle?.sourceAnswers,
        retakeOmittedQuestions: retakeBundle?.retakeOmittedQuestions,
        retakeInProgressFlags: retakeBundle?.flags,
        retakeTimerState: retakeTimers[test.id] ?? undefined,
      };
    });
  }, [
    tests,
    submissions,
    allMarks,
    inProgress,
    inProgressFlags,
    inProgressTimers,
    retakeInProgress,
    retakeTimers,
  ]);

  const uniqueValues = useMemo(() => {
    const divisions = [...new Set(tests.map((t) => t.division))].sort();
    const monthOrder = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    // Filter out null months for the filter sidebar
    const months = [...new Set(tests.map((t) => t.month).filter(Boolean) as string[])].sort(
      (a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)
    );
    const testTypes = [...new Set(tests.map((t) => t.test_type))].sort();
    const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => b - a);
    const currentYear = new Date().getFullYear();
    return {
      divisions,
      months,
      competitions: testTypes,
      years,
      minYear: years.length > 0 ? years[years.length - 1] : currentYear,
      maxYear: years.length > 0 ? years[0] : currentYear,
    };
  }, [tests]);

  const [startYear, setStartYear] = useState(2013);
  const [endYear, setEndYear] = useState(uniqueValues.maxYear);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>(
    []
  );

  // Load filters from localStorage on initial render
  useEffect(() => {
    try {
      const savedFiltersJSON = localStorage.getItem('testFilters');
      if (savedFiltersJSON) {
        const savedFilters = JSON.parse(savedFiltersJSON);
        if (savedFilters.startYear) setStartYear(savedFilters.startYear);
        if (savedFilters.endYear) setEndYear(savedFilters.endYear);
        if (savedFilters.selectedDivisions)
          setSelectedDivisions(savedFilters.selectedDivisions);
        if (savedFilters.selectedMonths)
          setSelectedMonths(savedFilters.selectedMonths);
        if (savedFilters.selectedCompetitions)
          setSelectedCompetitions(savedFilters.selectedCompetitions);
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error);
    }
  }, []);

  // Debounce filter saves so dragging year sliders doesn't spam localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const filtersToSave = {
          startYear,
          endYear,
          selectedDivisions,
          selectedMonths,
          selectedCompetitions,
        };
        localStorage.setItem('testFilters', JSON.stringify(filtersToSave));
      } catch (error) {
        console.error('Failed to save filters to localStorage:', error);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [
    startYear,
    endYear,
    selectedDivisions,
    selectedMonths,
    selectedCompetitions,
  ]);

  const handleResetFilters = () => {
    setStartYear(2013);
    setEndYear(uniqueValues.maxYear);
    setSelectedDivisions([]);
    setSelectedMonths([]);
    setSelectedCompetitions([]);
    try {
      localStorage.removeItem('testFilters');
    } catch (error) {
      console.error('Failed to clear filters from localStorage:', error);
    }
  };

  useEffect(() => {
    if (startYear > endYear) {
      setEndYear(startYear);
    }
  }, [startYear, endYear]);

  const filteredTests = useMemo(() => {
    return testsWithHistory
      .filter((test) => {
        const yearMatch = test.year >= startYear && test.year <= endYear;
        const divisionMatch =
          selectedDivisions.length === 0 ||
          selectedDivisions.includes(test.division);
        const monthMatch =
          selectedMonths.length === 0 || (test.month !== null && selectedMonths.includes(test.month));
        const competitionMatch =
          selectedCompetitions.length === 0 ||
          selectedCompetitions.includes(test.test_type);
        return yearMatch && divisionMatch && monthMatch && competitionMatch;
      })
      .sort((a, b) => b.year - a.year || a.division.localeCompare(b.division));
  }, [
    testsWithHistory,
    startYear,
    endYear,
    selectedDivisions,
    selectedMonths,
    selectedCompetitions,
  ]);

  const handleRetakeCancelled = (testId: string) => {
    setRetakeInProgress((prev) => {
      const next = { ...prev };
      delete next[testId];
      return next;
    });
    setRetakeTimers((prev) => {
      const next = { ...prev };
      delete next[testId];
      return next;
    });
  };

  const handleToggleBookmark = async (testId: string, isBookmarked: boolean) => {
    if (!user || !firestore || isBookmarkSaving) return;
    setIsBookmarkSaving(true);
    try {
      const result = await toggleBookmark(
        firestore,
        user.uid,
        testId,
        isBookmarked,
        bookmarkedTestIds
      );
      if (result.saved) {
        setBookmarkedTestIds(result.ids);
        toast({
          title: isBookmarked ? 'Removed from saved' : 'Saved for later',
          description: isBookmarked
            ? 'Test removed from your saved list.'
            : 'Test added to your saved list.',
        });
      }
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      toast({
        variant: 'destructive',
        title: 'Could not update saved tests',
        description: 'Please try again.',
      });
    } finally {
      setIsBookmarkSaving(false);
    }
  };

  const handleSaveGoals = async (weeklyGoal: number, streakGoal: number) => {
    if (!userProfileRef || !user) return;
    await setDoc(
      userProfileRef,
      { weeklyTestGoal: weeklyGoal, streakGoal },
      { merge: true }
    );
    toast({ title: 'Goals updated' });
  };

  const weeklyGoal = userProfile?.weeklyTestGoal ?? DEFAULT_WEEKLY_GOAL;
  const streakGoal = userProfile?.streakGoal ?? DEFAULT_STREAK_GOAL;

  if (isLoading || isUserLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <FilterSidebar
        uniqueValues={uniqueValues}
        startYear={startYear}
        setStartYear={setStartYear}
        endYear={endYear}
        setEndYear={setEndYear}
        selectedDivisions={selectedDivisions}
        setSelectedDivisions={setSelectedDivisions}
        selectedMonths={selectedMonths}
        setSelectedMonths={setSelectedMonths}
        selectedCompetitions={selectedCompetitions}
        setSelectedCompetitions={setSelectedCompetitions}
        onResetFilters={handleResetFilters}
      />
      <div className="flex-1 min-w-0">
        <Tabs defaultValue="library">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="library">Test Library</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="mt-4">
            <LibraryHomeSections
              tests={testsWithHistory}
              submissions={submissions}
              weeklyGoal={weeklyGoal}
              streakGoal={streakGoal}
              onSaveGoals={handleSaveGoals}
              onRetakeCancelled={handleRetakeCancelled}
            />
            <TestList
              tests={filteredTests}
              bookmarkedTestIds={bookmarkedTestIds}
              onToggleBookmark={handleToggleBookmark}
              isBookmarkSaving={isBookmarkSaving}
            />
          </TabsContent>
          <TabsContent value="progress" className="mt-4">
            <ProgressGrid tests={filteredTests} />
          </TabsContent>
          <TabsContent value="leaderboard" className="mt-4">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LibraryClient;
