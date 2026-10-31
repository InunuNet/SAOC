// =============================================================
// NOS — components/nos/JudgingGroupCard.tsx
// Server Component. One entry in the judging index on the landing page, a herbarium
// index card: the floating dates card's white surface, the group label with its numeral
// over a rule, then her name and description. Type lives in nos-structure.css (`.nos-jg-*`).
// =============================================================

import type { ReactNode } from 'react';

export interface NosJudgingGroupCardProps {
  n: number;
  name: string;
  /** Null renders no description paragraph at all (a group her document names and leaves there). */
  description: ReactNode | null;
}

export function JudgingGroupCard({ n, name, description }: NosJudgingGroupCardProps) {
  return (
    <div className="nos-jg-card">
      <p className="nos-jg-label">
        Group <span className="nos-jg-n">{n}</span>
      </p>
      <h3 className="nos-jg-name">{name}</h3>
      {description ? <p className="nos-jg-text">{description}</p> : null}
    </div>
  );
}
