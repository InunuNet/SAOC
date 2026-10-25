'use client';

// =============================================================
// SAOC — components/ui/DocumentIndex.tsx
// Client Component — the h2 index of a long document, rendered only by DocumentLayout.
// Plain in-page anchors; scroll-spy marks the section being read with aria-current="location".
// =============================================================

import { useEffect, useRef, useState } from 'react';

export interface DocumentIndexEntry {
  /** An h2 id in the document body. */
  id: string;
  /** The h2 text. */
  label: string;
  /** Optional ordinal shown before the label in its own span, so a theme can style it apart. */
  number?: string | number;
}

// An h2 counts as "being read" once it has scrolled above this line (the 97px header plus air).
const SPY_LINE_PX = 140;

// Before any h2 reaches the line (page load), the first entry is the one being read.
function currentSection(entries: readonly DocumentIndexEntry[]): string | null {
  let current: string | null = entries[0]?.id ?? null;
  for (const entry of entries) {
    const heading = document.getElementById(entry.id);
    if (heading && heading.getBoundingClientRect().top <= SPY_LINE_PX) current = entry.id;
  }
  return current;
}

export function DocumentIndex({ entries }: { entries: readonly DocumentIndexEntry[] }) {
  const [active, setActive] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setActive(currentSection(entries));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [entries]);

  // In the horizontal bar (below 1024px) keep the current link in view without moving the page.
  useEffect(() => {
    const bar = nav.current;
    const link = bar?.querySelector<HTMLElement>('[aria-current="location"]');
    if (bar && link && bar.scrollWidth > bar.clientWidth) {
      bar.scrollTo({ left: link.offsetLeft - bar.clientWidth / 3 });
    }
  }, [active]);

  return (
    <nav ref={nav} data-doc-index aria-label="Sections">
      {entries.map((entry) => (
        <a
          key={entry.id}
          data-doc-index-link
          href={`#${entry.id}`}
          aria-current={active === entry.id ? 'location' : undefined}
        >
          {entry.number !== undefined ? <span data-index-number>{entry.number}</span> : null}
          {entry.label}
        </a>
      ))}
    </nav>
  );
}
