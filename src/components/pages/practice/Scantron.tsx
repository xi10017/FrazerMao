'use client';

import React from 'react';
import type { UserAnswers, ReviewData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  isReviewMode: boolean;
  reviewData: ReviewData | null;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getReviewColorClasses = (
    qNum: number,
    isReviewMode: boolean,
    reviewData: ReviewData | null
  ) => {
    if (!isReviewMode || !reviewData || !reviewData[qNum]) return '';

    const { userAnswer, isCorrect } = reviewData[qNum];
    if (userAnswer === undefined) {
      // Omitted
      return 'bg-yellow-500/10 border-yellow-500/30';
    }
    if (isCorrect) {
      // Correct
      return 'bg-green-500/10 border-green-500/30';
    }
    // Incorrect
    return 'bg-red-500/10 border-red-500/30';
  };

export const Scantron: React.FC<ScantronProps> = ({ userAnswers, onAnswerSelect, isReviewMode, reviewData }) => {
  const questionNumbers = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b p-4">
        <h2 className="text-xl font-bold">Digital Scantron</h2>
        {isReviewMode && <p className="text-sm text-muted-foreground">Reviewing your results.</p>}
      </header>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
            {questionNumbers.map((qNum, index) => (
                <React.Fragment key={qNum}>
                    <div className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        getReviewColorClasses(qNum, isReviewMode, reviewData)
                    )}>
                        <div className="flex items-center">
                            <span className="text-lg font-bold w-8">{qNum}.</span>
                            <div className="flex flex-wrap gap-2">
                                {ANSWER_CHOICES.map((choice) => (
                                <Button
                                    key={choice}
                                    variant={userAnswers[qNum] === choice ? 'default' : 'outline'}
                                    size="icon"
                                    className="h-9 w-9 text-base"
                                    onClick={() => onAnswerSelect(qNum, choice)}
                                    disabled={isReviewMode}
                                >
                                    {choice}
                                </Button>
                                ))}
                            </div>
                        </div>
                        {isReviewMode && reviewData?.[qNum] ? (
                            <div className="text-sm font-bold text-right">
                                {reviewData[qNum].userAnswer === undefined ? (
                                    <span className="text-yellow-400">Omitted</span>
                                ) : reviewData[qNum].isCorrect ? (
                                    <span className="text-green-400">Correct</span>
                                ) : (
                                    <span className="text-red-400">Incorrect</span>
                                )}
                                <div className="text-muted-foreground">Ans: {reviewData[qNum].correctAnswer}</div>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onAnswerSelect(qNum, null)}
                                disabled={isReviewMode || !userAnswers[qNum]}
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </React.Fragment>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
};
