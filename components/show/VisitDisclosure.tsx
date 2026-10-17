// =============================================================
// NOS — components/show/VisitDisclosure.tsx
// Server Component — the R11 disclosure surface on plan-your-visit (nos-v4
// plan-your-visit.html l.575-616): ONE gold surface holds one full status chip, then the
// items it covers, so the items carry no card, border or shadow of their own. The caller
// supplies every string (the aria-label and all copy); nothing is typed here.
// =============================================================

import type { ReactNode } from 'react';

export interface VisitDisclosureProps {
  /** The group's accessible name; names what the one chip inside covers. */
  label: string;
  /** `pale` is the v4 .on-pale variant, for a disclosure that sits on a tinted section. */
  tone?: 'gold' | 'pale';
  children: ReactNode;
}

const TONE_CLASSES: Record<NonNullable<VisitDisclosureProps['tone']>, string> = {
  gold: 'bg-[var(--gold,#f3f2d6)]',
  pale: 'bg-[var(--gold-100,#fbfaf0)]',
};

export function VisitDisclosure({ label, tone = 'gold', children }: VisitDisclosureProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={[
        'grid gap-5 rounded-[16px] px-[clamp(20px,3vw,32px)] pb-6 pt-5 shadow-sm max-[700px]:px-4',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      {children}
    </div>
  );
}
