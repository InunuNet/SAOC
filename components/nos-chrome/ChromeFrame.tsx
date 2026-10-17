'use client';

// =============================================================
// NOS — components/nos-chrome/ChromeFrame.tsx
// Picks the site chrome for the current section. `/national-show/*` and `/tickets/*` (R62 #1:
// no brand switch at payment) get the NOS own-brand header and footer; every other marketing
// route keeps the SAOC chrome exactly as before. The header and footer must be body-level siblings
// of <main> (the menu panel inerts everything else on the path to <body>, and a
// <header>/<footer> inside <main> loses its banner/contentinfo landmark), which
// is why a nested layout cannot do this job.
// =============================================================

import { useSelectedLayoutSegment } from 'next/navigation';

const NOS_SEGMENTS: ReadonlySet<string> = new Set(['national-show', 'tickets']);

interface ChromePair {
  skip: React.ReactNode;
  top: React.ReactNode;
  bottom: React.ReactNode;
}

interface ChromeFrameProps {
  saoc: ChromePair;
  nos: ChromePair;
  children: React.ReactNode;
}

export function ChromeFrame({ saoc, nos, children }: ChromeFrameProps) {
  const segment = useSelectedLayoutSegment();
  const chrome = segment !== null && NOS_SEGMENTS.has(segment) ? nos : saoc;
  return (
    <>
      {chrome.skip}
      {chrome.top}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      {chrome.bottom}
    </>
  );
}
