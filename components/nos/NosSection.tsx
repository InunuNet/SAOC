// =============================================================
// NOS — components/nos/NosSection.tsx
// Server Component. The one content block of a NOS page (NOS Design C1/C2): a <section>
// that carries the section rhythm, clamp(72px, 9vw, 120px) on its own padding-block
// (index.html:156), around one [data-nos-wrap] (the 1080px container with a
// clamp(16px, 4vw, 48px) gutter, index.html:91-92). The wrap carries no vertical padding;
// a full-bleed ground is the section's own background, never a text-bearing child.
// Geometry lives in nos-theme.css (`.nos-section`, `[data-nos-wrap]`).
// =============================================================

import type { ComponentPropsWithoutRef } from 'react';

export type NosSectionTone = 'default' | 'gold' | 'royal' | 'black';

const TONE_CLASSES: Record<NosSectionTone, string> = {
  default: '',
  gold: 'nos-section-gold',
  // royal and black grounds are dark: focus rings and status colours read the on-dark aliases.
  royal: 'nos-section-royal nos-on-dark',
  black: 'nos-section-black nos-on-dark',
};

export interface NosSectionProps extends ComponentPropsWithoutRef<'section'> {
  tone?: NosSectionTone;
  /** Extra classes for the inner [data-nos-wrap] (layout only: grid, gap, spacing). */
  wrapClassName?: string;
}

export function NosSection({
  tone = 'default',
  className = '',
  wrapClassName = '',
  children,
  ...rest
}: NosSectionProps) {
  return (
    <section
      className={['nos-section', TONE_CLASSES[tone], className].filter(Boolean).join(' ')}
      {...rest}
    >
      <div data-nos-wrap="" className={wrapClassName || undefined}>
        {children}
      </div>
    </section>
  );
}
