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
    <div className="nos-stage-card nos-petal">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--olive)]">
        Stage {stage}
      </p>
      <h3 className="font-serif text-[19px] font-medium leading-snug text-ivory">{title}</h3>
      <p className="font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-[var(--lilac-pale)]">
        {description}
      </p>
      {confirmation}
    </div>
  );
}
