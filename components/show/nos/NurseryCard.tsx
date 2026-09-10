// components/show/nos/NurseryCard.tsx
// Server Component — one card in the /sa-exhibitors and /international-guests
// nursery-directory grids.

import { Card } from '@/components/nos/Card';

export interface NurseryCardData {
  _id: string;
  name: string;
  country?: string | null;
  owner?: string | null;
  specialisation?: string | null;
  plantsBrought?: string | null;
  website?: string | null;
}

export function NurseryCard({ nursery }: { nursery: NurseryCardData }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      <h3 className="font-serif text-[20px] font-medium text-ink">{nursery.name}</h3>
      {nursery.country ? (
        <p className="font-sans text-[13px] uppercase tracking-[0.14em] text-muted">
          {nursery.country}
        </p>
      ) : null}
      {nursery.specialisation ? (
        <p className="font-sans text-[14px] leading-relaxed text-ink/75">
          {nursery.specialisation}
        </p>
      ) : null}
      {nursery.plantsBrought ? (
        <p className="font-sans text-[13px] leading-relaxed text-ink/60">
          {nursery.plantsBrought}
        </p>
      ) : null}
      {nursery.website ? (
        <a
          href={nursery.website}
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
