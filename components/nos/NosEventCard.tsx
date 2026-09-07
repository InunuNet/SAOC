// =============================================================
// NOS — components/nos/NosEventCard.tsx
// Server Component. Programme/event card — built on the Card primitive, so
// it inherits the white surface + hairline + soft purple-tinted shadow and
// never a coloured left-border accent stripe.
// =============================================================

import Link from 'next/link';

import { Badge } from './Badge';
import { Card } from './Card';

export interface NosEventCardProps {
  href: string;
  /** e.g. "Fri 12 Mar" — short, not a full ISO date. */
  dateLabel: string;
  title: string;
  description?: string;
  /** e.g. "Workshop", "Judging" — rendered as an olive-tone Badge. */
  category?: string;
}

export function NosEventCard({ href, dateLabel, title, description, category }: NosEventCardProps) {
  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="flex h-full flex-col gap-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--ring-focus)]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-sans text-[12px] font-medium uppercase tracking-[0.2em] text-muted">
            {dateLabel}
          </span>
          {category ? <Badge tone="olive">{category}</Badge> : null}
        </div>
        <h3 className="font-serif text-[22px] font-medium leading-[1.15] text-ink">{title}</h3>
        {description ? <p className="text-[15px] leading-[1.5] text-muted">{description}</p> : null}
      </Card>
    </Link>
  );
}
