// The site's right-arrow mark as an inline SVG. U+2192 is not in the shipped Crimson Pro / Manrope /
// JetBrains Mono subsets and falls back to a system glyph, so every arrow is drawn here instead.
// Decorative; the link text carries the meaning.
//
// Geometry (NOS Design ruling): 1.25em wide, 1em tall box on a 25 x 20 grid (20 units = 1em).
// Stroke 2 units = 0.1em (the label's stem weight), round caps and joins; the open 45 degree
// chevron head is 0.4em (8 units) deep. The shaft sits on the label's cap-height midline: the
// box centre is raised to half a cap height above the baseline (`cap` unit, resolved against the
// label font), never `vertical-align: middle`. The 0.5em start margin adds to the label's own
// trailing letter-spacing. The wrapper span keeps the svg in an inline formatting context and
// inherits the label's line-height, so in a centred flex parent its line box matches the
// label's and the shaft lands on the label's cap-height midline.

const ARROW_SHAFT_AND_HEAD = 'M1 10H24M16 2L24 10L16 18';

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <span className="ms-[0.5em] inline-block">
      <svg
        viewBox="0 0 25 20"
        width="1.25em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        data-glyph="arrow"
        className={`inline-block align-[calc(0.5cap-0.5em)] ${className ?? ''}`.trim()}
      >
        <path d={ARROW_SHAFT_AND_HEAD} />
      </svg>
    </span>
  );
}
