'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

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
}> = ({ items, selectedItems, onSelectionChange }) => (
  <>
    {items.map((item) => (
      <div key={item} className="flex items-center space-x-2">
        <Checkbox
          id={`${item}-filter`}
          checked={selectedItems.includes(item)}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectionChange([...selectedItems, item]);
            } else {
              onSelectionChange(selectedItems.filter((i) => i !== item));
            }
          }}
        />
        <Label htmlFor={`${item}-filter`} className="font-normal">
          {item}
        </Label>
      </div>
    ))}
  </>
);

interface FilterSidebarProps {
  uniqueValues: {
    divisions: string[];
    months: string[];
    competitions: string[];
    minYear: number;
    maxYear: number;
  };
  yearRange: [number, number];
  setYearRange: (range: [number, number]) => void;
  selectedDivisions: string[];
  setSelectedDivisions: (divisions: string[]) => void;
  selectedMonths: string[];
  setSelectedMonths: (months: string[]) => void;
  selectedCompetitions: string[];
  setSelectedCompetitions: (competitions: string[]) => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  uniqueValues,
  yearRange,
  setYearRange,
  selectedDivisions,
  setSelectedDivisions,
  selectedMonths,
  setSelectedMonths,
  selectedCompetitions,
  setSelectedCompetitions,
}) => {
  return (
    <aside className="w-full md:w-64 lg:w-72">
      <Card>
        <CardHeader>
          <CardTitle>Filter Tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FilterSection title="Division">
            <CheckboxFilter
              items={uniqueValues.divisions}
              selectedItems={selectedDivisions}
              onSelectionChange={setSelectedDivisions}
            />
          </FilterSection>

          <FilterSection title="Year Range">
            <div className="px-1">
              <Slider
                min={2015}
                max={2025}
                step={1}
                value={yearRange}
                onValueChange={(value) => setYearRange(value as [number, number])}
              />
              <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                <span>{yearRange[0]}</span>
                <span>{yearRange[1]}</span>
              </div>
            </div>
          </FilterSection>

          <FilterSection title="Month">
            <CheckboxFilter
              items={uniqueValues.months}
              selectedItems={selectedMonths}
              onSelectionChange={setSelectedMonths}
            />
          </FilterSection>
          
          <FilterSection title="Competition">
            <CheckboxFilter
              items={uniqueValues.competitions}
              selectedItems={selectedCompetitions}
              onSelectionChange={setSelectedCompetitions}
            />
          </FilterSection>
        </CardContent>
      </Card>
    </aside>
  );
};
