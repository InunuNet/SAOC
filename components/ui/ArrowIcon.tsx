// The site's right-arrow mark as an inline SVG. U+2192 is not in the shipped Crimson Pro / Manrope /
// JetBrains Mono subsets and falls back to a system glyph, so every arrow is drawn here instead.
// Decorative; the link text carries the meaning.
//
// Geometry (NOS Design ruling): 1.25em wide, 1em tall box on a 25 x 20 grid (20 units = 1em).
// Stroke 2 units = 0.1em (the label's stem weight), round caps and joins; the open 45 degree
// chevron head is two 0.4em (8 unit) arms. The shaft sits on the label's cap-height midline: the
// box centre is raised to half a cap height above the baseline (`cap` unit, resolved against the
// label font), never `vertical-align: middle`. The 0.5em start margin adds to the label's own
// trailing letter-spacing. The wrapper span keeps the svg in an inline formatting context and
// inherits the label's line-height, so in a centred flex parent its line box matches the
// label's and the shaft lands on the label's cap-height midline.

// Two 0.4em (8 unit) arms at 45 degrees: each runs 8 / sqrt(2) = 5.657 units in x and in y.
const ARROW_SHAFT = 'M1 10H24';
const ARROW_HEAD = 'M18.343 4.343L24 10L18.343 15.657';

export function ArrowIcon({ className }: { className?: string }) {
  return (
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
      className={`ms-[0.5em] inline-block align-[calc(0.5cap-0.5em)] ${className ?? ''}`.trim()}
    >
      <path data-part="shaft" d={ARROW_SHAFT} />
      <path data-part="head" d={ARROW_HEAD} />
    </svg>
  );
}
