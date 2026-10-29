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

// Range syntax, so no fractional width falls between the two spans' steps.
const NARROW_FULL_CLASSES = '[@media(width<360px)]:sr-only';
const NARROW_SHORT_CLASSES = 'hidden [@media(width<360px)]:inline';

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
  /**
   * Below 360px the visible text shortens to the pending fallback while the full label stays
   * in the accessibility tree (sr-only, not display:none). Pending markers only, and not
   * when the label already is the short tag; any other marker keeps its label at every width.
   */
  shortOnNarrow?: boolean;
  /**
   * Opt-in, for a marker inside a disclosure that draws the full research wording in its foot. A
   * research marker then shows FALLBACK_RESEARCH_LABEL as its only label at every width.
   */
  shortResearch?: boolean;
}

export interface ResolvedStatusMarker {
  marker: 'pending' | 'research' | 'question';
  /** The full label the marker displays (the short tag aside). */
  label: string;
}

/**
 * The marker and full label StatusMarker displays for these props, or null when confirmed —
 * so a wrapper can name its region with exactly the string the chip shows at full width.
 */
export function resolveStatusMarker({
  kind,
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  shortResearch = false,
}: Pick<
  StatusMarkerProps,
  'kind' | 'status' | 'pendingLabel' | 'researchLabel' | 'questionLabel' | 'shortResearch'
>): ResolvedStatusMarker | null {
  // The ONLY early return, shared by both kinds — never split into a second branch.
  if (status === 'confirmed') return null;

  if (shortResearch && status === 'research') {
    return { marker: 'research', label: FALLBACK_RESEARCH_LABEL };
  }

  if (kind === 'exhibitor') {
    // Deliberately not a lookup keyed on `status`: an unrecognised key must resolve to
    // the pending marker, not to undefined.
    const marker = status === 'research' || status === 'question' ? status : 'pending';

    let label = pendingLabel;
    if (marker === 'research' && researchLabel) label = researchLabel;
    if (marker === 'question' && questionLabel) label = questionLabel;
    if (!label || label.trim() === '') label = FALLBACK_LABEL;
    return { marker, label };
  }

  const isResearch = status === 'research';
  const supplied = isResearch ? researchLabel : pendingLabel;
  return {
    marker: isResearch ? 'research' : 'pending',
    label: supplied?.trim() || (isResearch ? FALLBACK_RESEARCH_LABEL : FALLBACK_PENDING_LABEL),
  };
}

// U+203B (the reference mark) is not in the shipped Manrope subset, so the mark is an inline SVG:
// an X with a dot in each quarter, 1em, currentColor, on the text baseline (F1e).
// Manrope 600 "T" actualBoundingBoxAscent measures 8.64px at 12px = 0.72em (canvas
// measureText). The mark spans cap height + 4% overshoot top and bottom (dot edge to dot
// edge), shifted down by the overshoot so its bottom sits that far below the baseline.
// Stroke is the label T's stem (~0.1em of the label = 3.33 of 24 viewBox units); dots are
// 1.5x the stroke.
const LABEL_CAP_HEIGHT_EM = 0.72;
const MARK_OVERSHOOT = 0.04;
const MARK_HEIGHT_EM = LABEL_CAP_HEIGHT_EM * (1 + 2 * MARK_OVERSHOOT);
const MARK_DROP_EM = LABEL_CAP_HEIGHT_EM * MARK_OVERSHOOT;
const MARK_STROKE = 3.33;
const MARK_DOT_RADIUS = 2.5;

function ReferenceMark() {
  const near = MARK_DOT_RADIUS;
  const far = 24 - MARK_DOT_RADIUS;
  return (
    <span aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width={`${MARK_HEIGHT_EM}em`}
        height={`${MARK_HEIGHT_EM}em`}
        style={{ verticalAlign: `-${MARK_DROP_EM}em` }}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        focusable="false"
        aria-hidden="true"
        data-glyph="status-mark"
        className="inline-block"
      >
        <path d="M8 8l8 8M16 8l-8 8" fill="none" />
        <circle cx="12" cy={near} r={MARK_DOT_RADIUS} stroke="none" />
        <circle cx="12" cy={far} r={MARK_DOT_RADIUS} stroke="none" />
        <circle cx={near} cy="12" r={MARK_DOT_RADIUS} stroke="none" />
        <circle cx={far} cy="12" r={MARK_DOT_RADIUS} stroke="none" />
      </svg>
    </span>
  );
}

export function StatusMarker({
  kind,
  status,
  pendingLabel,
  researchLabel,
  questionLabel,
  tone = 'light',
  as: Root = 'p',
  shortOnNarrow = false,
  shortResearch = false,
}: StatusMarkerProps) {
  const resolved = resolveStatusMarker({
    kind,
    status,
    pendingLabel,
    researchLabel,
    questionLabel,
    shortResearch,
  });
  if (resolved === null) return null;
  const { marker, label } = resolved;

  // `data-*` attribute name is part of each kind's pre-existing, unchanged contract —
  // carries the RESOLVED marker, never the raw upstream value.
  const dataProps: Record<string, string> =
    kind === 'exhibitor' ? { 'data-exhibitor-marker': marker } : { 'data-confirmation-badge': marker };

  return (
    <Root
      {...dataProps}
      className={[
        'mt-2 inline-flex items-start gap-2 border px-2.5 py-1',
        'font-sans text-[12px] font-semibold uppercase leading-relaxed tracking-[0.14em]',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      <ReferenceMark />
      {shortOnNarrow && marker === 'pending' && label.trim() !== FALLBACK_PENDING_LABEL ? (
        <>
          <span className={NARROW_FULL_CLASSES}>{label}</span>
          <span aria-hidden="true" className={NARROW_SHORT_CLASSES}>
            {FALLBACK_PENDING_LABEL}
          </span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </Root>
  );
}
