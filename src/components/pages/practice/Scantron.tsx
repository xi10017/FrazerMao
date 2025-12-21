'use client';

import React from 'react';
import type { UserAnswers, ReviewData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  isSubmitted: boolean;
  reviewData?: ReviewData | null;
  headerContent?: React.ReactNode;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getReviewColorClasses = (
    qNum: number,
    isReview: boolean,
    reviewData: ReviewData | null
  ) => {
    if (!isReview || !reviewData || !reviewData[qNum]) return '';

    const { userAnswer, isCorrect } = reviewData[qNum];
    if (userAnswer === undefined || userAnswer === null) {
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

export const Scantron: React.FC<ScantronProps> = ({ 
    userAnswers, 
    onAnswerSelect, 
    isSubmitted,
    reviewData,
    headerContent
}) => {
  const questionNumbers = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => i + 1);
  const isReviewMode = !!reviewData;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <div>
            <h2 className="text-xl font-bold">Digital Scantron</h2>
        </div>
        {headerContent}
      </header>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
            {questionNumbers.map((qNum) => (
                <div key={qNum} className={cn(
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
                                disabled={isSubmitted}
                            >
                                {choice}
                            </Button>
                            ))}
                        </div>
                    </div>
                    {isReviewMode && reviewData?.[qNum] ? (
                        <div className="text-sm font-bold text-right">
                            {reviewData[qNum].userAnswer === undefined || reviewData[qNum].userAnswer === null ? (
                                <span className="text-yellow-400">Omitted</span>
                            ) : reviewData[qNum].isCorrect ? (
                                <>
                                  <span className="text-green-400">Correct</span>
                                  <div className='text-muted-foreground'>Ans: {reviewData[qNum].correctAnswer}</div>
                                </>
                            ) : (
                                <>
                                  <span className="text-red-400">Incorrect</span>
                                   <div className='text-muted-foreground'>You: {reviewData[qNum].userAnswer} | Ans: {reviewData[qNum].correctAnswer}</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onAnswerSelect(qNum, null)}
                            disabled={isSubmitted || !userAnswers[qNum]}
                        >
                            Clear
                        </Button>
                    )}
                </div>
            ))}
        </div>
      </ScrollArea>
    </div>
  );
};
