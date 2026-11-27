// =============================================================
// SAOC — components/societies/SocietyAbout.tsx
// Server Component — "About this society" section. Renders the Sanity-sourced
// description and the society's own links; with neither, the section is dropped
// (no site-written stand-in copy).
// =============================================================

import type { SanitySociety } from './SocietyCard';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { SiteLink } from '@/components/ui/SiteLink';

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
            <SiteLink own="saoc"
              href={society.website}
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
            >
              Visit society website<ArrowIcon />
            </SiteLink>
          ) : null}
          {society.facebookUrl ? (
            <SiteLink own="saoc"
              href={society.facebookUrl}
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
            >
              Facebook page<ArrowIcon />
            </SiteLink>
          ) : null}
          {society.instagramUrl ? (
            <SiteLink own="saoc"
              href={society.instagramUrl}
              className="inline-flex min-h-11 items-center text-ink underline underline-offset-2 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
            >
              Instagram page<ArrowIcon />
            </SiteLink>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
