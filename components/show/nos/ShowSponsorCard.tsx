// components/show/nos/ShowSponsorCard.tsx
// Server Component — one card in the /national-show/sponsors grid. Reads the
// showSponsor document type, NEVER the site-level `sponsor` type — see
// goldens/m4/route-manifest.golden.md §6 and SP2.

import { Card } from '@/components/nos/Card';

export interface ShowSponsorCardData {
  _id: string;
  name: string;
  tier?: string | null;
  website?: string | null;
  description?: string | null;
}

export function ShowSponsorCard({ sponsor }: { sponsor: ShowSponsorCardData }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <h3 className="font-serif text-[20px] font-medium text-ink">{sponsor.name}</h3>
      {sponsor.tier ? (
        <p className="font-sans text-[13px] uppercase tracking-[0.14em] text-muted">
          {sponsor.tier}
        </p>
      ) : null}
      {sponsor.description ? (
        <p className="font-sans text-[14px] leading-relaxed text-ink/75">{sponsor.description}</p>
      ) : null}
      {sponsor.website ? (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto pt-2 font-sans text-[13px] font-medium text-[var(--accent)] underline underline-offset-2"
        >
          Visit website
        </a>
      ) : null}
    </Card>
  );
}
