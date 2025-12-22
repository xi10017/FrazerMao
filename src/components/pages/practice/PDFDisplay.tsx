'use client';

import React from 'react';
import { PDFViewer } from './PDFViewer';
import { GoogleDrivePDFViewer } from './GoogleDrivePDFViewer';

interface PDFDisplayProps {
  url: string;
}

export const PDFDisplay: React.FC<PDFDisplayProps> = ({ url }) => {
  const isGoogleDriveUrl = url.includes('drive.google.com');

  if (isGoogleDriveUrl) {
    return <GoogleDrivePDFViewer url={url} />;
  }

  return <PDFViewer url={url} />;
};
