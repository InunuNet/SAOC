// =============================================================
// SAOC — components/show/ConfirmationBadge.tsx
// Server Component — the visible "not yet confirmed" marker.
//
// Nothing on the visitor pages may read as committee-confirmed fact while its status
// says otherwise. Both label strings arrive as props from Sanity so an editor can
// reword them in one place; the seeded wording is not frozen into this file.
//
// Fail closed, in both directions. Round 1 failed closed on `status` and OPEN on
// `label`: an editor cleared showVisitorInfo.pendingLabel and all 23 pending markers
// vanished across four pages while every status was still 'pending'. A safety device
// with an off switch is not a safety device. The ONLY early return is now
// status === 'confirmed'; an empty or missing label falls back to a terse built-in
// constant, deliberately worded differently from the seeded copy so a page that has
// fallen back looks visibly degraded rather than silently equivalent.
//
// Text, not colour alone — a colour-only signal fails WCAG 1.4.1 and is invisible on
// the printout a council member reads. The root carries `data-confirmation-badge` so
// markers can be counted structurally, by an observable derived from neither the
// dataset nor the copy.
// See contracts/golden/show-visitor-info/confirmation-status-model.golden.md.
// =============================================================

import type { ConfirmationStatus } from '@/types';

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

// Load-bearing: Sanity's Rule.required() is advisory and does not block an API write,
// a migration script or a bulk edit. These are what actually keeps the marker on screen.
const FALLBACK_PENDING_LABEL = 'To be confirmed';
const FALLBACK_RESEARCH_LABEL = 'Not yet confirmed';

const TONE_CLASSES: Record<'light' | 'dark', string> = {
  light: 'border-rule bg-parchment text-muted',
  dark: 'border-ivory/30 bg-ivory/10 text-ivory/80',
};

export function ConfirmationBadge({
  status,
  pendingLabel,
  researchLabel,
  tone = 'light',
  as: Root = 'p',
}: ConfirmationBadgeProps) {
  if (status === 'confirmed') return null;

  const isResearch = status === 'research';
  const supplied = isResearch ? researchLabel : pendingLabel;
  const label =
    supplied?.trim() || (isResearch ? FALLBACK_RESEARCH_LABEL : FALLBACK_PENDING_LABEL);

  return (
    <Root
      data-confirmation-badge={isResearch ? 'research' : 'pending'}
      className={[
        'mt-2 inline-flex items-start gap-2 border px-2.5 py-1',
        'font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.14em]',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      <span aria-hidden="true">※</span>
      <span>{label}</span>
    </Root>
  );
}
