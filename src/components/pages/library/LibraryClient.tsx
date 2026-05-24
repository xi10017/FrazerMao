
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type {
  FamatTest,
  FamatTestWithHistory,
  TestSubmission,
  MarkedQuestions,
  UserAnswers,
} from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import {
  getSubmissionsForUser,
  getInProgressAnswers,
  getReviewMarks,
  getInProgressFlags,
  getTimerState,
  toggleBookmark,
} from '@/lib/user-data';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressGrid } from './ProgressGrid';
import { Leaderboard } from './Leaderboard';
import { LandingPage } from '@/components/pages/landing/LandingPage';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

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
  const [bookmarkedTestIds, setBookmarkedTestIds] = useState<string[]>([]);

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

        const inProgressAnswers: Record<string, UserAnswers> = {};
        const inProgFlags: Record<string, MarkedQuestions> = {};
        tests.forEach((test) => {
          const savedAnswers = getInProgressAnswers(user.uid, test.id);
          if (savedAnswers) {
            inProgressAnswers[test.id] = savedAnswers;
          }
          const savedFlags = getInProgressFlags(user.uid, test.id);
          if (savedFlags) {
            inProgFlags[test.id] = savedFlags;
          }
        });
        setInProgress(inProgressAnswers);
        setInProgressFlags(inProgFlags);

        setIsLoading(false);
      } else if (!isUserLoading) {
        setSubmissions([]);
        setAllMarks({});
        setInProgress({});
        setInProgressFlags({});
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
      const timerState = user ? getTimerState(user.uid, test.id) : null;

      return {
        ...test,
        history: testSubmissions,
        inProgress: inProgressAnswers,
        markedForReview: markedForReview,
        inProgressFlags: inProgFlags,
        timerState: timerState || undefined,
      };
    });
  }, [tests, submissions, allMarks, inProgress, inProgressFlags, user]);

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

  // Save filters to localStorage whenever they change
  useEffect(() => {
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

  const handleToggleBookmark = async (testId: string, isBookmarked: boolean) => {
    if (!user || !firestore) return;
    try {
      const updated = await toggleBookmark(firestore, user.uid, testId, isBookmarked);
      setBookmarkedTestIds(updated);
      toast({
        title: isBookmarked ? 'Removed from saved' : 'Saved for later',
        description: isBookmarked
          ? 'Test removed from your saved list.'
          : 'Test added to your saved list.',
      });
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
      toast({
        variant: 'destructive',
        title: 'Could not update saved tests',
        description: 'Please try again.',
      });
    }
  };

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
            <TestList
              tests={filteredTests}
              bookmarkedTestIds={bookmarkedTestIds}
              onToggleBookmark={handleToggleBookmark}
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
