'use client';

import React, { useState, useRef, useEffect } from 'react';
import { chat } from '@/ai/flows/chat';
import type { ChatRequest } from '@/ai/flows/chat-schemas';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, User, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ChatHistory } from '@/ai/flows/chat-schemas';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import { BlockMath, InlineMath } from 'react-katex';

interface ChatTutorPanelProps {
  onClose: () => void;
}

const ChatMessageContent = ({ text }: { text: string }) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
       <ReactMarkdown
        remarkPlugins={[remarkMath]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          math: ({ value }: any) => <BlockMath>{value}</BlockMath>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inlineMath: ({ value }: any) => <InlineMath>{value}</InlineMath>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export const ChatTutorPanel: React.FC<ChatTutorPanelProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState<ChatHistory>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom whenever history changes
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [history, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);

    const userMessage = {
      role: 'user' as const,
      content: [{ text: prompt }],
    };
    const newHistory = [...history, userMessage];
    setHistory(newHistory);
    setPrompt('');

    try {
      const request: ChatRequest = { history: newHistory, prompt };
      const responseText = await chat(request);
      const modelMessage = {
        role: 'model' as const,
        content: [{ text: responseText }],
      };
      setHistory((prev) => [...prev, modelMessage]);
    } catch (error) {
      console.error('Error calling chat flow:', error);
      const errorMessage = {
        role: 'model' as const,
        content: [
          { text: 'Sorry, I encountered an error. Please try again.' },
        ],
      };
      setHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="flex h-full flex-col border-l">
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">AI Tutor</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <ScrollArea className="flex-1" ref={scrollAreaRef as any}>
        <div className="p-4 space-y-6">
          {history.length === 0 && !isLoading && (
            <div className="text-center text-muted-foreground p-8">
              <p>Have a question? Paste it here to get a step-by-step explanation from your AI Tutor.</p>
            </div>
          )}

          {history.map((entry, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-3',
                entry.role === 'user' ? 'justify-end' : ''
              )}
            >
              {entry.role === 'model' && (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 text-sm',
                  entry.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <ChatMessageContent text={entry.content[0].text} />
              </div>
              {entry.role === 'user' && (
                <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isLoading && (
             <div className="flex items-start gap-3">
               <Avatar className="h-8 w-8 border">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 rounded-lg border p-3 space-y-2 bg-muted">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[90%]" />
                  </div>
             </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question or paste it here..."
            className="pr-16 resize-none"
            rows={2}
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-10 w-10"
            disabled={isLoading || !prompt.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
