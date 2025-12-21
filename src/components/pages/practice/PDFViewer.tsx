'use client';

import React from 'react';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={url}
        className="h-full w-full"
        frameBorder="0"
        title={`PDF viewer for ${url}`}
      />
    </div>
  );
};
