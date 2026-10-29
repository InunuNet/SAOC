// The site's right-arrow mark as an inline SVG. U+2192 is not in the shipped Crimson Pro / Manrope /
// JetBrains Mono subsets and falls back to a system glyph, so every arrow is drawn here instead.
// Decorative; the link text carries the meaning.
//
// Geometry (NOS Design ruling): 1em tall box on a 20-unit grid (20 units = 1em). Stroke 2 units =
// 0.1em (the label's stem weight), round caps and joins; the open 45 degree chevron head is two
// 0.4em (8 unit) arms, each running 8 / sqrt(2) = 5.657 units in x and in y. The shaft sits on the
// label's cap-height midline: the box centre is raised to half a cap height above the baseline
// (`cap` unit, resolved against the label font), never `vertical-align: middle`.
//
// Two variants. "label" (default) follows a label: 1.25em wide, with a 0.5em start margin that
// adds to the label's own trailing letter-spacing. "corner" is a card's right-aligned arrow that
// shares the title's first line: 1em wide, no margin. Callers mark the card or link element
// with data-variant="corner".
//
// direction="back" mirrors the label arrow (scaleX(-1)) for a link that leads with it: same 1.25em
// box, head and stem, but the 0.5em gap goes after the arrow (margin-inline-end), with no literal
// space in the markup.

export type ArrowVariant = 'label' | 'corner';

const ARROW_ARM = 5.657;
const ARROW_CENTRE_Y = 10;
const ARROW_START_X = 1;
const ARROW_OFFSET_X = 1;

const VARIANT_WIDTH_UNITS: Record<ArrowVariant, number> = { label: 25, corner: 20 };
const BACK_CLASSES = 'me-[0.5em] -scale-x-100';
const VARIANT_CLASSES: Record<ArrowVariant, string> = { label: 'ms-[0.5em]', corner: '' };

interface ArrowIconProps {
  className?: string;
  variant?: ArrowVariant;
  direction?: 'forward' | 'back';
}

export function ArrowIcon({ className, variant = 'label', direction = 'forward' }: ArrowIconProps) {
  const widthUnits = VARIANT_WIDTH_UNITS[variant];
  const tipX = widthUnits - ARROW_OFFSET_X;
  const armX = (tipX - ARROW_ARM).toFixed(3);
  const shaft = `M${ARROW_START_X} ${ARROW_CENTRE_Y}H${tipX}`;
  const head = `M${armX} ${ARROW_CENTRE_Y - ARROW_ARM}L${tipX} ${ARROW_CENTRE_Y}L${armX} ${ARROW_CENTRE_Y + ARROW_ARM}`;
  const back = direction === 'back';
  const classes = [
    back ? BACK_CLASSES : VARIANT_CLASSES[variant],
    'inline-block align-[calc(0.5cap-0.5em)]',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${widthUnits} 20`}
      width={`${widthUnits / 20}em`}
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-glyph="arrow"
      data-direction={back ? 'back' : undefined}
      className={classes}
    >
      <path data-part="shaft" d={shaft} />
      <path data-part="head" d={head} />
    </svg>
  );
}
