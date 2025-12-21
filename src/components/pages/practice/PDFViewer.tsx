'use client';

import React from 'react';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  // Use Google's document viewer to ensure cross-browser compatibility.
  // This viewer does not allow text selection, but it is reliable.
  const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    url
  )}&embedded=true`;

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={viewerUrl}
        className="h-full w-full"
        frameBorder="0"
        title={`PDF viewer for ${url}`}
      ></iframe>
    </div>
  );
};
