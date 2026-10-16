// =============================================================
// NOS — components/show/ShowStatusLine.tsx
// Server Component — ONE existing R11 marker standing for a whole page. In a public build
// the per-row "not yet confirmed" chips are withheld and this line says it once instead.
// It renders the shared StatusMarker, so it is the same marker, not a new chip.
// =============================================================

import { StatusMarker } from './_shared/StatusMarker';

export interface ShowStatusLineProps {
  status: 'pending' | 'research';
  pendingLabel?: string | null;
  researchLabel?: string | null;
}

export function ShowStatusLine({ status, pendingLabel, researchLabel }: ShowStatusLineProps) {
  return (
    <StatusMarker
      kind="exhibitor"
      status={status}
      pendingLabel={pendingLabel}
      researchLabel={researchLabel}
    />
  );
}
