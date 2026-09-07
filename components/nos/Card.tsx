// =============================================================
// NOS — components/nos/Card.tsx
// Server Component. White surface + 1px warm hairline + soft purple-tinted
// shadow (design grammar). Deliberately no coloured left-border accent
// stripe and no harsh black shadow — both were reviewed and rejected.
// =============================================================

import type { ComponentPropsWithoutRef } from 'react';

export type NosCardProps = ComponentPropsWithoutRef<'div'>;

export function Card({ className = '', children, ...rest }: NosCardProps) {
  return (
    <div
      className={[
        'rounded-[length:var(--radius-card)] border-[length:var(--border-hairline)]',
        'border-[var(--rule)] bg-white p-6',
        'shadow-[var(--shadow-card)]',
        'transition-shadow duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
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
