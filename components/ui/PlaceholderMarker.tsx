// =============================================================
// SAOC — components/ui/PlaceholderMarker.tsx
// Server Component — the visible "not confirmed" marker for a fact the Council has not supplied,
// shown beside it on the beta preview (F19, vote 1C; the public build leaves the fact out).
// It carries the marker string the show pages already use (StatusMarker's fallback label) and the
// same chip treatment, without StatusMarker's decorative glyph: a glyph is a stray text leaf,
// and F19 adds no copy beyond the existing marker strings.
// =============================================================

export type PlaceholderMarkerTone = 'light' | 'dark';

const MARKER_LABEL = 'Not confirmed by SAOC';

const TONE_CLASSES: Record<PlaceholderMarkerTone, string> = {
  light: 'border-rule bg-parchment text-muted',
  dark: 'border-ivory/30 bg-ivory/10 text-ivory/80',
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
      className={[
        'mt-2 inline-flex items-start border px-2.5 py-1',
        'font-sans text-[12px] font-semibold uppercase leading-relaxed tracking-[0.14em]',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      {label}
    </span>
  );
}
