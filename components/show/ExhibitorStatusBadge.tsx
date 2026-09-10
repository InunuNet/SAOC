// =============================================================
// SAOC — components/show/ExhibitorStatusBadge.tsx
// Server Component — the visible "not yet SAOC policy" marker on the exhibitor guide.
//
// Thin wrapper (mission site-content-alignment, M2/F2 unification) — the render logic,
// TONE_CLASSES, and fail-closed label handling now live in the shared
// `components/show/_shared/StatusMarker.tsx`, alongside `ConfirmationBadge`'s. This file
// keeps its own public prop names unchanged so no call site (`EntryFormLink`,
// `ExhibitorSection`, `ExhibitorKeyDates`, `ExhibitorSteps`) needed to change.
//
// `question` is exhibitor-specific semantics (an open question is being put to the
// committee, not merely "not yet confirmed") and is preserved by passing `kind:
// 'exhibitor'` to the shared module — it must not collapse into `pending`.
//
// See `components/show/_shared/StatusMarker.tsx` for the fail-closed rationale and
// contracts/golden/show-exhibitor-info/exhibitor-confirmation-model.golden.md.
// =============================================================

import type { ExhibitorStatus } from '@/types';

import { StatusMarker } from './_shared/StatusMarker';

export interface ExhibitorStatusBadgeProps {
  status?: ExhibitorStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  /** `dark` for use over the sage hero; `light` (default) for paper backgrounds. */
  tone?: 'light' | 'dark';
}

export function ExhibitorStatusBadge({
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  tone = 'light',
}: ExhibitorStatusBadgeProps) {
  return (
    <StatusMarker
      kind="exhibitor"
      status={status}
      pendingLabel={pendingLabel}
      researchLabel={researchLabel}
      questionLabel={questionLabel}
      tone={tone}
    />
  );
}
