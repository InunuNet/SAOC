// =============================================================
// SAOC — components/ui/PlaceholderMarker.tsx
// Server Component — the one visible "not confirmed" marker line for a fact the Council has not
// supplied, shown on the beta preview (F19, vote 1C; the public build leaves the fact out).
// It renders a block-level span, so it is valid inside a paragraph as well as a div.
// It carries the marker string the show pages already use (StatusMarker's fallback label) as quiet
// body-size text, the same register as ContentGap's sentence: no chip, no capitals, no box. Place it
// once per section, under the section's content, never inside a hero, card, caption, form field or
// image (critique decision, 2026-10-25).
// =============================================================

export type PlaceholderMarkerTone = 'light' | 'dark';

const MARKER_LABEL = 'Not confirmed by SAOC';

const TONE_CLASSES: Record<PlaceholderMarkerTone, string> = {
  light: 'text-muted',
  dark: 'text-ivory/80',
};

export function PlaceholderMarker({
  tone = 'light',
  label = MARKER_LABEL,
}: {
  tone?: PlaceholderMarkerTone;
  label?: string;
}) {
  return (
    <span
      data-placeholder-marker
      className={['block font-sans text-[14px] leading-[1.55]', TONE_CLASSES[tone]].join(' ')}
    >
      {label}
    </span>
  );
}
