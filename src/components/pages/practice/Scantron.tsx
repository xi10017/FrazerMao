'use client';

import React, { useState, useEffect } from 'react';
import type { UserAnswers, ReviewData, MarkedQuestions } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Flag, Eye, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  markedQuestions: MarkedQuestions;
  onMarkQuestion: (question: number) => void;
  checkedQuestions: MarkedQuestions;
  onCheckQuestion: (question: number) => void;
  isReviewMode: boolean | undefined;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getCorrectAnswerText = (correctAnswer: string | string[]): string => {
  return Array.isArray(correctAnswer)
    ? correctAnswer.join(' / ')
    : correctAnswer;
};

const ScantronRow: React.FC<{
  qNum: number;
  userAnswer: string | null | undefined;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  markedQuestions: MarkedQuestions;
  onMarkQuestion: (question: number) => void;
  isReviewMode: boolean;
  isChecked: boolean;
  onCheckQuestion: (question: number) => void;
}> = ({
  qNum,
  userAnswer,
  onAnswerSelect,
  reviewData,
  markedQuestions,
  onMarkQuestion,
  isReviewMode,
  isChecked,
  onCheckQuestion,
}) => {
  const originalReview = reviewData ? reviewData[qNum] : null;

  const [reviewAttempt, setReviewAttempt] = useState<string | null | undefined>(
    null
  );
  const [showAnswer, setShowAnswer] = useState(false);
  
  useEffect(() => {
    // When review data becomes available (or changes), set the initial review attempt
    // to what the user originally answered.
    if (isReviewMode && originalReview) {
      setReviewAttempt(originalReview.userAnswer);
    } else {
      setReviewAttempt(null);
    }
    setShowAnswer(false);
  }, [isReviewMode, originalReview]);
  

  const isCorrectOnOriginal = originalReview?.isCorrect;
  const wasOmitted =
    originalReview &&
    (originalReview.userAnswer === undefined ||
      originalReview.userAnswer === null);

  const canReattemptInReview = isReviewMode && (!isCorrectOnOriginal || wasOmitted);
  
  let currentAnswer = isReviewMode ? reviewAttempt : userAnswer;
  
  const isMarked = !!markedQuestions[qNum];

  let isCorrectOnReview = false;
  if (canReattemptInReview && reviewAttempt && originalReview) {
    isCorrectOnReview = Array.isArray(originalReview.correctAnswer)
      ? originalReview.correctAnswer.includes(reviewAttempt)
      : reviewAttempt === originalReview.correctAnswer;
  }

  const handleChoiceClick = (choice: string) => {
    if (isReviewMode) {
      if (canReattemptInReview) {
        setReviewAttempt(choice);
      }
    } else {
      // In practice mode, only allow answer changes if the question hasn't been checked
      if (!isChecked) {
        onAnswerSelect(qNum, choice);
      }
    }
  };

  const getBackgroundColor = () => {
    // During practice, if a question has been checked, show its status.
    if (!isReviewMode && isChecked && originalReview) {
        return originalReview.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
    }

    // During review mode, determine color based on original submission and re-attempts
    if (isReviewMode && originalReview) {
        // If re-attempting, color based on the re-attempt's correctness
        if (canReattemptInReview && reviewAttempt !== originalReview.userAnswer && reviewAttempt !== null && reviewAttempt !== undefined) {
          return isCorrectOnReview
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30';
        }

        // Otherwise, color based on the original submission
        if (wasOmitted) return 'bg-yellow-500/10 border-yellow-500/30';
        if (isCorrectOnOriginal) return 'bg-green-500/10 border-green-500/30';
        return 'bg-red-500/10 border-red-500/30';
    }

    return ''; // Default: no background color
  };
  
  const displayCorrectAnswerInReview =
    showAnswer || (canReattemptInReview && isCorrectOnReview) || isCorrectOnOriginal;

  return (
    <div
      key={qNum}
      className={cn(
        'flex items-center justify-between rounded-lg border p-3 transition-colors',
        getBackgroundColor()
      )}
    >
      <div className="flex items-center gap-3">
        <span className="w-8 text-lg font-bold">{qNum}.</span>
        <div className="flex flex-wrap gap-2">
          {ANSWER_CHOICES.map((choice) => (
            <Button
              key={choice}
              variant={currentAnswer === choice ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 text-base"
              onClick={() => handleChoiceClick(choice)}
              disabled={(isReviewMode && !canReattemptInReview) || (!isReviewMode && isChecked)}
            >
              {choice}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMarked ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => onMarkQuestion(qNum)}
              >
                <Flag
                  className={cn(
                    'h-4 w-4',
                    isMarked && 'text-primary fill-primary'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Mark for Review</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!isReviewMode ? (
            // Practice Mode Buttons
            <>
            <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onCheckQuestion(qNum)}
                      disabled={isChecked || userAnswer === undefined || userAnswer === null}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Check Answer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
             <Button
                variant="ghost"
                size="sm"
                onClick={() => onAnswerSelect(qNum, null)}
                disabled={!userAnswer || isChecked}
                className="h-8"
              >
                Clear
              </Button>
            </>
        ) : (
          // Review Mode Display
          originalReview && (
            <div className="flex items-center gap-2 justify-end">
              {canReattemptInReview && !isCorrectOnReview && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowAnswer(!showAnswer)}
                      >
                        {showAnswer ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{showAnswer ? 'Hide' : 'Show'} Correct Answer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
  
              <div className="text-right text-sm font-bold">
                {canReattemptInReview && reviewAttempt !== originalReview.userAnswer && reviewAttempt !== null && reviewAttempt !== undefined ? (
                  isCorrectOnReview ? (
                    <>
                      <span className="text-green-600 dark:text-green-400">
                        Correct!
                      </span>
                      <div className="text-muted-foreground">
                        Ans:{' '}
                        {getCorrectAnswerText(originalReview.correctAnswer)}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-red-600 dark:text-red-400">
                        Incorrect
                      </span>
                      {displayCorrectAnswerInReview && (
                        <div className="text-muted-foreground">
                          Ans:{' '}
                          {getCorrectAnswerText(originalReview.correctAnswer)}
                        </div>
                      )}
                    </>
                  )
                ) : wasOmitted ? (
                  <>
                    <span className="text-yellow-600 dark:text-yellow-400">
                      Omitted
                    </span>
                    {displayCorrectAnswerInReview && (
                      <div className="text-muted-foreground">
                        Ans:{' '}
                        {getCorrectAnswerText(originalReview.correctAnswer)}
                      </div>
                    )}
                  </>
                ) : isCorrectOnOriginal ? (
                  <>
                    <span className="text-green-600 dark:text-green-400">
                      Correct
                    </span>
                    <div className="text-muted-foreground">
                      Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-red-600 dark:text-red-400">
                      Incorrect
                    </span>
                    {displayCorrectAnswerInReview && (
                      <div className="text-muted-foreground">
                        {`You: ${
                          originalReview.userAnswer
                        } | Ans: ${getCorrectAnswerText(
                          originalReview.correctAnswer
                        )}`}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        )}
         {(isChecked && !isReviewMode && originalReview) && (
            <div className='text-right text-sm font-bold'>
                 {originalReview.isCorrect ? (
                  <span className="text-green-600 dark:text-green-400">
                    Correct!
                  </span>
                ) : (
                    <span className="text-red-600 dark:text-red-400">
                    Incorrect
                  </span>
                )}
                 <div className="text-muted-foreground">
                    Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export const Scantron: React.FC<ScantronProps> = ({
  userAnswers,
  onAnswerSelect,
  reviewData,
  markedQuestions,
  onMarkQuestion,
  checkedQuestions,
  onCheckQuestion,
  isReviewMode = false,
}) => {
  const questionNumbers = Array.from(
    { length: TOTAL_QUESTIONS },
    (_, i) => i + 1
  );

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {questionNumbers.map((qNum) => (
            <ScantronRow
              key={qNum}
              qNum={qNum}
              userAnswer={userAnswers[qNum]}
              onAnswerSelect={onAnswerSelect}
              reviewData={reviewData}
              markedQuestions={markedQuestions}
              onMarkQuestion={onMarkQuestion}
              isReviewMode={isReviewMode}
              isChecked={!!checkedQuestions[qNum]}
              onCheckQuestion={onCheckQuestion}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
