'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div>
    <h3 className="mb-4 text-lg font-semibold tracking-tight">{title}</h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const CheckboxFilter: React.FC<{
  items: string[];
  selectedItems: string[];
  onSelectionChange: (items: string[]) => void;
  title: string;
}> = ({ items, selectedItems, onSelectionChange, title }) => {
  return (
    <>
      {items.map((item) => (
        <div key={`${title}-${item}`} className="flex items-center space-x-2">
          <Checkbox
            id={`${title}-${item}-filter`}
            checked={selectedItems.includes(item)}
            onCheckedChange={(checked) => {
              if (checked) {
                onSelectionChange([...selectedItems, item]);
              } else {
                onSelectionChange(selectedItems.filter((i) => i !== item));
              }
            }}
          />
          <Label htmlFor={`${title}-${item}-filter`} className="font-normal">
            {item}
          </Label>
        </div>
      ))}
    </>
  );
};

interface FilterSidebarProps {
  uniqueValues: {
    divisions: string[];
    months: string[];
    competitions: string[];
    years: number[];
  };
  startYear: number;
  setStartYear: (year: number) => void;
  endYear: number;
  setEndYear: (year: number) => void;
  selectedDivisions: string[];
  setSelectedDivisions: (divisions: string[]) => void;
  selectedMonths: string[];
  setSelectedMonths: (months: string[]) => void;
  selectedCompetitions: string[];
  setSelectedCompetitions: (competitions: string[]) => void;
  onResetFilters: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  uniqueValues,
  startYear,
  setStartYear,
  endYear,
  setEndYear,
  selectedDivisions,
  setSelectedDivisions,
  selectedMonths,
  setSelectedMonths,
  selectedCompetitions,
  setSelectedCompetitions,
  onResetFilters,
}) => {
  const years = uniqueValues.years.sort((a, b) => b - a);
  const isFiltered =
    selectedDivisions.length > 0 ||
    selectedMonths.length > 0 ||
    selectedCompetitions.length > 0 ||
    startYear !== uniqueValues.years[0] ||
    endYear !== uniqueValues.years[uniqueValues.years.length -1];

  return (
    <aside className="w-full md:w-64 lg:w-72">
      <Card>
        <CardHeader>
          <CardTitle>Filter Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FilterSection title="Division">
            <CheckboxFilter
              title="division"
              items={uniqueValues.divisions}
              selectedItems={selectedDivisions}
              onSelectionChange={setSelectedDivisions}
            />
          </FilterSection>

          <FilterSection title="Year Range">
            <div className="space-y-4">
              <div>
                <Label htmlFor="start-year">Start Year</Label>
                <Select
                  value={String(startYear)}
                  onValueChange={(value) => setStartYear(Number(value))}
                >
                  <SelectTrigger id="start-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={`start-year-${year}`} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="end-year">End Year</Label>
                <Select
                  value={String(endYear)}
                  onValueChange={(value) => setEndYear(Number(value))}
                >
                  <SelectTrigger id="end-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={`end-year-${year}`} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Month">
            <CheckboxFilter
              title="month"
              items={uniqueValues.months}
              selectedItems={selectedMonths}
              onSelectionChange={setSelectedMonths}
            />
          </FilterSection>

          <FilterSection title="Competition">
            <CheckboxFilter
              title="competition"
              items={uniqueValues.competitions}
              selectedItems={selectedCompetitions}
              onSelectionChange={setSelectedCompetitions}
            />
          </FilterSection>

          <Button
            variant="ghost"
            onClick={onResetFilters}
            className="w-full"
            disabled={!isFiltered}
          >
            <X className="mr-2 h-4 w-4" />
            Reset Filters
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
};
