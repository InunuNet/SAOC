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
   * `vertical` (default) is the compact mark — the footer colophon's size.
   * `horizontal` is the wide format for a masthead band at its widest.
   * `responsive` (the masthead's own orientation) renders `vertical` below
   * `xl` and swaps to `horizontal` from `xl` up, as a single logical mark —
   * two `<Image>`s CSS-toggled by breakpoint, never two live instances at
   * once, so a screen reader only ever meets one accessible name.
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
    // R21/8: 96px wide below `xl` ("sound minimum for a real placement"),
    // 48px tall (width auto) from `xl` up — chosen so the masthead band's
    // footprint stays close to its previous visual height rather than
    // growing the header. `sizes` matches each rendered box exactly, so
    // next/image's device-size selection isn't guessing from the viewport
    // (R22/8).
    return (
      <span className={['inline-block', className].filter(Boolean).join(' ')}>
        <Image
          src={verticalSrc(tone)}
          alt={NOS_LOCKUP_ALT}
          {...VERTICAL_NATIVE}
          sizes="96px"
          className="h-auto w-[96px] xl:hidden"
        />
        <Image
          src={horizontalSrc(tone)}
          alt={NOS_LOCKUP_ALT}
          {...HORIZONTAL_NATIVE}
          sizes="196px"
          className="hidden h-[48px] w-auto xl:block"
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
