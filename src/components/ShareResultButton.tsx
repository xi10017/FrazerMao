'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';
import { buildShareText } from '@/lib/study-groups';
import {
  generateShareResultImage,
  shareResultImage,
} from '@/lib/share-result-image';
import { useToast } from '@/hooks/use-toast';

interface ShareResultButtonProps {
  testName?: string;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  omitCount: number;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ShareResultButton: React.FC<ShareResultButtonProps> = ({
  testName,
  totalScore,
  correctCount,
  incorrectCount,
  omitCount,
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
      const blob = await generateShareResultImage({
        testName,
        totalScore,
        correctCount,
        incorrectCount,
        omitCount,
      });
      const result = await shareResultImage(blob, text);

      if (result === 'downloaded') {
        toast({
          title: 'Image saved',
          description: 'Your result card was downloaded as a PNG.',
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
