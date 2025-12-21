'use client';

import React, { useState, useRef } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  FamatTest,
  FamatSolution,
  UserAnswers,
  ScoreReport,
  ReviewData,
} from '@/lib/types';
import { PDFViewer } from './PDFViewer';
import { Scantron } from './Scantron';
import { Button } from '@/components/ui/button';
import { ScoreModal } from './ScoreModal';
import { gradeTest } from '@/lib/test-logic';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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


interface PracticeArenaProps {
  test: FamatTest;
  solution?: FamatSolution;
  initialAnswers?: UserAnswers;
  isReviewFromHistory?: boolean;
}

const PracticeArena: React.FC<PracticeArenaProps> = ({ test, solution, initialAnswers, isReviewFromHistory }) => {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>(initialAnswers || {});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dividerPosition, setDividerPosition] = useState(50);
  const [reviewDivider1, setReviewDivider1] = useState(33.33);
  const [reviewDivider2, setReviewDivider2] = useState(66.66);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSubmitted, setIsSubmitted] = useState(!!isReviewFromHistory);
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(!!isReviewFromHistory);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();


  React.useEffect(() => {
    if (isReviewFromHistory && solution) {
      const report = gradeTest(userAnswers, solution.answers);
      setScoreReport(report);
      
      const newReviewData: ReviewData = {};
      for (let i = 0; i < solution.answers.length; i++) {
        const qNum = i + 1;
        const userAnswer = userAnswers[qNum];
        const correctAnswer = solution.answers[i];
        newReviewData[qNum] = {
          userAnswer,
          correctAnswer,
          isCorrect: userAnswer === correctAnswer,
        };
      }
      setReviewData(newReviewData);
    }
  }, [isReviewFromHistory, solution, userAnswers]);


  const handleAnswerSelect = (question: number, answer: string | null) => {
    if (isSubmitted) return;
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

  const handleMouseDown = (divider: 'main' | 'review1' | 'review2') => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const containerWidth = containerRef.current?.offsetWidth ?? 0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (containerRef.current) {
            const dx = moveEvent.clientX - startX;
            if (divider === 'main') {
                const startWidth = containerWidth * (dividerPosition / 100);
                const newWidth = startWidth + dx;
                const newPosition = (newWidth / containerWidth) * 100;
                setDividerPosition(Math.max(20, Math.min(80, newPosition)));
            } else if (divider === 'review1') {
                const startWidth1 = containerWidth * (reviewDivider1 / 100);
                const newWidth = startWidth1 + dx;
                let newPos1 = (newWidth / containerWidth) * 100;
                newPos1 = Math.max(15, Math.min(reviewDivider2 - 15, newPos1));
                setReviewDivider1(newPos1);
            } else if (divider === 'review2') {
                const startWidth2 = containerWidth * (reviewDivider2 / 100);
                const newWidth = startWidth2 + dx;
                let newPos2 = (newWidth / containerWidth) * 100;
                newPos2 = Math.max(reviewDivider1 + 15, Math.min(85, newPos2));
                setReviewDivider2(newPos2);
            }
        }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
    setScoreReport(report);
    setIsSubmitted(true);

    try {
      await addDoc(collection(firestore, 'submissions'), {
        testId: test.id,
        userId: user.uid,
        answers: userAnswers,
        score: report,
        submittedAt: serverTimestamp(),
      });
      toast({
        title: 'Success!',
        description: 'Your test results have been saved.',
      });
    } catch (error) {
      console.error('Error saving submission: ', error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'There was a problem saving your results.',
      });
    }


    const newReviewData: ReviewData = {};
    for (let i = 0; i < solution.answers.length; i++) {
      const qNum = i + 1;
      const userAnswer = userAnswers[qNum];
      const correctAnswer = solution.answers[i];
      newReviewData[qNum] = {
        userAnswer,
        correctAnswer,
        isCorrect: userAnswer === correctAnswer,
      };
    }
    setReviewData(newReviewData);
  };

  const handleEnterReviewMode = () => {
    setIsReviewMode(true);
    setScoreReport(null); // Close the modal
  };
  
  const handleExitReviewMode = () => {
    router.push(`/history/${test.id}`);
  }

  const DraggableDivider: React.FC<{onMouseDown: (e: React.MouseEvent) => void}> = ({ onMouseDown }) => (
    <div
      onMouseDown={onMouseDown}
      className="group h-full w-2 cursor-col-resize bg-border/50 transition hover:bg-primary"
    >
      <div className="h-full w-0.5 bg-transparent group-hover:bg-primary-foreground mx-auto"></div>
    </div>
  );
  
  const isSubmittable = Object.keys(userAnswers).length > 0;

  const getScantronHeader = () => {
    if(isReviewFromHistory) {
      return (
        <Button onClick={handleExitReviewMode}>Back to History</Button>
      )
    }
    if (isReviewMode) {
      return <p className="text-sm text-muted-foreground">Reviewing your results.</p>;
    }
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={!isSubmittable || isSubmitted}>
            Submit Test
          </Button>
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
    );
  }

  return (
    <>
      <div ref={containerRef} className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
        {!isReviewMode ? (
          <>
            <div
              className="relative h-full"
              style={{ width: isFullScreen ? '100%' : `${dividerPosition}%` }}
            >
              <PDFViewer url={test.url} />
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-4 right-4 bg-background/50 hover:bg-background/80"
                onClick={() => setIsFullScreen(!isFullScreen)}
              >
                {isFullScreen ? <Minimize /> : <Maximize />}
              </Button>
            </div>

            {!isFullScreen && (
              <>
                <DraggableDivider onMouseDown={handleMouseDown('main')} />
                <div className="h-full flex-1">
                  <Scantron
                    userAnswers={userAnswers}
                    onAnswerSelect={handleAnswerSelect}
                    isReviewMode={isReviewMode}
                    reviewData={reviewData}
                    isSubmitted={isSubmitted}
                    headerContent={getScantronHeader()}
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="relative h-full" style={{ width: `${reviewDivider1}%` }}>
                <PDFViewer url={test.url} />
            </div>
            <DraggableDivider onMouseDown={handleMouseDown('review1')} />
            <div className="relative h-full" style={{ width: `${reviewDivider2 - reviewDivider1}%` }}>
                {solution?.url && <PDFViewer url={solution.url} />}
            </div>
            <DraggableDivider onMouseDown={handleMouseDown('review2')} />
            <div className="h-full" style={{ width: `${100 - reviewDivider2}%` }}>
                <Scantron
                    userAnswers={userAnswers}
                    onAnswerSelect={handleAnswerSelect}
                    isReviewMode={isReviewMode}
                    reviewData={reviewData}
                    isSubmitted={isSubmitted}
                    headerContent={getScantronHeader()}
                />
            </div>
          </>
        )}
      </div>

      {scoreReport && !isReviewFromHistory && (
        <ScoreModal
          isOpen={!!scoreReport}
          onClose={() => setScoreReport(null)}
          scoreReport={scoreReport}
          onEnterReviewMode={handleEnterReviewMode}
        />
      )}
    </>
  );
};

export default PracticeArena;
