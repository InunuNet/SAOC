// =============================================================
// NOS — components/nos/VisitorLinkCard.tsx
// Server Component. One entry in the "Planning a visit" front-door grid —
// built on the Card primitive so it reads as a considered surface, not a
// bare rule on a flat ground (design grammar: bare rules were rejected).
// =============================================================

import Link from 'next/link';

import { Card } from './Card';

export interface NosVisitorLinkCardProps {
  href: string;
  title: string;
  description: string;
}

export function VisitorLinkCard({ href, title, description }: NosVisitorLinkCardProps) {
  return (
    <Link href={href} className="group block h-full focus-visible:outline-none">
      <Card className="flex h-full flex-col gap-3 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--ring-focus)]">
        <span className="font-serif text-[19px] font-medium leading-snug text-ink">{title}</span>
        <span className="font-sans text-[14px] leading-relaxed text-muted">{description}</span>
        <span aria-hidden="true" className="mt-auto border-t border-rule pt-3 text-[var(--accent)]">
          →
        </span>
      </Card>
    </Link>
  );
}
