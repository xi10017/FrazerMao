'use client';

import React from 'react';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    url
  )}&embedded=true`;

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={viewerUrl}
        className="h-full w-full border-0"
        title="Test PDF Viewer"
        allow="fullscreen"
      />
    </div>
  );
};
