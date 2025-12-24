
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
import { PDFDisplay } from './PDFDisplay';
import { Ti84Calculator } from './Ti84Calculator';

// --- Draggable Divider Logic ---

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

// --- Main Arena Component ---

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
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [hasCalculatorBeenOpened, setHasCalculatorBeenOpened] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [hasSolutionBeenOpened, setHasSolutionBeenOpened] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const [currentSubmissionId, setCurrentSubmissionId] = useState(submissionIdProp);
  const [isReviewMode, setIsReviewMode] = useState(isReviewFromHistoryProp);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const isStatsTest = test.division === 'Stats';

  useEffect(() => {
    setIsClient(true);
  }, []);

  const createReviewData = useCallback((
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
  }, []);

  useEffect(() => {
    if (isReviewFromHistoryProp && solution && initialAnswers && user && submissionIdProp) {
      const report = gradeTest(initialAnswers, solution.answers);
      const newReviewData = createReviewData(initialAnswers, solution.answers);
      setReviewData(newReviewData);
      setScoreReport(report);
      setUserAnswers(initialAnswers);
      setIsScoreModalOpen(false);
      const savedMarks = getReviewMarks(user.uid, submissionIdProp);
      setMarkedQuestions(savedMarks);
      setCurrentSubmissionId(submissionIdProp);
      setIsReviewMode(true);

    } else if (user) {
      const savedProgress = getInProgressAnswers(user.uid, test.id);
      if (savedProgress) {
        setUserAnswers(savedProgress);
      } else {
        setUserAnswers({});
      }
      const savedFlags = getInProgressFlags(user.uid, test.id);
      setMarkedQuestions(savedFlags);
      setReviewData(null);
      setScoreReport(null);
      setCurrentSubmissionId(undefined);
      setIsReviewMode(false);
    }
  }, [isReviewFromHistoryProp, solution, initialAnswers, user, test.id, submissionIdProp, createReviewData]);


  useEffect(() => {
    if (user && !isReviewMode) {
      saveInProgressAnswers(user.uid, test.id, userAnswers);
    }
  }, [userAnswers, user, test.id, isReviewMode]);
  
  useEffect(() => {
      if (user && currentSubmissionId && isReviewMode) {
          saveReviewMarks(user.uid, currentSubmissionId, markedQuestions);
      }
      if (user && !isReviewMode) {
          saveInProgressFlags(user.uid, test.id, markedQuestions);
      }
  }, [markedQuestions, user, currentSubmissionId, isReviewMode, test.id]);

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
    setMarkedQuestions(prev => {
        const newMarks = {...prev};
        if (newMarks[question]) {
            delete newMarks[question];
        } else {
            newMarks[question] = true;
        }
        return newMarks;
    });
  };

  const handleSubmit = async () => {
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
    const newSubmissionId = await saveSubmission(firestore, user.uid, test, userAnswers, report, markedQuestions);
    
    if (newSubmissionId) {
        clearInProgressAnswers(user.uid, test.id);
        clearInProgressFlags(user.uid, test.id);
        toast({
          title: 'Success!',
          description: 'Your test results have been saved.',
        });

        const newReviewData = createReviewData(userAnswers, solution.answers);
        setReviewData(newReviewData);
        setScoreReport(report);
        setIsScoreModalOpen(true);
        setIsReviewMode(true);
        setCurrentSubmissionId(newSubmissionId);
        // The `markedQuestions` from the session are now the review marks for this submission.
    }
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newX = e.clientX - containerRect.left;
        let newPosition = (newX / containerRect.width) * 100;
        
        // Constrain the divider position
        newPosition = Math.max(20, Math.min(newPosition, 80)); 

        setDividerPosition(newPosition);
    }
  }, [isDragging]);

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
       {isStatsTest && (
        <Button 
          variant={showCalculator ? "secondary" : "outline"} 
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
                    Once you submit, you will not be able to change your answers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <>
              {solution && (
                 <Button 
                    variant={showSolution ? "secondary" : "outline"}
                    onClick={handleToggleSolution}
                  >
                   <BookOpenCheck className="mr-2 h-4 w-4" />
                   {showSolution ? 'Hide Solutions' : 'Show Solutions'}
                 </Button>
              )}
              {scoreReport && ( 
                <Button variant="outline" onClick={() => setIsScoreModalOpen(true)}>
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

  const mainContent = (
    <div 
        ref={containerRef}
        className={cn(
            "relative flex h-full w-full overflow-hidden"
        )}
    >
        {isDragging && <div className="absolute inset-0 z-20" />}
        
        <div 
          className="relative h-full"
          style={{ width: `${dividerPosition}%`}}
        >
          <PDFDisplay url={test.url} />
        </div>

        <DraggableDivider onMouseDown={handleMouseDown} />
        
        <div 
          className="relative h-full"
          style={{ width: `calc(100% - ${dividerPosition}%)`}}
        >
            <div className="flex h-full w-full">
                {hasSolutionBeenOpened && solution ? (
                    <div 
                        className={cn(
                            "relative h-full transition-all duration-300",
                            showSolution ? 'w-1/2' : 'w-0'
                        )}
                    >
                       <PDFDisplay url={solution.url}/>
                    </div>
                ) : null}
                <div 
                    className={cn(
                        "relative h-full transition-all duration-300",
                        showSolution ? 'w-1/2' : 'w-full'
                    )}
                >
                    <Scantron
                        userAnswers={userAnswers}
                        onAnswerSelect={handleAnswerSelect}
                        reviewData={reviewData}
                        markedQuestions={markedQuestions}
                        onMarkQuestion={handleMarkQuestion}
                    />
                </div>
            </div>
        </div>
    </div>
);



  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-background">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b px-4">
            <h2 className="text-xl font-bold tracking-tight">{test.division}: {test.year} {test.month} {test.test_type}</h2>
            {headerActions}
        </header>
        <div className="flex-1 overflow-hidden relative">
          {mainContent}
          {hasCalculatorBeenOpened && isStatsTest && (
              <div className={cn(
                "absolute top-0 right-0 h-full w-[33%] border-l bg-background transition-transform duration-300",
                showCalculator ? 'translate-x-0' : 'translate-x-full'
                )}>
                  <Ti84Calculator />
              </div>
          )}
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
