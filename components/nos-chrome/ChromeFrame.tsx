'use client';

// =============================================================
// NOS — components/nos-chrome/ChromeFrame.tsx
// Picks the site chrome for the current section. `/national-show/*` gets the
// NOS own-brand header and footer; every other marketing route keeps the SAOC
// chrome exactly as before. The header and footer must be body-level siblings
// of <main> (the menu panel inerts everything else on the path to <body>, and a
// <header>/<footer> inside <main> loses its banner/contentinfo landmark), which
// is why a nested layout cannot do this job.
// =============================================================

import { useSelectedLayoutSegment } from 'next/navigation';

const NOS_SEGMENT = 'national-show';

interface ChromePair {
  top: React.ReactNode;
  bottom: React.ReactNode;
}

interface ChromeFrameProps {
  saoc: ChromePair;
  nos: ChromePair;
  children: React.ReactNode;
}

export function ChromeFrame({ saoc, nos, children }: ChromeFrameProps) {
  const chrome = useSelectedLayoutSegment() === NOS_SEGMENT ? nos : saoc;
  return (
    <>
      {chrome.top}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {chrome.bottom}
    </>
  );
}
