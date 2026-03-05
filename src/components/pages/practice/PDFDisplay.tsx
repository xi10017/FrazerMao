
'use client';

import React, { memo } from 'react';
import { PDFViewer } from './PDFViewer';
import { GoogleDrivePDFViewer } from './GoogleDrivePDFViewer';

interface PDFDisplayProps {
  url: string;
}

const PDFDisplayComponent: React.FC<PDFDisplayProps> = ({ url }) => {
  const isGoogleUrl = url.includes('drive.google.com') || url.includes('docs.google.com');

  if (isGoogleUrl) {
    return <GoogleDrivePDFViewer url={url} />;
  }

  return <PDFViewer url={url} />;
};

export const PDFDisplay = memo(PDFDisplayComponent);
