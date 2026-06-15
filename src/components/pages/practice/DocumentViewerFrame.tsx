'use client';

import React, { memo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DocumentViewerFrameProps {
  openUrl: string;
  children: React.ReactNode;
}

const DocumentViewerFrameComponent: React.FC<DocumentViewerFrameProps> = ({
  openUrl,
  children,
}) => {
  return (
    <div className="relative h-full w-full">
      <div className="absolute top-2 right-2 z-10">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-background/50 hover:bg-background/80"
              >
                <a
                  href={openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open document in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open document</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {children}
    </div>
  );
};

export const DocumentViewerFrame = memo(DocumentViewerFrameComponent);
