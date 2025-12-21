'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  FamatTest,
  FamatSolution,
  UserAnswers,
  ScoreReport,
  ReviewData,
} from '@/lib/types';
import { Scantron } from './Scantron';
import { Button } from '@/components/ui/button';
import { ScoreModal } from './ScoreModal';
import { gradeTest } from '@/lib/test-logic';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import {
  saveSubmission,
  getInProgressAnswers,
  saveInProgressAnswers,
  clearInProgressAnswers,
} from '@/lib/localStorage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { PDFViewer } from './PDFViewer';

interface PracticeArenaProps {
  test: FamatTest;
  solution?: FamatSolution;
  initialAnswers?: UserAnswers;
  isReviewFromHistory?: boolean;
}

const PracticeArena: React.FC<PracticeArenaProps> = ({
  test,
  solution,
  initialAnswers,
  isReviewFromHistory,
}) => {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [isClient, setIsClient] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isReviewFromHistory && solution && initialAnswers) {
      const report = gradeTest(initialAnswers, solution.answers);
      const newReviewData = createReviewData(initialAnswers, solution.answers);
      setReviewData(newReviewData);
      setScoreReport(report);
      setUserAnswers(initialAnswers);
      setIsScoreModalOpen(false); // Don't show modal when reviewing from history
    } else if (user) {
      const savedProgress = getInProgressAnswers(user.uid, test.id);
      if (savedProgress) {
        setUserAnswers(savedProgress);
      } else {
        setUserAnswers({}); // ensure it's a clean slate
      }
      setReviewData(null);
      setScoreReport(null);
    }
  }, [isReviewFromHistory, solution, initialAnswers, user, test.id]);

  useEffect(() => {
    // Only save progress if we are in practice mode (not reviewing)
    if (user && reviewData === null) {
      saveInProgressAnswers(user.uid, test.id, userAnswers);
    }
  }, [userAnswers, user, test.id, reviewData]);

  const createReviewData = (
    answers: UserAnswers,
    correctAnswers: string[]
  ): ReviewData => {
    const data: ReviewData = {};
    for (let i = 0; i < correctAnswers.length; i++) {
      const qNum = i + 1;
      const userAnswer = answers[qNum];
      const correctAnswer = correctAnswers[i];
      data[qNum] = {
        userAnswer,
        correctAnswer,
        isCorrect: userAnswer === correctAnswer,
      };
    }
    return data;
  };

  const handleAnswerSelect = (question: number, answer: string | null) => {
    if (reviewData) return; // Disallow changes in review mode
    setUserAnswers((prev) => {
      const newAnswers = { ...prev };
      if (answer === null) {
        delete newAnswers[question];
      } else {
        newAnswers[question] = answer;
      }
      return newAnswers;
    });
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    setter: React.Dispatch<React.SetStateAction<number>>
  ) => {
    e.preventDefault();
    const startX = e.clientX;
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const initialPosition = dividerPosition;
    const startWidth = containerWidth * (initialPosition / 100);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const newWidth = startWidth + dx;
      const newPosition = (newWidth / containerWidth) * 100;
      setter(Math.max(20, Math.min(80, newPosition)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleSubmit = () => {
    if (!solution) {
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Cannot grade test as no solution is available.',
      });
      return;
    }

    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Signed In',
        description: 'You must be signed in to submit a test.',
      });
      return;
    }

    const report = gradeTest(userAnswers, solution.answers);
    saveSubmission(user.uid, test, userAnswers, report);
    clearInProgressAnswers(user.uid, test.id);

    toast({
      title: 'Success!',
      description: 'Your test results have been saved.',
    });

    const newReviewData = createReviewData(userAnswers, solution.answers);
    setReviewData(newReviewData);
    setScoreReport(report);
    setIsScoreModalOpen(true);
  };

  const handleBackToLibrary = () => {
    router.push(`/`);
  };

  const DraggableDivider: React.FC<{
    onMouseDown: (e: React.MouseEvent) => void;
  }> = ({ onMouseDown }) => (
    <div
      onMouseDown={onMouseDown}
      className="group h-full w-2 cursor-col-resize bg-border/50 transition hover:bg-primary"
    >
      <div className="mx-auto h-full w-0.5 bg-transparent group-hover:bg-primary-foreground"></div>
    </div>
  );

  const isPracticeMode = reviewData === null;
  const isSubmittable = Object.keys(userAnswers).length > 0;
  
  return (
    <>
      <div
        ref={containerRef}
        className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background"
      >
        <div
          className={cn(
            'relative h-full transition-all duration-300',
            isPdfFullScreen && 'w-full'
          )}
          style={{ width: isPdfFullScreen ? '100%' : `${dividerPosition}%` }}
        >
          <PDFViewer url={test.url} />
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 right-4 bg-background/50 hover:bg-background/80"
            onClick={() => setIsPdfFullScreen(!isPdfFullScreen)}
          >
            {isPdfFullScreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>

        {!isPdfFullScreen && (
          <>
            <DraggableDivider
              onMouseDown={(e) => handleMouseDown(e, setDividerPosition)}
            />
            <div className="h-full flex-1">
              <Scantron
                userAnswers={userAnswers}
                onAnswerSelect={handleAnswerSelect}
                reviewData={reviewData}
                headerContent={
                  <div className="flex items-center gap-2">
                    {isClient && (
                      <>
                        {isPracticeMode ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button disabled={!isSubmittable}>
                                Submit Test
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Are you sure?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Once you submit, you will not be able to
                                  change your answers.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSubmit}>
                                  Submit
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setIsScoreModalOpen(true)}
                            >
                              Review Score
                            </Button>
                            <Button onClick={handleBackToLibrary}>
                              Back to Library
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                }
              />
            </div>
          </>
        )}
      </div>

      {scoreReport && (
        <ScoreModal
          isOpen={isScoreModalOpen}
          onClose={() => setIsScoreModalOpen(false)}
          scoreReport={scoreReport}
        />
      )}
    </>
  );
};

export default PracticeArena;
