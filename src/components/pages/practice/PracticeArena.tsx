'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, BookOpenCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  FamatTest,
  FamatSolution,
  UserAnswers,
  ScoreReport,
  ReviewData,
  MarkedQuestions,
  TimerState,
} from '@/lib/types';
import { Scantron } from './Scantron';
import { Button } from '@/components/ui/button';
import { ScoreModal } from './ScoreModal';
import { gradeTest } from '@/lib/test-logic';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import {
  saveSubmission,
  getInProgressAnswers,
  saveInProgressAnswers,
  clearInProgressAnswers,
  getReviewMarks,
  saveReviewMarks,
  getInProgressFlags,
  saveInProgressFlags,
  clearInProgressFlags,
  getTimerState,
  saveTimerState,
  clearTimerState,
} from '@/lib/user-data';
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
import { PDFDisplay } from './PDFDisplay';
import { Ti84Calculator } from './Ti84Calculator';
import { Timer } from './Timer';

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

const HIDE_CHECK_WARNING_KEY = 'hideCheckAnswerWarning';
const ONE_HOUR_IN_SECONDS = 3600;

interface PracticeArenaProps {
  test: FamatTest;
  solution?: FamatSolution;
  initialAnswers?: UserAnswers;
  isReviewFromHistory?: boolean;
  submissionId?: string;
}

