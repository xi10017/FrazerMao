'use client';

import React from 'react';
import PdfViewer from 'pdf-viewer-reactjs';

interface PDFViewerProps {
  url: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ url }) => {
  return (
    <div className="h-full w-full bg-muted">
       <PdfViewer
        document={{
          url: url,
        }}
        showThumbnail={{
            scale: 1.5,
            rotation: false,
        }}
        showBookmark={{
            right: true,
        }}
        canvasCss="w-full h-auto"
        viewerCss="w-full h-full"
        hideNavbar={false}
        hideZoom={false}
        hideRotation={false}
        showBtn={{
            print: true,
            download: true,
            zoom: true,
            fullScreen: true,
            presentation: true,
        }}
        navbarOnTop={true}
       />
    </div>
  );
};
