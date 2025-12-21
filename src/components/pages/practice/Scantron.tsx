'use client';

import React from 'react';
import type { UserAnswers, ReviewData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Lightbulb } from 'lucide-react';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  headerContent: React.ReactNode;
  onAskAI: (questionNumber: number) => void;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getReviewColorClasses = (qNum: number, reviewData: ReviewData | null) => {
  if (!reviewData || !reviewData[qNum]) return '';

  const { userAnswer, isCorrect } = reviewData[qNum];
  if (userAnswer === undefined || userAnswer === null) {
    return 'bg-yellow-500/10 border-yellow-500/30';
  }
  if (isCorrect) {
    return 'bg-green-500/10 border-green-500/30';
  }
  return 'bg-red-500/10 border-red-500/30';
};

export const Scantron: React.FC<ScantronProps> = ({
  userAnswers,
  onAnswerSelect,
  reviewData,
  headerContent,
  onAskAI,
}) => {
  const questionNumbers = Array.from(
    { length: TOTAL_QUESTIONS },
    (_, i) => i + 1
  );
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
        <div className="space-y-2 p-4">
          {questionNumbers.map((qNum) => (
            <div
              key={qNum}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3 transition-colors',
                getReviewColorClasses(qNum, reviewData)
              )}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 text-lg font-bold">{qNum}.</span>
                <div className="flex flex-wrap gap-2">
                  {ANSWER_CHOICES.map((choice) => (
                    <Button
                      key={choice}
                      variant={
                        userAnswers[qNum] === choice ? 'default' : 'outline'
                      }
                      size="icon"
                      className="h-9 w-9 text-base"
                      onClick={() => onAnswerSelect(qNum, choice)}
                    >
                      {choice}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isReviewMode && reviewData?.[qNum] ? (
                  <div className="text-right text-sm font-bold">
                    {reviewData[qNum].userAnswer === undefined ||
                    reviewData[qNum].userAnswer === null ? (
                      <span className="text-yellow-400">Omitted</span>
                    ) : reviewData[qNum].isCorrect ? (
                      <>
                        <span className="text-green-400">Correct</span>
                        <div className="text-muted-foreground">
                          Ans: {reviewData[qNum].correctAnswer}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-red-400">Incorrect</span>
                        <div className="text-muted-foreground">
                          You: {reviewData[qNum].userAnswer} | Ans:{' '}
                          {reviewData[qNum].correctAnswer}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                   <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onAskAI(qNum)}
                      className="h-8 w-8"
                    >
                      <Lightbulb className="h-4 w-4" />
                      <span className="sr-only">Ask AI</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAnswerSelect(qNum, null)}
                        disabled={!userAnswers[qNum]}
                        className="h-8"
                    >
                        Clear
                    </Button>
                   </>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
