'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Timer as TimerIcon, Play } from 'lucide-react';

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
  isRunning: boolean;
  onToggle: () => void;
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
  onTimeUp,
  isRunning,
  onToggle,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (isRunning && timeRemaining > 0) {
      timerId = setInterval(() => {
        setTimeRemaining((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeRemaining <= 0 && isRunning) {
      onTimeUp();
    }

    return () => clearInterval(timerId);
  }, [isRunning, timeRemaining, onTimeUp]);

  useEffect(() => {
    // Reset timer if duration changes (e.g., new test)
    setTimeRemaining(duration);
  }, [duration]);

  if (!isRunning) {
    return (
      <Button variant="outline" onClick={onToggle}>
        <Play className="mr-2 h-4 w-4" />
        Start Timer
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium">
      <TimerIcon className="h-5 w-5 text-primary" />
      <span className="font-mono text-lg tabular-nums tracking-wider">
        {formatTime(timeRemaining)}
      </span>
    </div>
  );
};
