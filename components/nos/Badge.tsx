// =============================================================
// NOS — components/nos/Badge.tsx
// Server Component. Wide-tracked Jost eyebrow/tag chip — the one place
// tracked uppercase caps belong outside the wordmark (design grammar).
//
// `tone="olive"` is legal here because a badge is a rule/eyebrow surface,
// never running body text — olive text fails contrast as body copy on light
// grounds (see nos-contrast.golden.md) but this is a short tracked-caps label.
// =============================================================

import type { ComponentPropsWithoutRef } from 'react';

export type NosBadgeTone = 'purple' | 'olive' | 'on-dark';

const TONE_CLASSES: Record<NosBadgeTone, string> = {
  purple: 'bg-bone text-primary',
  olive: 'bg-transparent text-[var(--olive-deep)] border-[1px] border-[var(--olive-deep)]',
  'on-dark': 'bg-white/10 text-ivory border-[1px] border-white/25',
};

export interface NosBadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: NosBadgeTone;
}

export function Badge({ tone = 'purple', className = '', children, ...rest }: NosBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-[length:var(--radius-pill)] px-3 py-1',
        'font-sans text-[11px] font-medium uppercase tracking-[0.16em]',
        TONE_CLASSES[tone],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}
