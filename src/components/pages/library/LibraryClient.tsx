'use client';

import React, { useState, useMemo } from 'react';
import type { FamatTest } from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';

interface LibraryClientProps {
  tests: FamatTest[];
}

const LibraryClient: React.FC<LibraryClientProps> = ({ tests }) => {
  const [yearRange, setYearRange] = useState<[number, number]>([2015, 2025]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);

  const uniqueValues = useMemo(() => {
    const divisions = [...new Set(tests.map((t) => t.division))];
    const months = [...new Set(tests.map((t) => t.month))];
    const competitions = [...new Set(tests.map((t) => t.competition))];
    const years = [...new Set(tests.map((t) => t.year))];
    return {
      divisions,
      months,
      competitions,
      minYear: Math.min(...years),
      maxYear: Math.max(...years),
    };
  }, [tests]);

  const filteredTests = useMemo(() => {
    return tests
      .filter((test) => {
        const [minYear, maxYear] = yearRange;
        const yearMatch = test.year >= minYear && test.year <= maxYear;
        const divisionMatch =
          selectedDivisions.length === 0 ||
          selectedDivisions.includes(test.division);
        const monthMatch =
          selectedMonths.length === 0 || selectedMonths.includes(test.month);
        const competitionMatch =
          selectedCompetitions.length === 0 ||
          selectedCompetitions.includes(test.competition);
        return yearMatch && divisionMatch && monthMatch && competitionMatch;
      })
      .sort((a, b) => b.year - a.year);
  }, [tests, yearRange, selectedDivisions, selectedMonths, selectedCompetitions]);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <FilterSidebar
        uniqueValues={uniqueValues}
        yearRange={yearRange}
        setYearRange={setYearRange}
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
