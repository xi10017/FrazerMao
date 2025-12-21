'use client';

import React from 'react';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  return (
    <div className="h-full w-full bg-muted">
      <object data={url} type="application/pdf" className="h-full w-full">
        <div className="flex h-full w-full flex-col items-center justify-center bg-background text-center">
          <h3 className="text-xl font-semibold">Unable to load PDF</h3>
          <p className="mt-2 text-muted-foreground">
            Your browser may not support embedding PDFs.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open PDF in new tab
          </a>
        </div>
      </object>
    </div>
  );
};
