// =============================================================
// SAOC — components/societies/SocietyAbout.tsx
// Server Component — "About this society" section. Renders the Sanity-sourced
// description and the society's own links; with neither, the section is dropped
// (no site-written stand-in copy).
// =============================================================

import type { SanitySociety } from './SocietyCard';

export interface SocietyAboutProps {
  society: SanitySociety;
}

export function SocietyAbout({ society }: SocietyAboutProps) {
  const hasLinks = Boolean(society.website || society.facebookUrl || society.instagramUrl);
  if (!society.description && !hasLinks) return null;

  return (
    <section>
      <h2 className="doc-h2">About this society</h2>
      {society.description ? (
        <p className="max-w-3xl font-sans text-[16px] leading-relaxed text-ink/80">
          {society.description}
        </p>
      ) : null}
      {hasLinks ? (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {society.website ? (
            <a
              href={society.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2"
            >
              Visit society website →
            </a>
          ) : null}
          {society.facebookUrl ? (
            <a
              href={society.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2"
            >
              Facebook page →
            </a>
          ) : null}
          {society.instagramUrl ? (
            <a
              href={society.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2"
            >
              Instagram page →
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
