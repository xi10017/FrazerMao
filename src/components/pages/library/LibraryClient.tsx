'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { FamatTest, FamatTestWithHistory, TestSubmission } from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';
import { useUser, useFirestore } from '@/firebase';
import { getSubmissionsForUser, getInProgressAnswers } from '@/lib/localStorage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressGrid } from './ProgressGrid';

interface LibraryClientProps {
  tests: FamatTest[];
}

const LibraryClient: React.FC<LibraryClientProps> = ({ tests }) => {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [submissions, setSubmissions] = useState<TestSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubmissions = async () => {
      if (user && firestore) {
        setIsLoading(true);
        const storedSubmissions = await getSubmissionsForUser(firestore, user.uid);
        setSubmissions(storedSubmissions);
        setIsLoading(false);
      } else if (!isUserLoading) {
        setSubmissions([]); // Clear submissions if user logs out
        setIsLoading(false);
      }
    }
    fetchSubmissions();
  }, [user, firestore, isUserLoading]);


  const testsWithHistory = useMemo((): FamatTestWithHistory[] => {
    if (!user) {
      return tests.map(t => ({...t, history: [], inProgress: false}));
    }

    const submissionsByTestId = submissions.reduce((acc, sub) => {
        if (!acc[sub.testId]) {
            acc[sub.testId] = [];
        }
        acc[sub.testId].push(sub);
        return acc;
    }, {} as {[key: string]: TestSubmission[]});

    return tests.map(test => {
        const hasInProgress = !!getInProgressAnswers(user.uid, test.id);
        const testSubmissions = submissionsByTestId[test.id] || [];
        // Ensure history is sorted most recent first
        testSubmissions.sort((a,b) => b.submittedAt.getTime() - a.submittedAt.getTime());

        return {
            ...test,
            history: testSubmissions,
            inProgress: hasInProgress
        }
    });

  }, [tests, submissions, user]);


  const uniqueValues = useMemo(() => {
    const divisions = [...new Set(tests.map((t) => t.division))].sort();
    const months = [...new Set(tests.map((t) => t.month))].sort();
    const testTypes = [...new Set(tests.map((t) => t.test_type))].sort();
    const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => a - b);
    return {
      divisions,
      months,
      competitions: testTypes,
      years,
      minYear: years[0],
      maxYear: years[years.length - 1],
    };
  }, [tests]);

  const [startYear, setStartYear] = useState(uniqueValues.minYear);
  const [endYear, setEndYear] = useState(uniqueValues.maxYear);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  
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
          selectedMonths.length === 0 || selectedMonths.includes(test.month);
        const competitionMatch =
          selectedCompetitions.length === 0 ||
          selectedCompetitions.includes(test.test_type);
        return yearMatch && divisionMatch && monthMatch && competitionMatch;
      })
      .sort((a, b) => b.year - a.year || a.division.localeCompare(b.division));
  }, [testsWithHistory, startYear, endYear, selectedDivisions, selectedMonths, selectedCompetitions]);

  if (isLoading || isUserLoading) {
     return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Loading...</h2>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Welcome to MuPractice</h2>
          <p className="mt-2 text-muted-foreground">Please sign in to save your progress and view test history.</p>
        </div>
      </div>
    )
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
      />
      <div className="flex-1 min-w-0">
        <Tabs defaultValue="library">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="library">Test Library</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="mt-4">
            <TestList tests={filteredTests} />
          </TabsContent>
          <TabsContent value="progress" className="mt-4">
             <ProgressGrid tests={filteredTests} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LibraryClient;
