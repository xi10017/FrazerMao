'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Timer as TimerIcon, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimerState } from '@/lib/types';

interface TimerProps {
  duration: number; // in seconds
  initialTimeRemaining: number;
  initialIsRunning: boolean;
  onStateChange: (newState: TimerState) => void;
}

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(
    remainingSeconds
  ).padStart(2, '0')}`;
};

export const Timer: React.FC<TimerProps> = ({
  duration,
  initialTimeRemaining,
  initialIsRunning,
  onStateChange,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
  const [isRunning, setIsRunning] = useState(initialIsRunning);
  const isTimeUp = timeRemaining <= 0;

  // Sync with parent when props change
  useEffect(() => {
    setTimeRemaining(initialTimeRemaining);
    setIsRunning(initialIsRunning);
  }, [initialTimeRemaining, initialIsRunning]);

  // The actual timer logic
  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (isRunning && !isTimeUp) {
      timerId = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    }
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [isRunning, isTimeUp]);

  // Inform parent when timer state changes
  useEffect(() => {
    onStateChange({ timeRemaining, isRunning });
  }, [timeRemaining, isRunning, onStateChange]);

  const handleToggle = () => {
    if (isTimeUp && isRunning) return; // Don't allow restart if time is up
    setIsRunning(prev => !prev);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleToggle}
        disabled={isTimeUp && isRunning}
      >
        {isRunning ? (
          <Pause className="mr-2 h-4 w-4" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {isRunning ? 'Pause Timer' : timeRemaining < duration ? 'Resume Timer' : 'Start Timer'}
      </Button>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium',
          isTimeUp && 'bg-red-500/20 border-red-500/30'
        )}
      >
        <TimerIcon
          className={cn('h-5 w-5 text-primary', isTimeUp && 'text-red-500')}
        />
        <span
          className={cn(
            'font-mono text-lg tabular-nums tracking-wider',
            isTimeUp && 'text-red-500 font-bold'
          )}
        >
          {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
};
