'use client';

import React from 'react';

interface GoogleDrivePDFViewerProps {
  url: string;
}

export const GoogleDrivePDFViewer: React.FC<GoogleDrivePDFViewerProps> = ({ url }) => {
  // To embed a Google Drive file, we need to transform the URL.
  // The standard sharing URL (e.g., /view?usp=sharing) needs to be changed to /preview.
  const embeddableUrl = url.replace('/view?usp=sharing', '/preview').replace('/view?usp=drive_link', '/preview');

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={embeddableUrl}
        className="h-full w-full"
        frameBorder="0"
        allow="autoplay"
        title={`Google Drive PDF viewer for ${url}`}
      ></iframe>
    </div>
  );
};
