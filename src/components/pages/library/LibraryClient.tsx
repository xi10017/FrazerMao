'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { FamatTest, FamatTestWithHistory, TestSubmission } from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';
import { useUser, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';


interface LibraryClientProps {
  tests: FamatTest[];
}

const LibraryClient: React.FC<LibraryClientProps> = ({ tests }) => {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const submissionsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'users', user.uid, 'submissions'),
      orderBy('submittedAt', 'desc')
    );
  }, [firestore, user?.uid]);

  const { data: submissions, loading: submissionsLoading } = useCollection<TestSubmission>(submissionsQuery);

  const testsWithHistory = useMemo((): FamatTestWithHistory[] => {
    if (submissionsLoading || !submissions) {
      return tests.map(t => ({...t, history: []}));
    }

    const submissionsByTestId = submissions.reduce((acc, sub) => {
        if (!acc[sub.testId]) {
            acc[sub.testId] = [];
        }
        acc[sub.testId].push(sub);
        return acc;
    }, {} as {[key: string]: TestSubmission[]});

    return tests.map(test => ({
        ...test,
        history: submissionsByTestId[test.id] || []
    }));

  }, [tests, submissions, submissionsLoading]);


  const uniqueValues = useMemo(() => {
    const divisions = [...new Set(tests.map((t) => t.division))];
    const months = [...new Set(tests.map((t) => t.month))];
    const testTypes = [...new Set(tests.map((t) => t.test_type))];
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
  
  // Ensure startYear is not greater than endYear
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
      .sort((a, b) => b.year - a.year);
  }, [testsWithHistory, startYear, endYear, selectedDivisions, selectedMonths, selectedCompetitions]);

  if (!user && !submissionsLoading) {
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
      <div className="flex-1">
        <TestList tests={filteredTests} />
      </div>
    </div>
  );
};

export default LibraryClient;
