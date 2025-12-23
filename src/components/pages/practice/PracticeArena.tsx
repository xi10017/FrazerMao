

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, Maximize, Minimize, BookOpenCheck } from 'lucide-react';
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

// --- Multi-Panel Layout Logic ---

interface MultiPanelLayoutProps {
    panels: React.ReactNode[];
    isPdfFullScreen: boolean;
}

const MultiPanelLayout: React.FC<MultiPanelLayoutProps> = ({ panels, isPdfFullScreen }) => {
    const numPanels = panels.length;
    const initialPositions = Array.from({ length: numPanels - 1 }, (_, i) => (100 / numPanels) * (i + 1));
    
    const [isDragging, setIsDragging] = useState<number | null>(null);
    const [positions, setPositions] = useState(initialPositions);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Recalculate positions when the number of panels changes
        setPositions(Array.from({ length: numPanels - 1 }, (_, i) => (100 / numPanels) * (i + 1)));
    }, [numPanels]);

    const handleMouseDown = (dividerIndex: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(dividerIndex);
    };

    const handleMouseUp = useCallback(() => {
        setIsDragging(null);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging === null || !containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const newX = e.clientX - containerRef.current.getBoundingClientRect().left;
        let newPosition = (newX / containerWidth) * 100;

        const MIN_WIDTH = 10; // Minimum 10% width for a panel

        const leftBoundary = isDragging > 0 ? positions[isDragging - 1] + MIN_WIDTH : MIN_WIDTH;
        const rightBoundary = isDragging < numPanels - 2 ? positions[isDragging + 1] - MIN_WIDTH : 100 - MIN_WIDTH;
        
        newPosition = Math.max(leftBoundary, Math.min(newPosition, rightBoundary));
        
        setPositions(prev => {
            const newPositions = [...prev];
            newPositions[isDragging] = newPosition;
            return newPositions;
        });

    }, [isDragging, positions, numPanels]);

    useEffect(() => {
        if (isDragging !== null) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);
    
    const panelWidths = positions.map((pos, i) => {
        const prevPos = i > 0 ? positions[i - 1] : 0;
        return pos - prevPos;
    });
    if (positions.length > 0) {
        panelWidths.push(100 - positions[positions.length - 1]);
    } else if (numPanels === 1) {
        panelWidths.push(100);
    }
    
    return (
         <div ref={containerRef} className="flex h-full w-full overflow-hidden">
            {isDragging !== null && <div className="absolute inset-0 z-20" />}
            {panels.map((panel, index) => (
                <React.Fragment key={index}>
                    <div 
                      style={{ width: isPdfFullScreen && index > 0 ? '0%' : isPdfFullScreen && index === 0 ? '100%' : `${panelWidths[index]}%` }} 
                      className={cn("relative h-full transition-all duration-300", isPdfFullScreen && index > 0 && "p-0")}
                    >
                        {panel}
                    </div>
                    {index < panels.length - 1 && (
                        <div className={cn("transition-all duration-300", isPdfFullScreen ? 'w-0' : 'w-2')}>
                            <DraggableDivider onMouseDown={handleMouseDown(index)} />
                        </div>
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

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
  
  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // The component can be in review mode either from prop (history page) or after submission.
  // We also need to track the submissionId for saving marks.
  const [currentSubmissionId, setCurrentSubmissionId] = useState(submissionIdProp);
  const [isReviewMode, setIsReviewMode] = useState(isReviewFromHistoryProp);


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
      setIsScoreModalOpen(false); // Don't show score modal when reviewing from history
      // Load marked questions
      const savedMarks = getReviewMarks(user.uid, submissionIdProp);
      setMarkedQuestions(savedMarks);
      
      // Set the state for review mode
      setCurrentSubmissionId(submissionIdProp);
      setIsReviewMode(true);

    } else if (user) {
      const savedProgress = getInProgressAnswers(user.uid, test.id);
      if (savedProgress) {
        setUserAnswers(savedProgress);
      } else {
        setUserAnswers({});
      }
      setReviewData(null);
      setScoreReport(null);
      setMarkedQuestions({});
      setCurrentSubmissionId(undefined);
      setIsReviewMode(false);
    }
  }, [isReviewFromHistoryProp, solution, initialAnswers, user, test.id, submissionIdProp, createReviewData]);


  useEffect(() => {
    // Only save progress if not in review mode
    if (user && !isReviewMode) {
      saveInProgressAnswers(user.uid, test.id, userAnswers);
    }
  }, [userAnswers, user, test.id, isReviewMode]);
  
  // Save marked questions whenever they change, but only in review mode with a valid submission ID.
  useEffect(() => {
      if (user && currentSubmissionId && isReviewMode) {
          saveReviewMarks(user.uid, currentSubmissionId, markedQuestions);
      }
  }, [markedQuestions, user, currentSubmissionId, isReviewMode]);


  const handleAnswerSelect = (question: number, answer: string | null) => {
    if (isReviewMode) return;
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
    if (!isReviewMode) return;
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
    const newSubmissionId = await saveSubmission(firestore, user.uid, test, userAnswers, report);
    
    if (newSubmissionId) {
        clearInProgressAnswers(user.uid, test.id);
        toast({
          title: 'Success!',
          description: 'Your test results have been saved.',
        });

        const newReviewData = createReviewData(userAnswers, solution.answers);
        setReviewData(newReviewData);
        setScoreReport(report);
        setIsScoreModalOpen(true);
        
        // Transition to review mode for the new submission
        setIsReviewMode(true);
        setCurrentSubmissionId(newSubmissionId);
        // We can now view the submission without a full redirect
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

  const isPracticeMode = !isReviewMode;
  const isSubmittable = Object.keys(userAnswers).length > 0;
  
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
                    onClick={() => setShowSolution(!showSolution)}
                  >
                   <BookOpenCheck className="mr-2 h-4 w-4" />
                   {showSolution ? 'Hide Solution' : 'Show Solution'}
                 </Button>
              )}
              {scoreReport && ( // Only show if score is available
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
  
  const testPdfPanel = (
    <div className="relative h-full w-full">
        <PDFDisplay url={test.url} />
        <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 z-40 bg-background/50 hover:bg-background/80"
            onClick={() => setIsPdfFullScreen(!isPdfFullScreen)}
        >
            {isPdfFullScreen ? <Minimize /> : <Maximize />}
        </Button>
    </div>
  );

  const scantronPanel = (
    <Scantron
      userAnswers={userAnswers}
      onAnswerSelect={handleAnswerSelect}
      reviewData={reviewData}
      markedQuestions={markedQuestions}
      onMarkQuestion={handleMarkQuestion}
    />
  );
  
  let panels: React.ReactNode[] = [];
  if (isPracticeMode) {
      panels = [testPdfPanel, scantronPanel];
  } else { // Review Mode
      if (showSolution && solution) {
          const solutionPdfPanel = <PDFDisplay url={solution.url} />;
          panels = [testPdfPanel, solutionPdfPanel, scantronPanel];
      } else {
          panels = [testPdfPanel, scantronPanel];
      }
  }
  
  const mainContent = (
      <div className={cn(
        "h-full w-full transition-all duration-300", 
        isStatsTest && showCalculator ? "pr-[33%]" : "pr-0",
      )}>
        <MultiPanelLayout panels={panels} isPdfFullScreen={isPdfFullScreen} />
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
          {isStatsTest && hasCalculatorBeenOpened && (
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
