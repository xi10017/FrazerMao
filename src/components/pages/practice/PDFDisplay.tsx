
'use client';

import React, { memo } from 'react';
import { PDFViewer } from './PDFViewer';
import { GoogleDrivePDFViewer } from './GoogleDrivePDFViewer';
import { WordDocumentViewer } from './WordDocumentViewer';
import {
  getDocumentViewerKind,
  getDocumentOpenUrl,
  normalizeDocumentUrl,
} from '@/lib/document-url';
import { DocumentViewerFrame } from './DocumentViewerFrame';

interface PDFDisplayProps {
  url: string;
}

const PDFDisplayComponent: React.FC<PDFDisplayProps> = ({ url }) => {
  const normalizedUrl = normalizeDocumentUrl(url);
  const openUrl = getDocumentOpenUrl(url);
  const viewerKind = getDocumentViewerKind(url);

  const viewer =
    viewerKind === 'google-drive' ? (
      <GoogleDrivePDFViewer url={normalizedUrl} />
    ) : viewerKind === 'word' ? (
      <WordDocumentViewer url={normalizedUrl} />
    ) : (
      <PDFViewer url={normalizedUrl} />
    );

  return <DocumentViewerFrame openUrl={openUrl}>{viewer}</DocumentViewerFrame>;
};

export const PDFDisplay = memo(PDFDisplayComponent);
