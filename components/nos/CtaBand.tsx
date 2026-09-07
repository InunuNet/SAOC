// =============================================================
// NOS — components/nos/CtaBand.tsx
// Server Component. Full-width royal-purple band with a pale-gold primary
// action (guardrail 5 — the conventional, highest-contrast pairing on a
// dark ground; never olive as a button fill).
// =============================================================

import type { ReactNode } from 'react';

import { SectionHeading } from './SectionHeading';

export interface NosCtaBandProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  /** Typically a <Button variant="on-dark" as={Link}> action. */
  action: ReactNode;
  className?: string;
}

export function CtaBand({ eyebrow, title, lede, action, className = '' }: NosCtaBandProps) {
  return (
    <section
      className={[
        'bg-primary px-8 py-16 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-6">
        <SectionHeading eyebrow={eyebrow} title={title} lede={lede} tone="on-dark" className="items-center text-center" />
        {action}
      </div>
    </section>
  );
}
