'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Timer as TimerIcon, Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TimerState } from '@/lib/types';

interface TimerProps {
  duration: number;
  initialTimeRemaining: number;
  initialIsRunning: boolean;
  onStateChange: (newState: TimerState) => void;
}

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export const Timer: React.FC<TimerProps> = ({
  duration,
  initialTimeRemaining: timeRemaining,
  initialIsRunning: isRunning,
  onStateChange,
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [minutes, setMinutes] = useState(String(duration / 60));
  const isTimeUp = timeRemaining <= 0;

  // The parent owns the complete timer state, including the chosen duration.
  useEffect(() => {
    if (!isRunning || isTimeUp) return;
    const timerId = setTimeout(() => {
      const next = Math.max(0, timeRemaining - 1);
      onStateChange({ timeRemaining: next, isRunning: next > 0, durationSeconds: duration });
    }, 1000);
    return () => clearTimeout(timerId);
  }, [isRunning, isTimeUp, timeRemaining, duration, onStateChange]);

  const reset = (seconds: number) => {
    onStateChange({ timeRemaining: seconds, isRunning: false, durationSeconds: seconds });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={isTimeUp}
        onClick={() => onStateChange({ timeRemaining, isRunning: !isRunning, durationSeconds: duration })}
      >
        {isRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
        {isRunning ? 'Pause Timer' : timeRemaining < duration ? 'Resume Timer' : 'Start Timer'}
      </Button>
      <div className={cn('flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium', isTimeUp && 'border-red-500/30 bg-red-500/20')} role="timer" aria-label="Time remaining">
        <TimerIcon className={cn('h-5 w-5 text-primary', isTimeUp && 'text-red-500')} />
        <span className={cn('font-mono text-lg tabular-nums tracking-wider', isTimeUp && 'font-bold text-red-500')}>
          {formatTime(timeRemaining)}
        </span>
      </div>
      <Button variant="outline" onClick={() => reset(duration)}>
        <RotateCcw className="mr-2 h-4 w-4" />Reset
      </Button>
      <Dialog open={isSettingsOpen} onOpenChange={(open) => {
        setIsSettingsOpen(open);
        if (open) setMinutes(String(duration / 60));
      }}>
        <DialogTrigger asChild><Button variant="outline">Set time</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set practice time</DialogTitle>
            <DialogDescription>Choose your practice duration. Applying it resets and pauses the timer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            const value = Number(minutes);
            if (!Number.isInteger(value) || value < 1 || value > 1440) return;
            reset(value * 60);
            setIsSettingsOpen(false);
          }}>
            <div className="space-y-2 py-4">
              <Label htmlFor="practice-timer-minutes">Minutes</Label>
              <Input id="practice-timer-minutes" type="number" inputMode="numeric" min={1} max={1440} step={1} required value={minutes} onChange={(event) => setMinutes(event.target.value)} />
              <p className="text-sm text-muted-foreground">Standard practice time is 60 minutes.</p>
            </div>
            <DialogFooter><Button type="submit">Apply time</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
