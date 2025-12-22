
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Maximize, Minimize, PanelRightOpen, PanelRightClose } from 'lucide-react';
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
import { PDFDisplay } from './PDFDisplay';
import { ChatTutorPanel } from './ChatTutorPanel';

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


// --- Three Panel Layout for Review Mode ---

interface ThreePanelLayoutProps {
    testPdf: React.ReactNode;
    solutionPdf: React.ReactNode;
    scantron: React.ReactNode;
}

const ThreePanelLayout: React.FC<ThreePanelLayoutProps> = ({ testPdf, solutionPdf, scantron }) => {
    const [isDragging, setIsDragging] = useState<number | null>(null);
    const [positions, setPositions] = useState([33.3, 66.6]);
    const containerRef = useRef<HTMLDivElement>(null);

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

        const MIN_WIDTH = 15; // Minimum 15% width for a panel

        if (isDragging === 0) {
            newPosition = Math.max(MIN_WIDTH, Math.min(newPosition, positions[1] - MIN_WIDTH));
        } else { // isDragging === 1
            newPosition = Math.max(positions[0] + MIN_WIDTH, Math.min(newPosition, 100 - MIN_WIDTH));
        }
        
        setPositions(prev => {
            const newPositions = [...prev];
            newPositions[isDragging] = newPosition;
            return newPositions;
        });

    }, [isDragging, positions]);

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
    
    const panel1Width = positions[0];
    const panel2Width = positions[1] - positions[0];
    const panel3Width = 100 - positions[1];

    return (
         <div ref={containerRef} className="flex h-full w-full overflow-hidden">
             {isDragging !== null && <div className="absolute inset-0 z-30" />}
            <div style={{ width: `${panel1Width}%` }} className="relative h-full">
                {testPdf}
            </div>
            <DraggableDivider onMouseDown={handleMouseDown(0)} />
            <div style={{ width: `${panel2Width}%` }} className="relative h-full">
                {solutionPdf}
            </div>
            <DraggableDivider onMouseDown={handleMouseDown(1)} />
            <div style={{ width: `${panel3Width}%` }} className="h-full">
                {scantron}
            </div>
        </div>
    )
}

// --- Main Arena Component ---

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
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  
  // Two-panel layout state
  const [isPdfFullScreen, setIsPdfFullScreen] = useState(false);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();

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
  }, [isReviewFromHistory, solution, initialAnswers, user, test.id, createReviewData]);

  useEffect(() => {
    // Only save progress if we are in practice mode (not reviewing)
    if (user && reviewData === null) {
      saveInProgressAnswers(user.uid, test.id, userAnswers);
    }
  }, [userAnswers, user, test.id, reviewData]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const containerWidth = containerRef.current?.offsetWidth ?? 0;
    const initialPosition = dividerPosition;
    const startWidth = containerWidth * (initialPosition / 100);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const newWidth = startWidth + dx;
      const newPosition = (newWidth / containerWidth) * 100;
      setDividerPosition(Math.max(20, Math.min(80, newPosition)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
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

  const isPracticeMode = reviewData === null;
  const isSubmittable = Object.keys(userAnswers).length > 0;
  
  const scantronComponent = (
     <Scantron
        userAnswers={userAnswers}
        onAnswerSelect={handleAnswerSelect}
        reviewData={reviewData}
        onAskTutor={() => setIsTutorOpen(true)}
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
  )

  const pdfPanelWidth = isTutorOpen ? '65%' : '100%';
  const mainContent = (
    <div className="flex h-full w-full">
      <div className="flex-1 transition-all duration-300" style={{ width: isPracticeMode ? 'auto' : pdfPanelWidth }}>
      {isPracticeMode ? (
          // Two-panel layout for practice
          <div ref={containerRef} className="flex h-full w-full">
              <div
                  className={cn(
                  'relative h-full transition-all duration-300',
                  isPdfFullScreen && 'w-full'
                  )}
                  style={{ width: isPdfFullScreen ? '100%' : `${dividerPosition}%` }}
              >
                  {isDragging && (
                      <div className="absolute inset-0 z-30" />
                  )}
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

              {!isPdfFullScreen && (
              <>
                  <DraggableDivider onMouseDown={handleMouseDown} />
                  <div className="h-full flex-1">
                      {scantronComponent}
                  </div>
              </>
              )}
        </div>
      ) : (
          // Three-panel layout for review
          <ThreePanelLayout 
              testPdf={<PDFDisplay url={test.url} />}
              solutionPdf={<PDFDisplay url={solution?.url || test.url} />}
              scantron={scantronComponent}
          />
      )}
    </div>
    {isTutorOpen && (
      <div className="w-[35%] h-full">
        <ChatTutorPanel onClose={() => setIsTutorOpen(false)} />
      </div>
    )}
  </div>
  );


  return (
    <>
      <div className="h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
         <Button
            variant="outline"
            size="icon"
            className="absolute top-[calc(3.5rem+1rem)] right-4 z-20"
            onClick={() => setIsTutorOpen(!isTutorOpen)}
            title="Toggle AI Tutor"
        >
            {isTutorOpen ? <PanelRightClose/> : <PanelRightOpen />}
        </Button>
        {mainContent}
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
