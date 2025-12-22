'use client';

import React from 'react';

interface GoogleDrivePDFViewerProps {
  url: string;
}

export const GoogleDrivePDFViewer: React.FC<GoogleDrivePDFViewerProps> = ({ url }) => {
  // Google Drive folder/search URLs cannot be embedded directly with gview.
  // We embed the entire page within an iframe.
  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={url}
        className="h-full w-full"
        frameBorder="0"
        title={`Google Drive PDF viewer for ${url}`}
      ></iframe>
    </div>
  );
};
