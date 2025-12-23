
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calculator, Maximize, Minimize } from 'lucide-react';
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
}

const MultiPanelLayout: React.FC<MultiPanelLayoutProps> = ({ panels }) => {
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
            {isDragging !== null && <div className="absolute inset-0 z-30" />}
            {panels.map((panel, index) => (
                <React.Fragment key={index}>
                    <div style={{ width: `${panelWidths[index]}%` }} className="relative h-full">
                        {panel}
                    </div>
                    {index < panels.length - 1 && (
                        <DraggableDivider onMouseDown={handleMouseDown(index)} />
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
  isReviewFromHistory,
  submissionId,
}) => {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [markedQuestions, setMarkedQuestions] = useState<MarkedQuestions>({});
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  
  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

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
    if (isReviewFromHistory && solution && initialAnswers && user && submissionId) {
      const report = gradeTest(initialAnswers, solution.answers);
      const newReviewData = createReviewData(initialAnswers, solution.answers);
      setReviewData(newReviewData);
      setScoreReport(report);
      setUserAnswers(initialAnswers);
      setIsScoreModalOpen(false); // Don't show score modal when reviewing from history
      // Load marked questions
      const savedMarks = getReviewMarks(user.uid, submissionId);
      setMarkedQuestions(savedMarks);
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
    }
  }, [isReviewFromHistory, solution, initialAnswers, user, test.id, submissionId, createReviewData]);


  useEffect(() => {
    if (user && reviewData === null) {
      saveInProgressAnswers(user.uid, test.id, userAnswers);
    }
  }, [userAnswers, user, test.id, reviewData]);
  
  // Save marked questions whenever they change
  useEffect(() => {
      if (user && submissionId && isReviewFromHistory) {
          saveReviewMarks(user.uid, submissionId, markedQuestions);
      }
  }, [markedQuestions, user, submissionId, isReviewFromHistory]);


  const handleAnswerSelect = (question: number, answer: string | null) => {
    if (reviewData) return;
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
    if (!isReviewFromHistory) return;
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

  const handleSubmit = () => {
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
    // This function now returns the docId of the new submission.
    saveSubmission(firestore, user.uid, test, userAnswers, report);
    clearInProgressAnswers(user.uid, test.id);

    toast({
      title: 'Success!',
      description: 'Your test results have been saved.',
    });

    const newReviewData = createReviewData(userAnswers, solution.answers);
    setReviewData(newReviewData);
    setScoreReport(report);
    setIsScoreModalOpen(true);
    // After submitting, we are now in "review mode" but need a submissionId.
    // This is a complex state. The simplest approach is to reload the history page
    // so the user can click "Review" on the new entry.
    router.push(`/history/${test.id}`);
  };

  const handleBackToLibrary = () => {
    router.push(`/`);
  };

  const isPracticeMode = reviewData === null;
  const isSubmittable = Object.keys(userAnswers).length > 0;
  
  const headerActions = (
    <div className="flex items-center gap-2">
       {isStatsTest && (
        <Button 
          variant={showCalculator ? "secondary" : "outline"} 
          onClick={() => setShowCalculator(!showCalculator)}
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
    <div className={cn('relative h-full transition-all duration-300', isPdfFullScreen && 'w-full')}>
        {isPdfFullScreen && <div className="absolute inset-0 z-30" />}
        <PDFDisplay url={test.url} />
        <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 right-4 bg-background/50 hover:bg-background/80"
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
      if (isStatsTest && showCalculator) {
          panels.push(<Ti84Calculator key="ti84" />);
      }
  } else { // Review Mode
      const solutionPdfPanel = <PDFDisplay url={solution?.url || test.url} />;
      panels = [testPdfPanel, solutionPdfPanel, scantronPanel];
      if (isStatsTest && showCalculator) {
          panels.push(<Ti84Calculator key="ti84" />);
      }
  }


  if (isPdfFullScreen) {
      return (
          <div className="h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
              {testPdfPanel}
          </div>
      )
  }

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col overflow-hidden bg-background">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b px-4">
            <h2 className="text-xl font-bold tracking-tight">{test.division}: {test.year} {test.month} {test.test_type}</h2>
            {headerActions}
        </header>
        <div className="flex-1 overflow-hidden">
            <MultiPanelLayout panels={panels} />
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
