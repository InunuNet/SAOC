// =============================================================
// NOS — components/nos/ExhibitorStageCard.tsx
// Server Component. One step in the four-stage exhibitor path: the two cells of a ruled row
// on the light ground. The row itself is the caller's `.nos-hm-stage` (nos-structure.css).
// =============================================================

import type { ReactNode } from 'react';

export interface NosExhibitorStageCardProps {
  stage: string;
  title: string;
  description: string;
  /** Typically a <ConfirmationBadge />. */
  confirmation?: ReactNode;
}

export function ExhibitorStageCard({
  stage,
  title,
  description,
  confirmation,
}: NosExhibitorStageCardProps) {
  return (
    <>
      <p className="nos-stage-label">{`Stage ${stage}`}</p>
      <div>
        <h3 className="nos-stage-title">{title}</h3>
        <p className="nos-stage-text">{description}</p>
        {confirmation}
      </div>
    </>
  );
}
