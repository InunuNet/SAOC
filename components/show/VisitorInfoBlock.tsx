// =============================================================
// SAOC — components/show/VisitorInfoBlock.tsx
// Server Component — heading + body copy + its confirmation marker.
// The unit every text block on the two visitor information pages is built from.
// Renders nothing when the body is empty, so a half-filled Sanity document produces
// a shorter page rather than an empty heading.
// =============================================================

import type { ReactNode } from 'react';

import type { ConfirmationStatus } from '@/types';

import { ConfirmationBadge } from './ConfirmationBadge';

export interface VisitorInfoBlockProps {
  heading: string;
  body?: string | null;
  status?: ConfirmationStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  children?: ReactNode;
  id?: string;
  /** Heading level; plan-your-visit keeps the default h3, what-to-expect opts into h2. */
  headingLevel?: 'h2' | 'h3';
}

export function VisitorInfoBlock({
  heading,
  body,
  status,
  pendingLabel,
  researchLabel,
  children,
  id,
  headingLevel = 'h3',
}: VisitorInfoBlockProps) {
  if (!body && !children) return null;

  return (
    <section id={id} className="nos-surface">
      {headingLevel === 'h2' ? (
        <h2 className="nos-opsz-fluid font-serif tracking-[-0.015em] font-normal min-[889px]:font-light text-[clamp(28px,3.6vw,44px)] leading-[1.1] text-ink">
          {heading}
        </h2>
      ) : (
        <h3 className="nos-opsz-32 font-serif font-normal text-[24px] text-ink">{heading}</h3>
      )}
      <ConfirmationBadge
        status={status}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
      />
      {body ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-[1.55] text-ink/80">{body}</p>
      ) : null}
      {children}
    </section>
  );
}
