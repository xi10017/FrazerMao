'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { FamatTest } from '@/lib/types';
import { FilterSidebar } from './FilterSidebar';
import { TestList } from './TestList';

interface LibraryClientProps {
  tests: FamatTest[];
}

const LibraryClient: React.FC<LibraryClientProps> = ({ tests }) => {
  const uniqueValues = useMemo(() => {
    const divisions = [...new Set(tests.map((t) => t.division))];
    const months = [...new Set(tests.map((t) => t.month))];
    const competitions = [...new Set(tests.map((t) => t.competition))];
    const years = [...new Set(tests.map((t) => t.year))].sort((a, b) => a - b);
    return {
      divisions,
      months,
      competitions,
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
    return tests
      .filter((test) => {
        const yearMatch = test.year >= startYear && test.year <= endYear;
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
  }, [tests, startYear, endYear, selectedDivisions, selectedMonths, selectedCompetitions]);

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
