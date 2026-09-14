// =============================================================
// NOS — components/nos/Card.tsx
// Server Component. White surface + hairline border, square corners
// (--radius-card is 0 — R1: NOS keeps SAOC's structural grammar, elevation
// is a border, never a shadow). No coloured left-border accent stripe.
// =============================================================

import type { ComponentPropsWithoutRef } from 'react';

export type NosCardProps = ComponentPropsWithoutRef<'div'>;

export function Card({ className = '', children, ...rest }: NosCardProps) {
  return (
    <div
      className={[
        'rounded-[length:var(--radius-card)] border-[length:var(--border-primary)]',
        'border-[var(--rule)] bg-white p-6',
        'transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
