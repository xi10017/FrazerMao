'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Maximize, Minimize, AlertTriangle } from 'lucide-react';
import type { FamatTest, FamatSolution, UserAnswers, ScoreReport, ReviewData } from '@/lib/types';
import { PDFViewer } from './PDFViewer';
import { Scantron } from './Scantron';
import { Button } from '@/components/ui/button';
import { ScoreModal } from './ScoreModal';
import { gradeTest } from '@/lib/test-logic';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PracticeArenaProps {
  test: FamatTest;
  solution?: FamatSolution;
}

const PracticeArena: React.FC<PracticeArenaProps> = ({ test, solution }) => {
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [dividerPosition, setDividerPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scoreReport, setScoreReport] = useState<ScoreReport | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  const { toast } = useToast();

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = (containerRef.current?.offsetWidth ?? 0) * (dividerPosition / 100);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (containerRef.current) {
        const dx = moveEvent.clientX - startX;
        const newWidth = startWidth + dx;
        const newPosition = (newWidth / containerRef.current.offsetWidth) * 100;
        setDividerPosition(Math.max(20, Math.min(80, newPosition)));
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [dividerPosition]);
  
  const handleSubmit = () => {
    if (!solution) {
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Cannot grade test as no solution is available.',
      });
      return;
    }
    const report = gradeTest(userAnswers, solution.answers);
    setScoreReport(report);
    setIsSubmitted(true);

    const newReviewData: ReviewData = {};
    for (let i = 0; i < solution.answers.length; i++) {
        const qNum = i + 1;
        const userAnswer = userAnswers[qNum];
        const correctAnswer = solution.answers[i];
        newReviewData[qNum] = {
            userAnswer,
            correctAnswer,
            isCorrect: userAnswer === correctAnswer
        };
    }
    setReviewData(newReviewData);
  };

  const handleEnterReviewMode = () => {
    setIsReviewMode(true);
    setScoreReport(null); // Close the modal
  };

  return (
    <>
      <div ref={containerRef} className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-background">
        <div 
            className="relative h-full" 
            style={{ width: isFullScreen ? '100%' : `${dividerPosition}%` }}
        >
          <PDFViewer url={test.url} />
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 bg-background/50 hover:bg-background/80"
            onClick={() => setIsFullScreen(!isFullScreen)}
          >
            {isFullScreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>
        
        {!isFullScreen && (
          <>
            <div
              onMouseDown={handleMouseDown}
              className="group h-full w-2 cursor-col-resize bg-border/50 transition hover:bg-primary"
            >
                <div className="h-full w-0.5 bg-transparent group-hover:bg-primary-foreground mx-auto"></div>
            </div>
            <div className="h-full flex-1">
                <Scantron 
                    userAnswers={userAnswers}
                    onAnswerSelect={handleAnswerSelect}
                    isReviewMode={isReviewMode}
                    reviewData={reviewData}
                />
            </div>
          </>
        )}
      </div>
      
      {!isReviewMode && (
          <footer className="fixed bottom-0 left-0 right-0 z-10 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container mx-auto flex items-center justify-end">
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!solution || isSubmitted}
                  >
                    Submit Test
                  </Button>
              </div>
          </footer>
      )}

      {scoreReport && (
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
