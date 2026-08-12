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
}

export function VisitorInfoBlock({
  heading,
  body,
  status,
  pendingLabel,
  researchLabel,
  children,
  id,
}: VisitorInfoBlockProps) {
  if (!body && !children) return null;

  return (
    <section id={id} className="border-t border-rule pt-8">
      <h3 className="font-serif text-[24px] font-medium leading-snug text-ink">{heading}</h3>
      <ConfirmationBadge
        status={status}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
      />
      {body ? (
        <p className="mt-3 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">{body}</p>
      ) : null}
      {children}
    </section>
  );
}
