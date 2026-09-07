// =============================================================
// NOS — components/nos/PastEditionCard.tsx
// Server Component. One entry in the past-editions archive grid — a
// photograph, an edition marker, and the record stats, on the Card
// primitive so it matches the rest of the botanical index rather than
// rendering as a flat dark placeholder block.
// =============================================================

import Image from 'next/image';

import { Card } from './Card';
import type { NosHeroImage } from './NosHero';

export interface NosPastEditionCardProps {
  image: NosHeroImage;
  editionLabel: string;
  year: number;
  month: string;
  host: string;
  entries?: number;
  visitors?: number;
  trophies?: number;
  note?: string;
}

export function PastEditionCard({
  image,
  editionLabel,
  year,
  month,
  host,
  entries,
  visitors,
  trophies,
  note,
}: NosPastEditionCardProps) {
  const stats = [
    entries ? `${entries.toLocaleString()} entries` : null,
    visitors ? `${visitors.toLocaleString()} visitors` : null,
    trophies ? `${trophies} trophies` : null,
  ].filter((s): s is string => Boolean(s));

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden p-0">
      <div className="relative aspect-[3/2] overflow-hidden bg-[var(--night)]">
        <Image
          src={image}
          alt={`${year} National Orchid Show`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(14,11,36,0.75) 0%, rgba(14,11,36,0) 45%)',
          }}
        />
        <span className="absolute left-3 top-3 rounded-[length:var(--radius-pill)] bg-primary px-3 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-ivory">
          {editionLabel}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <p className="font-serif text-[19px] font-medium text-ink">
            {year} — {month}
          </p>
          <p className="font-sans text-[13px] text-muted">{host}</p>
        </div>
        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
            {stats.map((stat) => (
              <span
                key={stat}
                className="rounded-[length:var(--radius-pill)] bg-bone px-2.5 py-1 font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-muted"
              >
                {stat}
              </span>
            ))}
          </div>
        )}
        {note && <p className="font-serif text-[14px] italic text-muted">{note}</p>}
      </div>
    </Card>
  );
}
