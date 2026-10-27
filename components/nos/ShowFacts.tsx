// =============================================================
// NOS — components/nos/ShowFacts.tsx
// Server Component. The show's headline facts (Dates / Host / Venue) as a definition
// list on a light ground: the long-form template's aside and the holding state carry it. The
// values come from lib/data/show-facts.ts, the one source the hub hero reads too.
// Geometry lives in nos-structure.css (`.nos-facts`).
// =============================================================

import type { ShowFact } from '@/lib/data/show-facts';

export interface ShowFactsProps {
  facts: readonly ShowFact[];
}

export function ShowFacts({ facts }: ShowFactsProps) {
  return (
    <dl data-nos-facts="" className="nos-facts">
      {facts.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
