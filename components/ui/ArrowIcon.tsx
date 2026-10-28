// The site's right-arrow mark as an inline SVG (the same path as the NOS section-index arrow,
// components/nos/NosShowIndex.tsx). U+2192 is not in the shipped Crimson Pro / Manrope / JetBrains
// Mono subsets and falls back to a system glyph, so every arrow is drawn here instead: 1em,
// currentColor, sitting on the text baseline. Decorative; the link text carries the meaning.
// The wrapper span keeps the svg in an inline formatting context when the parent is a flex
// container, so the svg stays baseline-aligned there rather than centred as a flex item.

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <span className="inline-block leading-none">
      <svg
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        data-glyph="arrow"
        className={`inline-block align-[-0.125em] ${className ?? ''}`.trim()}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}
