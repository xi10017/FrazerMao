'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useUser, useFirestore } from '@/firebase';
import { clearRetakeInProgressForTest } from '@/lib/user-data';
import { useToast } from '@/hooks/use-toast';

interface CancelRetakeButtonProps {
  testId: string;
  onCancelled?: () => void;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  label?: string;
  className?: string;
}

export const CancelRetakeButton: React.FC<CancelRetakeButtonProps> = ({
  testId,
  onCancelled,
  disabled,
  size = 'default',
  variant = 'outline',
  label = 'Cancel Retake',
  className,
}) => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    if (!user || !firestore) return;
    setIsCancelling(true);
    try {
      await clearRetakeInProgressForTest(firestore, user.uid, testId);
      toast({
        title: 'Retake cancelled',
        description: 'Your in-progress retake has been discarded.',
      });
      onCancelled?.();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isCancelling}
          className={className}
        >
          <X className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this retake?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently discards your in-progress retake for this test.
            Your submitted history is not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep retake</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Cancel retake
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
