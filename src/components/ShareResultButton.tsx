'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { buildShareText } from '@/lib/study-groups';
import { useToast } from '@/hooks/use-toast';

interface ShareResultButtonProps {
  testName?: string;
  totalScore: number;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ShareResultButton: React.FC<ShareResultButtonProps> = ({
  testName,
  totalScore,
  variant = 'outline',
  size = 'default',
  className,
}) => {
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    const text = buildShareText(testName, totalScore);

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'My test result', text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast({
          title: 'Copied to clipboard',
          description: 'Share your result anywhere you like.',
        });
      } else {
        toast({
          title: 'Share text',
          description: text,
        });
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Share failed:', error);
      toast({
        variant: 'destructive',
        title: 'Could not share',
        description: 'Please try again.',
      });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleShare}
      disabled={isSharing}
    >
      <Share2 className="mr-2 h-4 w-4" />
      {isSharing ? 'Sharing…' : 'Share Result'}
    </Button>
  );
};
