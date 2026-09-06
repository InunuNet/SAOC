// =============================================================
// SAOC — components/societies/SocietyAbout.tsx
// Server Component — "About this society" section. Prefers a real
// Sanity-sourced description; otherwise falls back to general,
// council-true prose about affiliation (province, region, what
// belonging to SAOC means) — never a specific unverifiable claim
// about this society's own schedule, venue, or people. The fallback
// is marked `data-placeholder`, the repo-wide convention for
// credible-but-unconfirmed content (see SocietyCard.tsx, Timeline.tsx).
// =============================================================

import type { SanitySociety } from './SocietyCard';

export interface SocietyAboutProps {
  society: SanitySociety;
}

export function SocietyAbout({ society }: SocietyAboutProps) {
  const region = society.region ?? society.province ?? 'South Africa';

  return (
    <section>
      <span className="eyebrow">About this society</span>
      {society.description ? (
        <p className="mt-5 max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
          {society.description}
        </p>
      ) : null}
      {society.website ? (
        <a
          href={society.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-ink underline underline-offset-2"
        >
          Visit society website →
        </a>
      ) : null}
      {!society.description && (
        <div data-placeholder="true" className="mt-5 max-w-3xl">
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            {society.name} is one of SAOC&apos;s 21 affiliated societies, serving growers in{' '}
            {region}. Affiliation means the society follows SAOC&apos;s national judging
            standards, its members and plants are eligible to compete at accredited shows
            country-wide, and it forms part of the federation that has coordinated South
            African orchid growing since 1968.
          </p>
          <p className="mt-3 inline-block border border-rule bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            General description — society-specific detail pending confirmation
          </p>
        </div>
      )}
    </section>
  );
}
