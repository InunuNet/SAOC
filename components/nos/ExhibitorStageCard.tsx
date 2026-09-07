// =============================================================
// NOS — components/nos/ExhibitorStageCard.tsx
// Server Component. One step in the four-stage exhibitor path, rendered on
// the royal-purple ground (guardrail 3 — body copy on primary is pale gold,
// never olive; a wide-tracked olive eyebrow is fine, running text is not).
// =============================================================

import type { ReactNode } from 'react';

export interface NosExhibitorStageCardProps {
  stage: string;
  title: string;
  description: string;
  /** Typically a <ConfirmationBadge tone="dark" />. */
  confirmation?: ReactNode;
}

export function ExhibitorStageCard({
  stage,
  title,
  description,
  confirmation,
}: NosExhibitorStageCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[length:var(--radius-lg)] border border-white/10 bg-white/[0.06] p-6">
      <p className="font-sans text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--olive)]">
        Stage {stage}
      </p>
      <h3 className="font-serif text-[19px] font-medium leading-snug text-ivory">{title}</h3>
      <p className="font-sans text-[14px] leading-relaxed text-[var(--lilac-pale)]">
        {description}
      </p>
      {confirmation}
    </div>
  );
}
