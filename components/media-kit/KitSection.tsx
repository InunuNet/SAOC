// =============================================================
// SAOC — components/media-kit/KitSection.tsx
// Server Component — a media kit section: heading, the section's zip link, and its content.
// The section id is passed by the page so the jump nav and the pinned order stay in one place.
// =============================================================

import type { ReactNode } from 'react';

import { itemMeta, type MediaKitItem } from '@/lib/data/media-kit';

const ZIP_LABEL = {
  everything: 'Download everything (zip)',
  section: 'Download this section (zip)',
} as const;

export interface ZipLinkProps {
  item: MediaKitItem;
}

export function ZipLink({ item }: ZipLinkProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      <a
        href={item.href}
        download
        className="inline-flex min-h-[44px] items-center font-sans text-[14px] font-semibold text-ink underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {item.bundle_for === 'everything' ? ZIP_LABEL.everything : ZIP_LABEL.section}
      </a>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
        {itemMeta(item)}
      </span>
    </div>
  );
}

export interface KitSectionProps {
  id: string;
  heading: string;
  zip?: MediaKitItem;
  children: ReactNode;
}

export function KitSection({ id, heading, zip, children }: KitSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-32">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <h2 id={`${id}-heading`} className="font-serif tracking-[-0.015em] font-light text-[32px] leading-[1.15] text-ink">
          {heading}
        </h2>
        {zip ? <ZipLink item={zip} /> : null}
      </div>
      {children}
    </section>
  );
}
