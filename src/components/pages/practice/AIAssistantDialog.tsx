'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Bot, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AIAssistantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  questionNumber: number | null;
  explanation: string | null;
  isLoading: boolean;
}

export const AIAssistantDialog: React.FC<AIAssistantDialogProps> = ({
  isOpen,
  onClose,
  questionNumber,
  explanation,
  isLoading,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            Getting a hint for question {questionNumber}.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-6 pr-4 max-h-[60vh] overflow-y-auto">
          {/* User's "Question" */}
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="rounded-lg bg-muted p-3">
              <p className="font-semibold">You</p>
              <p className="text-sm text-muted-foreground">
                I need help with question {questionNumber}. Can you give me a hint?
              </p>
            </div>
          </div>

          {/* AI's Response */}
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback>
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-lg border p-3">
              <p className="font-semibold">AI Assistant</p>
              <div className="text-sm text-foreground/90">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[90%]" />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-sans">
                    {explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
