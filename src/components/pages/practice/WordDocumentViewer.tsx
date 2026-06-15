'use client';

import React, { memo } from 'react';

interface WordDocumentViewerProps {
  url: string;
}

const WordDocumentViewerComponent: React.FC<WordDocumentViewerProps> = ({
  url,
}) => {
  const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    url
  )}`;

  return (
    <div className="h-full w-full bg-muted">
      <iframe
        src={viewerUrl}
        className="h-full w-full"
        frameBorder="0"
        title={`Word document viewer for ${url}`}
      ></iframe>
    </div>
  );
};

export const WordDocumentViewer = memo(WordDocumentViewerComponent);
