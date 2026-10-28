// The site's right-arrow mark as an inline SVG (the same path as the NOS section-index arrow,
// components/nos/NosShowIndex.tsx). U+2192 is not in the shipped Crimson Pro / Manrope / JetBrains
// Mono subsets and falls back to a system glyph, so every arrow is drawn here instead: 1em,
// currentColor, sitting on the text baseline. Decorative; the link text carries the meaning.

export function ArrowIcon({ className }: { className?: string }) {
  return (
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
      className={`inline-block align-[-0.125em] ${className ?? ''}`.trim()}
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
