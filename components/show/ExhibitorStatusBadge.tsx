// =============================================================
// SAOC — components/show/ExhibitorStatusBadge.tsx
// Server Component — the visible "not yet SAOC policy" marker on the exhibitor guide.
//
// Nothing on this page may read as committee-confirmed fact while its status says
// otherwise. All three label strings arrive as props from Sanity so the committee can
// reword them in one place.
//
// FAIL CLOSED, TWICE OVER.
//
//   1. STATUS. Exactly one branch renders nothing, and it is the explicit `confirmed`
//      one. A missing, empty or unrecognised status falls through to the pending
//      marker, never to silence — a typo in a status value must not turn researched
//      convention into apparent SAOC policy.
//   2. LABEL. FALLBACK_LABEL below is the floor no dataset value can lower. QA cleared
//      the three Sanity labels and measured 23 bordered boxes containing nothing but an
//      aria-hidden glyph: a sighted reader saw blank rectangles, a screen-reader user
//      was told nothing, and the researched convention on the page read as settled SAOC
//      policy. One keystroke in Studio, no warning. A safety device must not have an
//      off switch, so exactly ONE string is hardcoded here — the last resort, never
//      editable copy, and deliberately not a fourth Sanity field (that would just move
//      the switch).
//
// `data-exhibitor-marker` exists for no reason except to be counted. The scenario under
// test is the copy being gone, so a check cannot count the copy; the glyph is
// aria-hidden, so counting that would score an unreadable box as a working marker. The
// attribute carries the RESOLVED status, never the raw dataset value.
//
// Text, not colour alone: a colour-only signal fails WCAG 1.4.1 and is invisible on the
// printout a council member actually reviews.
// See contracts/golden/show-exhibitor-info/exhibitor-confirmation-model.golden.md.
// =============================================================

import type { ExhibitorStatus } from '@/types';

export interface ExhibitorStatusBadgeProps {
  status?: ExhibitorStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  /** `dark` for use over the sage hero; `light` (default) for paper backgrounds. */
  tone?: 'light' | 'dark';
}

// The one hardcoded string in this file, and the only one permitted. It is what the
// marker says when Sanity says nothing at all, so it has to be honest with no content
// around it and must not read as a bug.
const FALLBACK_LABEL = 'Not confirmed by SAOC';

const TONE_CLASSES: Record<'light' | 'dark', string> = {
  light: 'border-rule bg-parchment text-muted',
  dark: 'border-ivory/30 bg-ivory/10 text-ivory/80',
};

export function ExhibitorStatusBadge({
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  tone = 'light',
}: ExhibitorStatusBadgeProps) {
  if (status === 'confirmed') return null;

  // Deliberately not a lookup keyed on `status`: an unrecognised key must resolve to the
  // pending marker, not to undefined.
  const marker = status === 'research' || status === 'question' ? status : 'pending';

  let label = pendingLabel;
  if (marker === 'research' && researchLabel) label = researchLabel;
  if (marker === 'question' && questionLabel) label = questionLabel;
  if (!label || label.trim() === '') label = FALLBACK_LABEL;

  return (
    <p
      data-exhibitor-marker={marker}
      className={[
        'mt-2 inline-flex items-start gap-2 border px-2.5 py-1',
        'font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.14em]',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      <span aria-hidden="true">※</span>
      <span>{label}</span>
    </p>
  );
}
