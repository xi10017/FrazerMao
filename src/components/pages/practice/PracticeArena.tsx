
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Calculator,
  BookOpenCheck,
  Expand,
  Shrink,
} from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
const TIMER_DURATION_SECONDS = 3600;

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
  const [checkedQuestions, setCheckedQuestions] = useState<{
    [key: number]: true;
  }>({});
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hasCalculatorBeenOpened, setHasCalculatorBeenOpened] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [hasSolutionBeenOpened, setHasSolutionBeenOpened] = useState(false);
  const [timerState, setTimerState] = useState<TimerState>({
    timeRemaining: TIMER_DURATION_SECONDS,
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
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [solutionDividerPosition, setSolutionDividerPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingSolution, setIsDraggingSolution] = useState(false);
  const [isScantronCollapsed, setIsScantronCollapsed] = useState(false);


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
  }, [
    solution,
    user,
    firestore,
    test,
    userAnswers,
    markedQuestions,
    toast,
    createReviewData,
  ]);

  // Effect to initialize the arena for either review or practice mode
  useEffect(() => {
    if (!user) return;

    // REVIEW MODE: Triggered by props from Next.js router
    if (
      isReviewFromHistoryProp &&
      solution &&
      initialAnswers &&
      submissionIdProp
    ) {
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
      setMarkedQuestions(savedFlags || {});
      if (savedTimerState) {
        setTimerState(savedTimerState);
      } else {
        setTimerState({
          timeRemaining: TIMER_DURATION_SECONDS,
          isRunning: false,
        });
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

  const handleMarkQuestion = (question: number, note: string) => {
    setMarkedQuestions((prev) => ({ ...prev, [question]: note }));
  };

  const handleUnmarkQuestion = (question: number) => {
    setMarkedQuestions((prev) => {
      const newMarks = { ...prev };
      delete newMarks[question];
      return newMarks;
    });
  };

  const handleCheckQuestion = useCallback(
    (question: number) => {
      if (!solution) return;
      // Always create a fresh `reviewData` from the latest `userAnswers`
      // This solves the stale state issue.
      setReviewData(createReviewData(userAnswers, solution.answers));
      setCheckedQuestions((prev) => ({ ...prev, [question]: true }));
    },
    [userAnswers, solution, createReviewData] // Dependency on userAnswers ensures it's up-to-date
  );

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

  const isPracticeMode = !isReviewMode;
  const isSubmittable = Object.keys(userAnswers).length > 0;

  // --- Main Divider Dragging Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current && !isScantronCollapsed) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = e.clientX - containerRect.left;
        let newPosition = (newX / containerRect.width) * 100;
        newPosition = Math.max(20, Math.min(newPosition, 80));
        setDividerPosition(newPosition);
      }
    },
    [isDragging, isScantronCollapsed]
  );

  // --- Solution Divider Dragging Logic ---
  const handleSolutionMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSolution(true);
  };

  const handleSolutionMouseUp = useCallback(() => {
    setIsDraggingSolution(false);
  }, []);

  const handleSolutionMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDraggingSolution && leftPanelRef.current) {
        const containerRect = leftPanelRef.current.getBoundingClientRect();
        const newX = e.clientX - containerRect.left;
        let newPosition = (newX / containerRect.width) * 100;
        newPosition = Math.max(20, Math.min(newPosition, 80));
        setSolutionDividerPosition(newPosition);
      }
    },
    [isDraggingSolution]
  );

  // General event listener effect for both dividers
  useEffect(() => {
    const mm = isDragging ? handleMouseMove : handleSolutionMouseMove;
    const mu = isDragging ? handleMouseUp : handleSolutionMouseUp;

    if (isDragging || isDraggingSolution) {
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    }
    return () => {
      document.removeEventListener('mousemove', mm);
      document.removeEventListener('mouseup', mu);
    };
  }, [
    isDragging,
    isDraggingSolution,
    handleMouseMove,
    handleMouseUp,
    handleSolutionMouseMove,
    handleSolutionMouseUp,
  ]);

  const headerActions = (
    <div className="flex items-center gap-2">
      {isPracticeMode && isClient && (
        <Timer
          duration={TIMER_DURATION_SECONDS}
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
            {(isDragging || isDraggingSolution) && (
              <div className="absolute inset-0 z-20" />
            )}
            {/* Main Content Area */}
            <div
              className="relative h-full transition-all duration-300"
              style={{
                width:
                  isStatsTest && showCalculator ? 'calc(100% - 33%)' : '100%',
              }}
            >
              <div className="relative flex h-full w-full">
                {/* Left Panel: Contains Test and (optional) Solution */}
                <div
                  ref={leftPanelRef}
                  className="relative flex h-full"
                  style={{
                    width: isScantronCollapsed
                      ? '100%'
                      : `${dividerPosition}%`,
                  }}
                >
                  {/* Panel for Test and Solution */}
                  <div className="relative h-full w-full overflow-hidden">
                    {/* Test PDF - slides to the left */}
                    <div
                      className="absolute top-0 left-0 h-full transition-all duration-500 ease-in-out"
                       style={{
                        width: showSolution ? `${solutionDividerPosition}%` : '100%',
                      }}
                    >
                      <div className="relative h-full w-full">
                         <div className="absolute top-2 left-2 z-10">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 bg-background/50 hover:bg-background/80"
                                  onClick={() => setIsScantronCollapsed(!isScantronCollapsed)}
                                >
                                  {isScantronCollapsed ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{isScantronCollapsed ? 'Show Scantron' : 'Collapse Scantron'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <PDFDisplay url={test.url} />
                      </div>
                    </div>

                    {/* Solution PDF - slides in from the right of the test */}
                    {isReviewMode && solution && (
                       <div
                        className="absolute top-0 right-0 h-full flex transition-transform duration-500 ease-in-out"
                        style={{
                          width: `calc(100% - ${solutionDividerPosition}%)`,
                          transform: showSolution ? 'translateX(0)' : 'translateX(100%)',
                          zIndex: 5,
                        }}
                      >
                        <DraggableDivider onMouseDown={handleSolutionMouseDown} />
                        <div className="h-full w-full overflow-hidden">
                            <PDFDisplay url={solution.url} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {!isScantronCollapsed && (
                  <>
                    <DraggableDivider onMouseDown={handleMouseDown} />
                    {/* Right Panel: Scantron */}
                    <div
                      className="relative h-full"
                      style={{ width: `calc(100% - ${dividerPosition}%)` }}
                    >
                      <Scantron
                        userAnswers={userAnswers}
                        onAnswerSelect={handleAnswerSelect}
                        reviewData={reviewData}
                        markedQuestions={markedQuestions}
                        onMarkQuestion={handleMarkQuestion}
                        onUnmarkQuestion={handleUnmarkQuestion}
                        checkedQuestions={checkedQuestions}
                        onCheckQuestion={handleCheckQuestion}
                        isReviewMode={isReviewMode}
                        hideCheckWarning={hideCheckWarning}
                        onSetHideCheckWarning={handleSetHideCheckWarning}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Calculator Panel */}
            {hasCalculatorBeenOpened && isStatsTest && (
              <div
                className={cn(
                  'bg-background transition-all duration-300',
                  showCalculator ? 'w-[33%]' : 'w-0'
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
    
    
