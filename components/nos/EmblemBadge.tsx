// =============================================================
// NOS — components/nos/EmblemBadge.tsx
// Server Component. The vendored Disa graminifolia emblem — the show's only
// illustration (design grammar: "no gradients, no synthetic textures — the
// emblem is the only illustration"). Rendered as a plain <img>, not
// next/image: the emblem is a decorative vector mark, not a photograph, and
// this project's next.config.ts does not opt in to SVG image optimisation.
// =============================================================

export interface NosEmblemBadgeProps {
  /** Pixel size of the (roughly 3:2, 1264×848 viewBox) emblem. Defaults to 64. */
  size?: number;
  className?: string;
}

export function EmblemBadge({ size = 64, className = '' }: NosEmblemBadgeProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- decorative vector mark, see header
    <img
      src="/images/nos/disa-graminifolia-emblem.svg"
      alt=""
      role="presentation"
      width={size}
      height={Math.round((size * 848) / 1264)}
      className={className}
    />
  );
}