const PracticeArena: React.FC<PracticeArenaProps> = ({
  test,
  solution,
  initialAnswers,
  isReviewFromHistory: isReviewFromHistoryProp,
  submissionId: submissionIdProp,
}) => {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [markedQuestions, setMarkedQuestions] = useState<MarkedQuestions>({});
  const [checkedQuestions, setCheckedQuestions] = useState<MarkedQuestions>({});
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hasCalculatorBeenOpened, setHasCalculatorBeenOpened] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [hasSolutionBeenOpened, setHasSolutionBeenOpened] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>({
    timeRemaining: ONE_HOUR_IN_SECONDS,
    isRunning: false,
  });

  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [currentSubmissionId, setCurrentSubmissionId] =
    useState(submissionIdProp);
  const [isReviewMode, setIsReviewMode] = useState(isReviewFromHistoryProp);

  const [hideCheckWarning, setHideCheckWarning] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const isStatsTest = test.division === 'Stats';

  useEffect(() => {
    setIsClient(true);
    const storedPreference = localStorage.getItem(HIDE_CHECK_WARNING_KEY);
    setHideCheckWarning(storedPreference === 'true');
  }, []);

  const createReviewData = useCallback(
    (
      answers: UserAnswers,
      correctAnswers: (string | string[])[]
    ): ReviewData => {
      const data: ReviewData = {};
      for (let i = 0; i < correctAnswers.length; i++) {
        const qNum = i + 1;
        const userAnswer = answers[qNum];
        const correctAnswer = correctAnswers[i];
        let isCorrect = false;
        if (userAnswer) {
          isCorrect = Array.isArray(correctAnswer)
            ? correctAnswer.includes(userAnswer)
            : userAnswer === correctAnswer;
        }

        data[qNum] = {
          userAnswer,
          correctAnswer,
          isCorrect,
        };
      }
      return data;
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!solution) {
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Cannot grade test as no solution is available.',
      });
      return;
    }

    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Not Signed In',
        description: 'You must be signed in to submit a test.',
      });
      return;
    }

    const report = gradeTest(userAnswers, solution.answers);
    const newSubmissionId = await saveSubmission(
      firestore,
      user.uid,
      test,
      userAnswers,
      report,
      markedQuestions
    );

    if (newSubmissionId) {
      clearInProgressAnswers(user.uid, test.id);
      clearInProgressFlags(user.uid, test.id);
      clearTimerState(user.uid, test.id);
      toast({
        title: 'Success!',
        description: 'Your test results have been saved.',
      });

      // Transition to review mode
      const newReviewData = createReviewData(userAnswers, solution.answers);
      setReviewData(newReviewData);
      setScoreReport(report);
      setIsScoreModalOpen(true);
      setIsReviewMode(true);
      setCurrentSubmissionId(newSubmissionId);
      setCheckedQuestions({});
    }
  }, [solution, user, firestore, test, userAnswers, markedQuestions, toast, createReviewData]);


  // Effect to initialize the arena for either review or practice mode
  useEffect(() => {
    if (!user) return;

    // REVIEW MODE: Triggered by props from Next.js router
    if (isReviewFromHistoryProp && solution && initialAnswers && submissionIdProp) {
      const report = gradeTest(initialAnswers, solution.answers);
      const newReviewData = createReviewData(initialAnswers, solution.answers);
      const savedMarks = getReviewMarks(user.uid, submissionIdProp);

      setScoreReport(report);
      setReviewData(newReviewData);
      setUserAnswers(initialAnswers);
      setMarkedQuestions(savedMarks);
      setCurrentSubmissionId(submissionIdProp);
      setIsReviewMode(true);
      setIsScoreModalOpen(false); // Don't show score modal on re-entry
    }
    // PRACTICE MODE: Default mode
    else {
      const savedProgress = getInProgressAnswers(user.uid, test.id);
      const savedFlags = getInProgressFlags(user.uid, test.id);
      const savedTimerState = getTimerState(user.uid, test.id);

      setUserAnswers(savedProgress || {});
      setMarkedQuestions(savedFlags);
      if (savedTimerState) {
          setTimerState(savedTimerState);
      } else {
          setTimerState({ timeRemaining: ONE_HOUR_IN_SECONDS, isRunning: false });
      }

      setReviewData(null);
      setScoreReport(null);
      setCurrentSubmissionId(undefined);
      setIsReviewMode(false);
      setCheckedQuestions({});
    }
  }, [
    user,
    test.id,
    isReviewFromHistoryProp,
    submissionIdProp,
    initialAnswers,
    solution,
    createReviewData,
  ]);

  // Effect to save progress (answers or marks) to localStorage
  useEffect(() => {
    if (!user || !isClient) return;

    if (isReviewMode && currentSubmissionId) {
      // In review mode, save any changes to review marks
      saveReviewMarks(user.uid, currentSubmissionId, markedQuestions);
    } else {
      // In practice mode, save answers and flags
      saveInProgressAnswers(user.uid, test.id, userAnswers);
      saveInProgressFlags(user.uid, test.id, markedQuestions);
    }
  }, [
    userAnswers,
    markedQuestions,
    user,
    test.id,
    isReviewMode,
    currentSubmissionId,
    isClient,
  ]);

    // Effect to save timer state to localStorage, only when it changes
  useEffect(() => {
    if (!user || !isClient || isReviewMode) return;
    saveTimerState(user.uid, test.id, timerState);
  }, [timerState, user, test.id, isClient, isReviewMode]);

  const handleAnswerSelect = (question: number, answer: string | null) => {
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

  const handleMarkQuestion = (question: number) => {
    setMarkedQuestions((prev) => {
      const newMarks = { ...prev };
      if (newMarks[question]) {
        delete newMarks[question];
      } else {
        newMarks[question] = true;
      }
      return newMarks;
    });
  };
  
  const handleCheckQuestion = useCallback((question: number) => {
    if (!solution) return;
    const correctAnswers = solution.answers;
    const review = createReviewData(userAnswers, correctAnswers);
    setReviewData(review);

    setCheckedQuestions((prev) => ({ ...prev, [question]: true }));
  }, [userAnswers, solution, createReviewData]);

 const handleSetHideCheckWarning = (hide: boolean) => {
    localStorage.setItem(HIDE_CHECK_WARNING_KEY, String(hide));
    setHideCheckWarning(hide);
  };

  const handleBackToLibrary = () => {
    router.push(`/`);
  };

  const handleToggleCalculator = () => {
    if (!hasCalculatorBeenOpened) {
      setHasCalculatorBeenOpened(true);
    }
    setShowCalculator(!showCalculator);
  };

  const handleToggleSolution = () => {
    if (!hasSolutionBeenOpened) {
      setHasSolutionBeenOpened(true);
    }
    setShowSolution(!showSolution);
  };
  
  const handleTimerToggle = () => {
      setTimerState(prev => ({...prev, isRunning: !prev.isRunning}));
  }

  const handleTimerTick = (newTime: number) => {
    setTimerState(prev => ({...prev, timeRemaining: newTime}));
  }

  const isPracticeMode = !isReviewMode;
  const isSubmittable = Object.keys(userAnswers).length > 0;

  // --- Dragging Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = e.clientX - containerRect.left;
        let newPosition = (newX / containerRect.width) * 100;

        // Constrain the divider position
        newPosition = Math.max(20, Math.min(newPosition, 80));

        setDividerPosition(newPosition);
      }
    },
    [isDragging]
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const headerActions = (
    <div className="flex items-center gap-2">
      {isPracticeMode && isClient && (
        <Timer
          duration={ONE_HOUR_IN_SECONDS}
          initialTimeRemaining={timerState.timeRemaining}
          initialIsRunning={timerState.isRunning}
          onStateChange={setTimerState}
        />
      )}
      {isStatsTest && (
        <Button
          variant={showCalculator ? 'secondary' : 'outline'}
          onClick={handleToggleCalculator}
        >
          <Calculator className="mr-2 h-4 w-4" />
          Calculator
        </Button>
      )}
      {isClient && (
        <>
          {isPracticeMode ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!isSubmittable}>Submit Test</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Once you submit, you will not be able to change your
                    answers.
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
              {solution && (
                <Button
                  variant={showSolution ? 'secondary' : 'outline'}
                  onClick={handleToggleSolution}
                >
                  <BookOpenCheck className="mr-2 h-4 w-4" />
                  {showSolution ? 'Hide Solutions' : 'Show Solutions'}
                </Button>
              )}
              {scoreReport && (
                <Button
                  variant="outline"
                  onClick={() => setIsScoreModalOpen(true)}
                >
                  Review Score
                </Button>
              )}
              <Button onClick={handleBackToLibrary}>Back to Library</Button>
            </>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-background">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b px-4">
          <h2 className="text-xl font-bold tracking-tight">
            {test.division}: {test.year} {test.month} {test.test_type}
          </h2>
          {headerActions}
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div
            ref={containerRef}
            className={cn('relative flex h-full flex-1 overflow-hidden')}
          >
            {isDragging && <div className="absolute inset-0 z-20" />}
            {/* Main Content Area */}
            <div
              className="relative h-full transition-all duration-300"
              style={{
                width:
                  isStatsTest && showCalculator
                    ? 'calc(100% - 33%)'
                    : '100%',
              }}
            >
              <div className="relative flex h-full w-full">
                {/* Test PDF Panel */}
                <div
                  className="relative h-full"
                  style={{ width: `${dividerPosition}%` }}
                >
                  <PDFDisplay url={test.url} />
                </div>

                <DraggableDivider onMouseDown={handleMouseDown} />

                {/* Right side containing Scantron and Solution */}
                <div
                  className="relative h-full"
                  style={{ width: `calc(100% - ${dividerPosition}%)` }}
                >
                  <div className="flex h-full w-full">
                    {/* Solution Panel - always mounted after first open */}
                    {hasSolutionBeenOpened && solution && (
                      <div
                        className={cn(
                          'relative h-full transition-all duration-300',
                          showSolution ? 'w-1/2' : 'w-0'
                        )}
                      >
                        <PDFDisplay url={solution.url} />
                      </div>
                    )}
                    {/* Scantron Panel */}
                    <div
                      className={cn(
                        'relative h-full transition-all duration-300',
                        hasSolutionBeenOpened && showSolution
                          ? 'w-1/2'
                          : 'w-full'
                      )}
                    >
                      <Scantron
                        userAnswers={userAnswers}
                        onAnswerSelect={handleAnswerSelect}
                        reviewData={reviewData}
                        markedQuestions={markedQuestions}
                        onMarkQuestion={handleMarkQuestion}
                        checkedQuestions={checkedQuestions}
                        onCheckQuestion={handleCheckQuestion}
                        isReviewMode={isReviewMode}
                        hideCheckWarning={hideCheckWarning}
                        onSetHideCheckWarning={handleSetHideCheckWarning}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Calculator Panel */}
            {hasCalculatorBeenOpened && isStatsTest && (
              <div
                className={cn(
                  'bg-background transition-all duration-300',
                  showCalculator ? 'w-[33%] border-l' : 'w-0'
                )}
              >
                <Ti84Calculator />
              </div>
            )}
          </div>
        </div>
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
