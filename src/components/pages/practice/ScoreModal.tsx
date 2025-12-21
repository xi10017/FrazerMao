'use client';

import React from 'react';
import type { ScoreReport } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, MinusCircle, BookOpen } from 'lucide-react';

interface ScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  scoreReport: ScoreReport;
}

const StatCard = ({
  icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
}) => (
  <div className="flex flex-col items-center justify-center rounded-lg border p-4">
    <div className={`flex items-center gap-2 ${colorClass}`}>
      {icon}
      <span className="text-lg font-semibold">{label}</span>
    </div>
    <span className="mt-2 text-4xl font-bold text-foreground">{value}</span>
  </div>
);

export const ScoreModal: React.FC<ScoreModalProps> = ({
  isOpen,
  onClose,
  scoreReport,
}) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-3xl font-bold">
            Your Report Card
          </DialogTitle>
          <DialogDescription className="text-center">
            Here's how you performed on the test.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 flex flex-col items-center justify-center">
          <div className="text-7xl font-extrabold text-primary">
            {scoreReport.totalScore}
          </div>
          <div className="text-lg text-muted-foreground">out of 150</div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <StatCard
            icon={<CheckCircle className="h-5 w-5" />}
            label="Correct"
            value={scoreReport.correctCount}
            colorClass="text-green-500"
          />
          <StatCard
            icon={<XCircle className="h-5 w-5" />}
            label="Incorrect"
            value={scoreReport.incorrectCount}
            colorClass="text-red-500"
          />
          <StatCard
            icon={<MinusCircle className="h-5 w-5" />}
            label="Omitted"
            value={scoreReport.omitCount}
            colorClass="text-yellow-500"
          />
        </div>

        <DialogFooter className="mt-6 sm:justify-center">
          <Button
            type="button"
            size="lg"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Continue to Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
