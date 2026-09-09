// =============================================================
// SAOC — components/show/ConfirmationBadge.tsx
// Server Component — the visible "not yet confirmed" marker.
//
// Thin wrapper (mission site-content-alignment, M2/F2 unification) — the render logic,
// TONE_CLASSES, and fail-closed label handling now live in the shared
// `components/show/_shared/StatusMarker.tsx`, alongside `ExhibitorStatusBadge`'s. This
// file keeps its own public prop names unchanged so no call site needed to change.
//
// See `components/show/_shared/StatusMarker.tsx` for the fail-closed rationale (round 1
// failed closed on `status` and open on `label` — an editor cleared
// showVisitorInfo.pendingLabel and all 23 pending markers vanished across four pages) and
// contracts/golden/show-visitor-info/confirmation-status-model.golden.md.
// =============================================================

import type { ConfirmationStatus } from '@/types';

import { StatusMarker } from './_shared/StatusMarker';

export interface ConfirmationBadgeProps {
  status?: ConfirmationStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /** `dark` for use over the sage hero; `light` (default) for paper backgrounds. */
  tone?: 'light' | 'dark';
  /**
   * Root element. `span` is required inside a `<summary>`, whose content model is
   * phrasing content — the FAQ list marks each question in its summary so the marker
   * is visible without opening the disclosure.
   */
  as?: 'p' | 'span';
}

export function ConfirmationBadge({
  status,
  pendingLabel,
  researchLabel,
  tone = 'light',
  as = 'p',
}: ConfirmationBadgeProps) {
  return (
    <StatusMarker
      kind="confirmation"
      status={status}
      pendingLabel={pendingLabel}
      researchLabel={researchLabel}
      tone={tone}
      as={as}
    />
  );
}
