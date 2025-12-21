'use client';

import React from 'react';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  const googleDocsUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    url
  )}&embedded=true`;

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={googleDocsUrl}
        className="h-full w-full"
        frameBorder="0"
        title={`PDF viewer for ${url}`}
      />
    </div>
  );
};
