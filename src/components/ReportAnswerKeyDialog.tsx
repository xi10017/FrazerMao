'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useUser } from '@/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  buildProposedAnswerFromSelection,
  cancelPendingAnswerKeyReport,
  DuplicateAnswerKeyReportError,
  formatAnswerKeyValue,
  getUserAnswerKeyReportForQuestion,
  parseProposedAnswerSelection,
  submitAnswerKeyReport,
  updatePendingAnswerKeyReport,
} from '@/lib/answer-key-reports';
import { cn } from '@/lib/utils';

const CHOICES = ['A', 'B', 'C', 'D', 'E'] as const;

interface ReportAnswerKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId: string;
  testName: string;
  questionNumber: number;
  currentAnswer: string | string[];
  userAnswer?: string | null;
  isPendingReport?: boolean;
  onSubmitted?: () => void;
  onUpdated?: () => void;
  onCancelled?: () => void;
}

export function ReportAnswerKeyDialog({
  open,
  onOpenChange,
  testId,
  testName,
  questionNumber,
  currentAnswer,
  userAnswer,
  isPendingReport = false,
  onSubmitted,
  onUpdated,
  onCancelled,
}: ReportAnswerKeyDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedLetters, setSelectedLetters] = useState<string[]>([]);
  const [isThrowout, setIsThrowout] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [editingPending, setEditingPending] = useState(false);

  const resetSelection = () => {
    setSelectedLetters([]);
    setIsThrowout(false);
  };

  useEffect(() => {
    if (!open) {
      setConfirmingWithdraw(false);
      return;
    }

    if (!isPendingReport || !user || !firestore) {
      setEditingPending(false);
      resetSelection();
      setMessage('');
      setIsLoading(false);
      setIsSubmitting(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setEditingPending(true);

    getUserAnswerKeyReportForQuestion(
      firestore,
      user.uid,
      testId,
      questionNumber
    )
      .then((report) => {
        if (cancelled) return;
        if (report?.status === 'pending') {
          const parsed = parseProposedAnswerSelection(report.proposedAnswer);
          setIsThrowout(parsed.isThrowout);
          setSelectedLetters(parsed.letters);
          setMessage(report.message);
        } else {
          setEditingPending(false);
          resetSelection();
          setMessage('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEditingPending(false);
          resetSelection();
          setMessage('');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isPendingReport, user, firestore, testId, questionNumber]);

  const proposedAnswer = useMemo(
    () => buildProposedAnswerFromSelection(selectedLetters, isThrowout),
    [selectedLetters, isThrowout]
  );

  const toggleLetter = (choice: string) => {
    setIsThrowout(false);
    setSelectedLetters((prev) => {
      if (prev.includes(choice)) {
        return prev.filter((c) => c !== choice);
      }
      return [...prev, choice].sort();
    });
  };

  const selectThrowout = () => {
    setIsThrowout(true);
    setSelectedLetters([]);
  };

  const validateForm = (): boolean => {
    if (proposedAnswer == null) {
      toast({
        variant: 'destructive',
        title: 'Select an answer',
        description:
          'Choose one or more letters, or Throwout, before submitting.',
      });
      return false;
    }

    if (message.trim().length > 500) {
      toast({
        variant: 'destructive',
        title: 'Message too long',
        description: 'Please keep your explanation under 500 characters.',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!user || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Sign in required',
        description: 'You must be signed in to report an answer key issue.',
      });
      return;
    }

    if (!validateForm() || proposedAnswer == null) return;

    setIsSubmitting(true);
    try {
      await submitAnswerKeyReport(firestore, user, {
        testId,
        testName,
        questionNumber,
        currentAnswer,
        proposedAnswer,
        userAnswer,
        message,
      });
      toast({
        title: 'Report submitted',
        description: 'Thanks — an admin will review your correction request.',
      });
      onOpenChange(false);
      onSubmitted?.();
    } catch (error) {
      const description =
        error instanceof DuplicateAnswerKeyReportError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not submit report.';
      toast({
        variant: 'destructive',
        title: 'Report failed',
        description,
      });
      setIsSubmitting(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!user || !firestore) return;
    if (!validateForm() || proposedAnswer == null) return;

    setIsSubmitting(true);
    try {
      await updatePendingAnswerKeyReport(firestore, user.uid, {
        testId,
        questionNumber,
        currentAnswer,
        proposedAnswer,
        message,
      });
      toast({
        title: 'Dispute updated',
        description: 'Your pending report has been saved.',
      });
      onOpenChange(false);
      onUpdated?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description:
          error instanceof Error ? error.message : 'Could not save changes.',
      });
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !firestore) return;

    setIsSubmitting(true);
    try {
      await cancelPendingAnswerKeyReport(
        firestore,
        user.uid,
        testId,
        questionNumber
      );
      toast({
        title: 'Dispute withdrawn',
        description: 'You can submit a new report anytime.',
      });
      onCancelled?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Withdraw failed',
        description:
          error instanceof Error ? error.message : 'Could not withdraw report.',
      });
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {confirmingWithdraw ? (
          <>
            <DialogHeader>
              <DialogTitle>Withdraw this dispute?</DialogTitle>
              <DialogDescription>
                Your pending report for question {questionNumber} will be
                removed. You can submit a new one later if needed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setConfirmingWithdraw(false)}
                disabled={isSubmitting}
              >
                Keep dispute
              </Button>
              <Button
                variant="destructive"
                onClick={handleWithdraw}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Withdrawing…' : 'Withdraw'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>
                  {editingPending
                    ? 'Pending dispute'
                    : 'Report answer key issue'}
                </DialogTitle>
                {editingPending && (
                  <Badge variant="secondary">Awaiting review</Badge>
                )}
              </div>
              <DialogDescription>
                Question {questionNumber} on {testName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                <p>
                  <span className="text-muted-foreground">Current answer: </span>
                  <span className="font-medium">
                    {formatAnswerKeyValue(currentAnswer)}
                  </span>
                </p>
                {userAnswer != null && userAnswer !== undefined && (
                  <p>
                    <span className="text-muted-foreground">Your answer: </span>
                    <span className="font-medium">
                      {userAnswer || 'Omitted'}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Proposed correct answer</Label>
                <p className="text-xs text-muted-foreground">
                  Select one or more letters. Throwout clears letter choices.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {CHOICES.map((choice) => {
                    const selected =
                      !isThrowout && selectedLetters.includes(choice);
                    return (
                      <Button
                        key={choice}
                        type="button"
                        variant={selected ? 'default' : 'outline'}
                        size="sm"
                        className={cn('h-9 w-9 p-0 font-semibold')}
                        disabled={isBusy}
                        aria-pressed={selected}
                        onClick={() => toggleLetter(choice)}
                      >
                        {choice}
                      </Button>
                    );
                  })}
                  <Button
                    type="button"
                    variant={isThrowout ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 px-3"
                    disabled={isBusy}
                    aria-pressed={isThrowout}
                    onClick={selectThrowout}
                  >
                    Throwout
                  </Button>
                </div>
                {proposedAnswer != null && (
                  <p className="text-xs text-muted-foreground">
                    Proposing:{' '}
                    <span className="font-medium text-foreground">
                      {formatAnswerKeyValue(proposedAnswer)}
                    </span>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-message">Why should this change?</Label>
                <Textarea
                  id={`report-message-q${questionNumber}`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. The official solutions PDF shows B, not A."
                  maxLength={500}
                  rows={4}
                  disabled={isBusy}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/500
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              {editingPending ? (
                <>
                  <div className="flex w-full flex-wrap gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isBusy}
                    >
                      Close
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isBusy}>
                      {isSubmitting ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full text-destructive hover:text-destructive"
                    onClick={() => setConfirmingWithdraw(true)}
                    disabled={isBusy}
                  >
                    Withdraw dispute
                  </Button>
                </>
              ) : (
                <div className="flex w-full flex-wrap gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isBusy}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={isBusy}>
                    {isSubmitting ? 'Submitting…' : 'Submit report'}
                  </Button>
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
