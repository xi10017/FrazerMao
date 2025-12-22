'use client';

import React from 'react';
import { PDFViewer } from './PDFViewer';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface PDFDisplayProps {
  url: string;
}

export const PDFDisplay: React.FC<PDFDisplayProps> = ({ url }) => {
  const isGoogleDriveUrl = url.includes('drive.google.com');

  if (isGoogleDriveUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-8 text-center">
        <h3 className="text-xl font-semibold">Test Document on Google Drive</h3>
        <p className="mt-2 max-w-md text-muted-foreground">
          This document is hosted on Google Drive and cannot be displayed directly here due to security restrictions.
        </p>
        <Button asChild className="mt-6">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Test in New Tab
          </a>
        </Button>
      </div>
    );
  }

  return <PDFViewer url={url} />;
};
