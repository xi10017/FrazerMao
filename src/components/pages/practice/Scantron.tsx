'use client';

import React, { useState, useEffect, memo } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  markedQuestions: MarkedQuestions;
  onMarkQuestion: (question: number) => void;
  checkedQuestions: MarkedQuestions;
  onCheckQuestion: (question: number) => void;
  isReviewMode: boolean | undefined;
  hideCheckWarning: boolean;
  onSetHideCheckWarning: (hide: boolean) => void;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getCorrectAnswerText = (correctAnswer: string | string[]): string => {
  return Array.isArray(correctAnswer)
    ? correctAnswer.join(' / ')
    : correctAnswer;
};

// Memoized component for Practice Mode buttons
const PracticeModeButtons = memo<{
  qNum: number;
  userAnswer: string | null | undefined;
  isChecked: boolean;
  onCheckQuestion: (qNum: number) => void;
  onClear: (qNum: number, answer: null) => void;
  hideCheckWarning: boolean;
  onSetHideCheckWarning: (hide: boolean) => void;
}>(function PracticeModeButtons({
  qNum,
  userAnswer,
  isChecked,
  onCheckQuestion,
  onClear,
  hideCheckWarning,
  onSetHideCheckWarning
}) {

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCheckClick = () => {
    if (hideCheckWarning) {
      onCheckQuestion(qNum);
    } else {
      setIsWarningOpen(true);
    }
  };

  const handleConfirmCheck = () => {
    if (dontShowAgain) {
      onSetHideCheckWarning(true);
    }
    onCheckQuestion(qNum);
    setIsWarningOpen(false);
  };

  return (
    <>
      <AlertDialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCheckClick}
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

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to check?</AlertDialogTitle>
            <AlertDialogDescription>
              Checking your answer will lock it in, and you won't be able to change it for this practice session.
            </AlertDialogDescription>
          </AlertDialogHeader>
           <div className="flex items-center space-x-2 my-4">
            <Checkbox
              id={`dont-show-again-${qNum}`}
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(!!checked)}
            />
            <Label htmlFor={`dont-show-again-${qNum}`} className="cursor-pointer">
              Don't show this again
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCheck}>Yes, check my answer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onClear(qNum, null)}
        disabled={!userAnswer || isChecked}
        className="h-8"
      >
        Clear
      </Button>
    </>
  );
});


// Memoized component for Review Mode feedback display
const ReviewModeDisplay = memo<{
  originalReview: ReviewData[number];
  canReattemptInReview: boolean;
  isCorrectOnReview: boolean;
  reviewAttempt: string | null | undefined;
}>(function ReviewModeDisplay({ originalReview, canReattemptInReview, isCorrectOnReview, reviewAttempt }) {
  const [showAnswer, setShowAnswer] = useState(false);
  const wasOmitted = !originalReview.userAnswer;
  const isCorrectOnOriginal = originalReview.isCorrect;
  const displayCorrectAnswerInReview =
    showAnswer || (canReattemptInReview && isCorrectOnReview) || isCorrectOnOriginal;

  return (
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
                  {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{showAnswer ? 'Hide' : 'Show'} Correct Answer</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <div className="text-right text-sm font-bold">
          {canReattemptInReview && reviewAttempt !== originalReview.userAnswer && reviewAttempt ? (
            isCorrectOnReview ? (
              <>
                <span className="text-green-600 dark:text-green-400">Correct!</span>
                <div className="text-muted-foreground">
                  Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
                </div>
              </>
            ) : (
              <>
                <span className="text-red-600 dark:text-red-400">Incorrect</span>
                {displayCorrectAnswerInReview && (
                  <div className="text-muted-foreground">
                    Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
                  </div>
                )}
              </>
            )
          ) : wasOmitted ? (
            <>
              <span className="text-yellow-600 dark:text-yellow-400">Omitted</span>
              {displayCorrectAnswerInReview && (
                <div className="text-muted-foreground">
                  Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
                </div>
              )}
            </>
          ) : isCorrectOnOriginal ? (
            <>
              <span className="text-green-600 dark:text-green-400">Correct</span>
              <div className="text-muted-foreground">
                Ans: {getCorrectAnswerText(originalReview.correctAnswer)}
              </div>
            </>
          ) : (
            <>
              <span className="text-red-600 dark:text-red-400">Incorrect</span>
              {displayCorrectAnswerInReview && (
                <div className="text-muted-foreground">
                  {`You: ${originalReview.userAnswer} | Ans: ${getCorrectAnswerText(originalReview.correctAnswer)}`}
                </div>
              )}
            </>
          )}
        </div>
      </div>
  );
});


const ScantronRow: React.FC<Omit<ScantronProps, 'userAnswers' | 'checkedQuestions'> & {
  qNum: number;
  userAnswer: string | null | undefined;
  isChecked: boolean;
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
  hideCheckWarning,
  onSetHideCheckWarning,
}) => {
  const originalReview = reviewData ? reviewData[qNum] : null;

  const [reviewAttempt, setReviewAttempt] = useState<string | null | undefined>(
    null
  );

  useEffect(() => {
    // When entering review mode, set the attempt to the user's original answer.
    if (isReviewMode && originalReview) {
      setReviewAttempt(originalReview.userAnswer);
    } else {
      setReviewAttempt(null);
    }
  }, [isReviewMode, originalReview]);
  
  const wasOmitted = originalReview && !originalReview.userAnswer;
  const canReattemptInReview = isReviewMode && (!originalReview?.isCorrect || wasOmitted);
  
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
        if (canReattemptInReview && reviewAttempt !== originalReview.userAnswer && reviewAttempt) {
          return isCorrectOnReview
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30';
        }
        if (wasOmitted) return 'bg-yellow-500/10 border-yellow-500/30';
        if (originalReview.isCorrect) return 'bg-green-500/10 border-green-500/30';
        return 'bg-red-500/10 border-red-500/30';
    }
    return ''; // Default: no background color
  };
  
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
            <PracticeModeButtons 
                qNum={qNum}
                userAnswer={userAnswer}
                isChecked={isChecked}
                onCheckQuestion={onCheckQuestion}
                onClear={onAnswerSelect}
                hideCheckWarning={hideCheckWarning}
                onSetHideCheckWarning={onSetHideCheckWarning}
            />
        ) : (
          originalReview && (
            <ReviewModeDisplay 
                originalReview={originalReview}
                canReattemptInReview={canReattemptInReview}
                isCorrectOnReview={isCorrectOnReview}
                reviewAttempt={reviewAttempt}
            />
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
  hideCheckWarning,
  onSetHideCheckWarning,
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
              isChecked={!!checkedQuestions[qNum]}
              onAnswerSelect={onAnswerSelect}
              reviewData={reviewData}
              markedQuestions={markedQuestions}
              onMarkQuestion={onMarkQuestion}
              isReviewMode={isReviewMode}
              onCheckQuestion={onCheckQuestion}
              hideCheckWarning={hideCheckWarning}
              onSetHideCheckWarning={onSetHideCheckWarning}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};