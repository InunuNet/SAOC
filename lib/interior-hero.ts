// =============================================================
// SAOC — lib/interior-hero.ts
// The interior hero system (mission saoc-inner-heroes), shared by the SAOC PageHero and the NOS inner
// hero (Brad, 26 Nov 2026: "Where is the same system we use to fix the heroes on SAOC?"):
//   - the box: from 1024px a full-bleed photograph max(420px, 29.3vw) tall (600px at the 2048 frame);
//   - the scrim: an eased alpha ramp local to the copy column, clear over the bloom side, full strength
//     (0.8) over the copy. PageHero's copy column starts at 52% on the right; the NOS copy column ends at
//     a copy edge on the left, so the NOS scrim is PageHero's mirrored, with the home hero's eased tail.
// =============================================================

/** From 1024px the box is 600/2048 of the width tall. */
export const DESKTOP_HEIGHT_VW = 29.3;
/** ...and never shorter than this, so the copy always fits (the event hero with facts measures 415px at 1280). */
export const DESKTOP_TALL_HERO_PX = 420;

/**
 * The `sizes` of a full-bleed cover photograph from 1024px: a source wider than the box is height-driven, so it
 * is painted at box height x aspect when that is wider than the viewport.
 */
export function desktopCoverSize(aspect: number): string {
  return `max(100vw, calc(max(${DESKTOP_HEIGHT_VW}vw, ${DESKTOP_TALL_HERO_PX}px) * ${aspect}))`;
}

/** The `sizes` of a full-bleed cover photograph in a box `heightPx` tall. */
export function fixedHeightCoverSize(heightPx: number, aspect: number): string {
  return `max(100vw, ${Math.ceil(heightPx * aspect)}px)`;
}

/** The ramp as [alpha, position in percent of the hero width] for a copy column that starts at 52%. */
export const SCRIM_STOPS: readonly (readonly [number, number])[] = [
  [0, 34],
  [0.06, 38],
  [0.16, 42],
  [0.32, 45],
  [0.52, 48],
  [0.7, 50.5],
  [0.8, 52],
];

/** An `R G B` triple for the CSS `rgb()` space-separated syntax, e.g. `34 40 31`. */
const RGB_TRIPLE = /^\d{1,3} \d{1,3} \d{1,3}$/;

function assertRgb(rgb: string): void {
  if (!RGB_TRIPLE.test(rgb)) throw new Error(`hero scrim: '${rgb}' is not an 'R G B' triple`);
}

/** PageHero's scrim: clear on the left, full strength from 52% (its copy column) to the right edge. */
export function copyScrimGradient(rgb: string): string {
  assertRgb(rgb);
  const stops = SCRIM_STOPS.map(([alpha, at]) => `rgb(${rgb} / ${alpha}) ${at}%`).join(', ');
  return `linear-gradient(90deg, transparent 0, ${stops})`;
}

// The SAOC home hero's copy-scrim tail (app/globals.css `.home-hero [data-hero-scrim='copy']`: 0.88 easing to
// 0 in eleven stops 2.2% apart), as a share of its full alpha. It eases at both ends, so the edge of the full
// strength zone leaves no line. PageHero's ramp eases only at its clear end; mirrored onto a wide flat
// plateau, the slope change where it meets full strength reads as a vertical seam over a bright photograph.
const EASED_TAIL_SHARES: readonly number[] = [
  1, 0.9716, 0.8955, 0.784, 0.6477, 0.5, 0.3523, 0.2159, 0.1045, 0.0284, 0,
];
const EASED_TAIL_STEP_PERCENT = 2.2;
const ALPHA_PRECISION = 1000;

/**
 * PageHero's scrim mirrored for a copy column on the left that ends at `copyEnd` (a CSS length, e.g.
 * `var(--hero-copy-end)`): PageHero's full strength (0.8) from the left edge to `copyEnd`, then the home
 * hero's eased tail to clear over the next 22% of the hero width, so the bloom side is the bare photograph.
 */
export function mirroredCopyScrimGradient(rgb: string, copyEnd: string): string {
  assertRgb(rgb);
  const [fullAlpha] = SCRIM_STOPS[SCRIM_STOPS.length - 1];
  const stops = EASED_TAIL_SHARES.map((share, index) => {
    const alpha = Math.round(fullAlpha * share * ALPHA_PRECISION) / ALPHA_PRECISION;
    const offset = Math.round(index * EASED_TAIL_STEP_PERCENT * 10) / 10;
    const position = offset === 0 ? copyEnd : `calc(${copyEnd} + ${offset}%)`;
    return `rgb(${rgb} / ${alpha}) ${position}`;
  }).join(', ');
  return `linear-gradient(90deg, rgb(${rgb} / ${fullAlpha}) 0, ${stops})`;
}
