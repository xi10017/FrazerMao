
'use client';

import React, { useState } from 'react';
import type { UserAnswers, ReviewData, MarkedQuestions } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Flag, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScantronProps {
  userAnswers: UserAnswers;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  markedQuestions: MarkedQuestions;
  onMarkQuestion: (question: number) => void;
}

const ANSWER_CHOICES = ['A', 'B', 'C', 'D', 'E'];
const TOTAL_QUESTIONS = 30;

const getCorrectAnswerText = (correctAnswer: string | string[]): string => {
  if (Array.isArray(correctAnswer)) {
    return correctAnswer.join(' / ');
  }
  return correctAnswer;
};

const ScantronRow: React.FC<{
  qNum: number;
  userAnswer: string | null | undefined;
  onAnswerSelect: (question: number, answer: string | null) => void;
  reviewData: ReviewData | null;
  markedQuestions: MarkedQuestions;
  onMarkQuestion: (question: number) => void;
}> = ({ qNum, userAnswer, onAnswerSelect, reviewData, markedQuestions, onMarkQuestion }) => {
  const isReviewMode = !!reviewData;
  const originalReview = reviewData ? reviewData[qNum] : null;

  const [reviewAttempt, setReviewAttempt] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const isCorrectOnOriginal = originalReview?.isCorrect;
  const wasOmitted = originalReview && (originalReview.userAnswer === undefined || originalReview.userAnswer === null);

  const canReattempt = isReviewMode && (!isCorrectOnOriginal || wasOmitted);
  const currentAnswer = canReattempt ? reviewAttempt : userAnswer;

  let isCorrectOnReview = false;
  if (canReattempt && reviewAttempt && originalReview) {
    isCorrectOnReview = Array.isArray(originalReview.correctAnswer)
      ? originalReview.correctAnswer.includes(reviewAttempt)
      : reviewAttempt === originalReview.correctAnswer;
  }

  const handleReviewAnswerSelect = (answer: string) => {
    if (canReattempt) {
      setReviewAttempt(answer);
    }
  };

  const getReviewColorClasses = () => {
    if (!isReviewMode || !originalReview) return '';

    if (canReattempt && reviewAttempt !== null) {
      return isCorrectOnReview
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-red-500/10 border-red-500/30';
    }

    if (wasOmitted) return 'bg-yellow-500/10 border-yellow-500/30';
    if (isCorrectOnOriginal) return 'bg-green-500/10 border-green-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };
  
  const displayCorrectAnswer = showAnswer || (canReattempt && isCorrectOnReview) || isCorrectOnOriginal;

  return (
    <div
      key={qNum}
      className={cn(
        'flex items-center justify-between rounded-lg border p-3 transition-colors',
        getReviewColorClasses()
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
              onClick={() => canReattempt ? handleReviewAnswerSelect(choice) : onAnswerSelect(qNum, choice)}
              disabled={isReviewMode && !canReattempt}
            >
              {choice}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isReviewMode && originalReview ? (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={markedQuestions[qNum] ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => onMarkQuestion(qNum)}
                  >
                    <Flag className={cn('h-4 w-4', markedQuestions[qNum] && 'text-primary fill-primary')} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Mark for Review</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {canReattempt && !isCorrectOnReview && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button variant="ghost" size="icon" onClick={() => setShowAnswer(!showAnswer)}>
                      {showAnswer ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{showAnswer ? 'Hide' : 'Show'} Correct Answer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <div className="text-right text-sm font-bold min-w-28">
              {canReattempt && reviewAttempt !== null ? (
                isCorrectOnReview ? (
                  <>
                    <span className="text-green-400">Correct!</span>
                    <div className="text-muted-foreground">Ans: {getCorrectAnswerText(originalReview.correctAnswer)}</div>
                  </>
                ) : (
                  <>
                    <span className="text-red-400">Incorrect</span>
                    {displayCorrectAnswer && <div className="text-muted-foreground">Ans: {getCorrectAnswerText(originalReview.correctAnswer)}</div>}
                  </>
                )
              ) : wasOmitted ? (
                <>
                  <span className="text-yellow-400">Omitted</span>
                  {displayCorrectAnswer && <div className="text-muted-foreground">Ans: {getCorrectAnswerText(originalReview.correctAnswer)}</div>}
                </>
              ) : isCorrectOnOriginal ? (
                 <>
                    <span className="text-green-400">Correct</span>
                    <div className="text-muted-foreground">Ans: {getCorrectAnswerText(originalReview.correctAnswer)}</div>
                 </>
              ) : (
                <>
                  <span className="text-red-400">Incorrect</span>
                  {displayCorrectAnswer && (
                    <div className="text-muted-foreground">
                      {`You: ${originalReview.userAnswer} | Ans: ${getCorrectAnswerText(originalReview.correctAnswer)}`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAnswerSelect(qNum, null)}
            disabled={!userAnswer}
            className="h-8"
          >
            Clear
          </Button>
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
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
