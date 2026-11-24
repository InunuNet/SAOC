'use client';

// =============================================================
// NOS — components/show/FaqJumpCard.tsx
// Client Component — FQ-R1 (NOS Design): on a phone (<768px) the FAQ's category index is ONE
// native <details> card, closed by default, sticky at the top of the viewport, rows numbered as the
// page's h2s are. From 768px it is not drawn (display: none, nos-structure.css) and the
// DocumentLayout index aside stays the page's category index; below 768px that aside is the one
// that is hidden. Client only to close the card after a row is chosen, so the open card never covers
// the section it just scrolled to. Without JavaScript the rows are still plain in-page anchors.
// =============================================================

import { useRef } from 'react';

import type { DocumentIndexEntry } from '@/components/ui/DocumentLayout';

// The aria-label of the DocumentIndex nav the card stands in for (components/ui/DocumentIndex.tsx):
// no "Jump to" string exists in the repo, and the copy freeze allows no new one.
const SUMMARY_LABEL = 'Sections';

export function FaqJumpCard({ entries }: { entries: readonly DocumentIndexEntry[] }) {
  const card = useRef<HTMLDetailsElement>(null);
  if (entries.length < 2) return null;

  return (
    <details ref={card} data-faq-jump className="nos-faq-jump">
      <summary data-faq-jump-summary className="nos-faq-jump-summary">
        <span>{SUMMARY_LABEL}</span>
        <span aria-hidden="true" className="nos-faq-icon">
          <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <path d="M3 10h14" />
            <path className="nos-faq-icon-v" d="M10 3v14" />
          </svg>
        </span>
      </summary>
      <nav aria-label={SUMMARY_LABEL} className="nos-faq-jump-list">
        {entries.map((entry) => (
          <a
            key={entry.id}
            data-faq-jump-link
            href={`#${entry.id}`}
            onClick={() => card.current?.removeAttribute('open')}
          >
            {entry.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
