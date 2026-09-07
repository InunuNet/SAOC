// =============================================================
// NOS — components/nos/SectionHeading.tsx
// Server Component. Cormorant Garamond headline, sentence case (design
// grammar — the serif carries the elegance; it does not need capitals).
// Tracked uppercase caps are reserved for the optional Jost eyebrow, never
// applied to the headline itself.
// =============================================================

import type { ComponentPropsWithoutRef, ElementType } from 'react';

export interface NosSectionHeadingProps extends ComponentPropsWithoutRef<'div'> {
  eyebrow?: string;
  /** Sentence-case headline copy — do not transform to caps. */
  title: string;
  /** Optional supporting lede sentence beneath the title. */
  lede?: string;
  /** Heading level for the title element. Defaults to `h2`. */
  as?: ElementType;
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  as: TitleTag = 'h2',
  tone = 'light',
  className = '',
  ...rest
}: NosSectionHeadingProps) {
  const isDark = tone === 'on-dark';

  return (
    <div className={['flex flex-col gap-3', className].filter(Boolean).join(' ')} {...rest}>
      {eyebrow ? (
        <span
          className={[
            'font-sans text-[12px] font-medium uppercase tracking-[0.3em]',
            // On-dark: olive on royal purple/night is 6.16–7.62:1 (golden table,
            // "olive's one legal text use"). On light: olive-deep is only legal at
            // ≥24px (3.78–4.30:1 at this 12px size — FAIL). Violet clears 6.07:1 on
            // pale gold and 6.90:1 on white, so it carries the eyebrow on light
            // grounds instead. See nos-contrast.golden.md.
            isDark ? 'text-[var(--olive)]' : 'text-[var(--accent)]',
          ].join(' ')}
        >
          {eyebrow}
        </span>
      ) : null}
      <TitleTag
        className={[
          'font-serif text-[clamp(28px,3.6vw,44px)] font-medium leading-[1.1]',
          isDark ? 'text-ivory' : 'text-ink',
        ].join(' ')}
      >
        {title}
      </TitleTag>
      {lede ? (
        <p
          className={[
            'max-w-[58ch] font-sans text-[18px] leading-[1.55]',
            isDark ? 'text-[var(--lilac-muted)]' : 'text-muted',
          ].join(' ')}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}
