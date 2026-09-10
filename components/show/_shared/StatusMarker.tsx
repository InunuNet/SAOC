// =============================================================
// SAOC — components/show/_shared/StatusMarker.tsx
// Server Component — the ONE shared render path for the "not yet SAOC policy" /
// "not yet confirmed" markers, unifying `ExhibitorStatusBadge` and `ConfirmationBadge`
// (mission site-content-alignment, M2/F2; see
// .agent/memory/project/specs/site-content-alignment/goldens/f1-provisional-unification.md).
//
// Before this file, the two components were near-duplicates: same fail-closed shape
// (exactly one early return, on the literal string 'confirmed'), same hardcoded floor
// label pattern, same TONE_CLASSES, same markup shell — differing only in prop names and
// status-vocabulary width (`ExhibitorStatusBadge`'s 4-state `question` vs
// `ConfirmationBadge`'s 3-state). This module collapses the shared render logic into one
// place; `ExhibitorStatusBadge.tsx` and `ConfirmationBadge.tsx` are now thin wrappers that
// keep their own public prop names (so no call site changes) and delegate here via `kind`.
//
// `question` is exhibitor-specific semantics (an open question is being put to the
// committee, not merely "not yet confirmed") and is NOT collapsed into `pending` —
// `kind: 'confirmation'` callers never see it; `kind: 'exhibitor'` callers keep their
// distinct `question` marker exactly as before.
//
// FAIL CLOSED, TWICE OVER — unchanged from both source components.
//   1. STATUS. Exactly one branch renders nothing, and it is the explicit `confirmed`
//      one. A missing, empty or unrecognised status falls through to the pending marker,
//      never to silence.
//   2. LABEL. The fallback constants below are the floor no dataset value can lower — QA
//      cleared Sanity labels once and measured 23 bordered boxes containing nothing but an
//      aria-hidden glyph. A safety device must not have an off switch, so these strings are
//      hardcoded here, never editable copy.
//
// Byte-identical visual output for both existing call sites: TONE_CLASSES, the markup
// shell, and each kind's own fallback-label logic are reproduced verbatim from the two
// pre-unification components — this is a structural refactor, not a redesign. No new
// colour, spacing or typography token is introduced.
//
// The `data-*` attribute name differs per `kind` (existing convention, both pre-dating
// this file) and always carries the RESOLVED marker value, never the raw upstream value —
// what makes each marker structurally countable.
//
// Text, not colour alone: a colour-only signal fails WCAG 1.4.1 and is invisible on the
// printout a council member actually reviews.
// See contracts/golden/show-exhibitor-info/exhibitor-confirmation-model.golden.md and
// contracts/golden/show-visitor-info/confirmation-status-model.golden.md.
// =============================================================

export type StatusMarkerTone = 'light' | 'dark';
export type StatusMarkerRoot = 'p' | 'span';

// The one hardcoded string ExhibitorStatusBadge falls back to, for every unlabeled marker
// kind. Preserved verbatim from the pre-unification component.
const FALLBACK_LABEL = 'Not confirmed by SAOC';

// ConfirmationBadge's two distinct fallbacks — deliberately worded differently from the
// seeded Sanity copy so a page that has fallen back looks visibly degraded rather than
// silently equivalent. Preserved verbatim from the pre-unification component.
const FALLBACK_PENDING_LABEL = 'To be confirmed';
const FALLBACK_RESEARCH_LABEL = 'Not yet confirmed';

const TONE_CLASSES: Record<StatusMarkerTone, string> = {
  light: 'border-rule bg-parchment text-muted',
  dark: 'border-ivory/30 bg-ivory/10 text-ivory/80',
};

export interface StatusMarkerProps {
  /** Which pre-unification component's vocabulary/labels/data-attribute to reproduce. */
  kind: 'exhibitor' | 'confirmation';
  status?: string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /** Exhibitor-only. Ignored when `kind === 'confirmation'`. */
  questionLabel?: string | null;
  tone?: StatusMarkerTone;
  /** Confirmation-only (`ExhibitorStatusBadge` always renders `p`, as before). */
  as?: StatusMarkerRoot;
}

export function StatusMarker({
  kind,
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  tone = 'light',
  as: Root = 'p',
}: StatusMarkerProps) {
  // The ONLY early return, shared by both kinds — never split into a second branch.
  if (status === 'confirmed') return null;

  let marker: 'pending' | 'research' | 'question';
  let label: string | null | undefined;

  if (kind === 'exhibitor') {
    // Deliberately not a lookup keyed on `status`: an unrecognised key must resolve to
    // the pending marker, not to undefined.
    marker = status === 'research' || status === 'question' ? status : 'pending';

    label = pendingLabel;
    if (marker === 'research' && researchLabel) label = researchLabel;
    if (marker === 'question' && questionLabel) label = questionLabel;
    if (!label || label.trim() === '') label = FALLBACK_LABEL;
  } else {
    const isResearch = status === 'research';
    marker = isResearch ? 'research' : 'pending';

    const supplied = isResearch ? researchLabel : pendingLabel;
    label = supplied?.trim() || (isResearch ? FALLBACK_RESEARCH_LABEL : FALLBACK_PENDING_LABEL);
  }

  // `data-*` attribute name is part of each kind's pre-existing, unchanged contract —
  // carries the RESOLVED marker, never the raw upstream value.
  const dataProps: Record<string, string> =
    kind === 'exhibitor' ? { 'data-exhibitor-marker': marker } : { 'data-confirmation-badge': marker };

  return (
    <Root
      {...dataProps}
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
