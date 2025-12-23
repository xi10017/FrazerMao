'use client';

import React, { memo } from 'react';
import { PDFViewer } from './PDFViewer';
import { GoogleDrivePDFViewer } from './GoogleDrivePDFViewer';

interface PDFDisplayProps {
  url: string;
}

const PDFDisplayComponent: React.FC<PDFDisplayProps> = ({ url }) => {
  const isGoogleDriveUrl = url.includes('drive.google.com');

  if (isGoogleDriveUrl) {
    return <GoogleDrivePDFViewer url={url} />;
  }

  return <PDFViewer url={url} />;
};

export const PDFDisplay = memo(PDFDisplayComponent);
