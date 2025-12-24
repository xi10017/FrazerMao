'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Timer as TimerIcon, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerProps {
  duration: number; // in seconds
  initialTimeRemaining: number;
  isRunning: boolean;
  onToggle: () => void;
  onTick: (newTime: number) => void;
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
  isRunning,
  onToggle,
  onTick,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
  const isTimeUp = timeRemaining <= 0;

  useEffect(() => {
    setTimeRemaining(initialTimeRemaining);
  }, [initialTimeRemaining]);

  useEffect(() => {
    let timerId: NodeJS.Timeout | undefined;
    if (isRunning && !isTimeUp) {
      timerId = setInterval(() => {
        setTimeRemaining((prevTime) => {
          const newTime = prevTime - 1;
          onTick(newTime); // Notify parent of the tick
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  }, [isRunning, isTimeUp, onTick]);

  const handleToggle = () => {
    // Don't allow pausing/resuming if time is up
    if (isTimeUp && isRunning) return;
    onToggle();
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
