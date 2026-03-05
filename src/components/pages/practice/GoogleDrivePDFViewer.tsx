
'use client';

import React, { memo } from 'react';

interface GoogleDrivePDFViewerProps {
  url: string;
}

const GoogleDrivePDFViewerComponent: React.FC<GoogleDrivePDFViewerProps> = ({ url }) => {
  // To embed a Google Drive or Google Docs file, we transform the terminal segment to /preview.
  // This handles /view, /edit, and various query parameters like ?usp=sharing or ?rtpof=true.
  const embeddableUrl = url.replace(/\/(view|edit)(\?.*)?$/, '/preview');

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={embeddableUrl}
        className="h-full w-full"
        frameBorder="0"
        allow="autoplay"
        title={`Google Drive viewer for ${url}`}
      ></iframe>
    </div>
  );
};

export const GoogleDrivePDFViewer = memo(GoogleDrivePDFViewerComponent);
