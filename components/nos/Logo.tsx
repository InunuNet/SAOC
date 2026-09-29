// =============================================================
// NOS — components/nos/Logo.tsx
// Server Component. Places the supplied lockup artwork — it does not build
// one. R23 ("The pages are building a lockup out of an emblem and type. They
// must not.") and R22 ("Place the supplied file. That is the whole
// instruction."): this used to compose the vendored emblem badge component
// with two hand-typeset wordmark lines; that composite is retired. The
// wordmark, the emblem and their relative geometry now all live inside one
// transparent PNG from `branding/National Show 2027/Logo/`, copied
// byte-identical into `public/images/nos/lockup/` and placed via
// `next/image` — the optimiser handles resize/re-encode at delivery, the
// same mechanism F1's hero lockup already uses (see
// `app/(marketing)/national-show/page.tsx`'s `HeroLockup`).
//
// The old badge component is untouched and kept — R23's own closing
// paragraph reserves it "for avatars and favicons," a different job than
// this lockup. It has no call site here any more; that is expected, not
// dead code.
//
// See .agent/memory/project/specs/nos-hero-lockup/goldens/f2-logo-lockup.md
// for the sizing/colourway derivation this file implements.
// =============================================================

import Image from 'next/image';

export interface NosLogoProps {
  /** `on-dark` for use over the royal-purple/night ground. */
  tone?: 'light' | 'on-dark';
  /**
   * `vertical` (default) is the compact mark, sized as a fixed 120px wide
   * standalone placement. `horizontal` is the wide format, sized as a fixed
   * 48px-tall standalone placement. Neither has a call site today — both are
   * kept for the component's public API (a future placement may need a
   * fixed, non-responsive size) — see f2-logo-lockup.md's "correction" note.
   * `responsive` is what the masthead and colophon both use: renders
   * `vertical` below 620px and swaps to `horizontal` at 620px and up, as a
   * single logical mark — two `<Image>`s CSS-toggled by breakpoint, never
   * two live instances at once, so a screen reader only ever meets one
   * accessible name. 620px is the same mobile threshold F1's hero lockup and
   * NosHero.tsx already switch on, not a second breakpoint invented for this.
   */
  orientation?: 'vertical' | 'horizontal' | 'responsive';
  className?: string;
}

// R21/6 + R23: the wordmark is baked into the artwork now, so the artwork
// carries the accessible name. This is the exact string F1 established for
// the hero lockup (`page.tsx`'s `HERO_LOCKUP_ALT`) — one name for one mark,
// wherever it's placed.
const NOS_LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';

// Native master dimensions (R20's supplied files) — passed as `width`/
// `height` so next/image reserves the correct aspect ratio and computes a
// correctly-dense candidate from `sizes`, never a resize of the file itself.
const VERTICAL_NATIVE = { width: 3272, height: 2876 };
const HORIZONTAL_NATIVE = { width: 4108, height: 1008 };

// Transparent PNGs both places (see f2-logo-lockup.md): the masthead's
// parchment ground and the colophon's night ground are each one value off a
// catalogued clearance, not an exact match, so the transparent file — which
// composites correctly against any ground by construction — is used rather
// than a baked JPG without a fresh pixel measurement for these two grounds.
function verticalSrc(tone: 'light' | 'on-dark'): string {
  return tone === 'on-dark'
    ? '/images/nos/lockup/NOS-2027-logo-full-colour-reversed-vertical.png'
    : '/images/nos/lockup/NOS-2027-logo-full-colour-vertical.png';
}

function horizontalSrc(tone: 'light' | 'on-dark'): string {
  return tone === 'on-dark'
    ? '/images/nos/lockup/NOS-2027-logo-full-colour-reversed-horizontal.png'
    : '/images/nos/lockup/NOS-2027-logo-full-colour-horizontal.png';
}

export function Logo({ tone = 'light', orientation = 'vertical', className = '' }: NosLogoProps) {
  if (orientation === 'responsive') {
    // Codi's F2 review (2026-09-29) superseded the original R21/8 sizing
    // (96px/120px) after finding both masthead and colophon illegible at
    // 1280 — "WESTERN CAPE · 2027" rendered ~3px tall. Replaced with a
    // measurement of the location line itself, the smallest text element in
    // the artwork and the part that was actually failing: the horizontal
    // file's location band is 67 of 4108px of its width, so it needs
    // >=440px rendered width for a >=7px cap height; the vertical file's
    // location band is 67 of 2876px of its height, needing >=300px rendered
    // height (~340px width at the file's native ratio) for the same floor.
    //
    // <620px: vertical file at min(340px, 100vw - 64px) — 64px is 2x the
    // 32px `px-8` gutter both the masthead's and the colophon's containers
    // actually use (no `--gutter` CSS var exists in this repo to reference
    // instead). >=620px: horizontal file at a flat 440px, `height: auto`.
    // `sizes` matches each rendered box exactly, so next/image's device-size
    // selection isn't guessing from the viewport (R22/8).
    return (
      <span className={['inline-block', className].filter(Boolean).join(' ')}>
        <Image
          src={verticalSrc(tone)}
          alt={NOS_LOCKUP_ALT}
          {...VERTICAL_NATIVE}
          sizes="min(340px, 100vw - 64px)"
          className="hidden h-auto w-[min(340px,100vw_-_64px)] max-[620px]:block"
        />
        <Image
          src={horizontalSrc(tone)}
          alt={NOS_LOCKUP_ALT}
          {...HORIZONTAL_NATIVE}
          sizes="440px"
          className="block h-auto w-[440px] max-[620px]:hidden"
        />
      </span>
    );
  }

  if (orientation === 'horizontal') {
    return (
      <Image
        src={horizontalSrc(tone)}
        alt={NOS_LOCKUP_ALT}
        {...HORIZONTAL_NATIVE}
        sizes="196px"
        className={['h-[48px] w-auto', className].filter(Boolean).join(' ')}
      />
    );
  }

  // `vertical` — the colophon's own orientation. R21/8: 120px wide ("clean
  // throughout — general use") — the footer has more headroom than the
  // masthead, so it gets the more generous end of the same legibility table.
  return (
    <Image
      src={verticalSrc(tone)}
      alt={NOS_LOCKUP_ALT}
      {...VERTICAL_NATIVE}
      sizes="120px"
      className={['h-auto w-[120px]', className].filter(Boolean).join(' ')}
    />
  );
}
