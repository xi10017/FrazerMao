'use client';

import React from 'react';

export const Ti84Calculator: React.FC = () => {
  return (
    <div className="h-full w-full bg-neutral-800">
      <iframe
        src="https://ti84calc.com/ti84calc"
        className="h-full w-full border-0"
        title="TI-84 Plus Calculator"
        // The sandbox attribute is important for security, but some sites might not work with it.
        // If the calculator doesn't load, we might need to adjust these permissions.
        // "allow-scripts" and "allow-same-origin" are often necessary for interactive sites.
        sandbox="allow-scripts allow-same-origin allow-forms"
      ></iframe>
    </div>
  );
};
