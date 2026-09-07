// =============================================================
// NOS — components/nos/JudgingGroupCard.tsx
// Server Component. One entry in the ten-group judging index on the landing
// page. Built on the Card primitive (white surface, hairline, purple-tinted
// shadow) so the grid reads as a considered botanical index rather than
// flat placeholder tiles — the emblem-badge numeral is the only
// illustrative element, per the "emblem is the only illustration" rule.
// =============================================================

import { Card } from './Card';

export interface NosJudgingGroupCardProps {
  code: string;
  group: string;
  name: string;
  description: string;
}

export function JudgingGroupCard({ code, group, name, description }: NosJudgingGroupCardProps) {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-[length:var(--radius-card)] bg-[var(--primary-100)]">
        <span className="font-serif text-[15px] font-medium italic text-primary">{code}</span>
      </div>
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--olive-deep)]">
        {group}
      </p>
      <p className="font-serif text-[17px] font-medium leading-snug text-ink">{name}</p>
      <p className="font-sans text-[13px] leading-relaxed text-muted">{description}</p>
    </Card>
  );
}
