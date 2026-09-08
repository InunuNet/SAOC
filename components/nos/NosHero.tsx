// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. Full-bleed studio orchid photography under a
// dark-to-transparent royal-purple scrim, text on the dark end (design
// grammar — photography is the brand's signature device). No duotone,
// filter or vignette on the photograph itself — the flower supplies the
// colour; only the scrim gradient is applied, and only for legibility.
//
// Only the five rights-cleared production photographs may be passed as
// `image` — the 13-photo Ormerod set referenced in branding/ is NOT
// rights-cleared and must never reach this component (guardrail D5).
//
// The scrim was tuned to hold against the brightest cleared image,
// orchid-yellow.jpg (design grammar: "test that specific case") — density
// at the text end is deliberately higher than a mid-tone photo would need.
// =============================================================

import Image from 'next/image';
import type { ReactNode } from 'react';

export const NOS_HERO_IMAGES = [
  '/images/orchid-dark.jpg',
  '/images/orchid-pink.jpg',
  '/images/orchid-purple.jpg',
  '/images/orchid-violet.jpg',
  '/images/orchid-yellow.jpg',
] as const;

export type NosHeroImage = (typeof NOS_HERO_IMAGES)[number];

export interface NosHeroProps {
  image: NosHeroImage;
  /**
   * Rendered above the eyebrow, inside the scrim's dark band — typically an
   * `<EmblemBadge />`. Optional: most heroes carry no mark at all. The
   * flagship hero carries the modest emblem alone; the full lockup belongs to
   * the NOS masthead/colophon, not to a hero (F21).
   */
  brandMark?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  /**
   * `default` (unchanged) is the shared hero headline scale used by all twelve
   * heroes. `display` promotes the `<h1>` to the scoped `--display-xl` step —
   * reserve for the one flagship hero whose headline is the show's own name
   * (F21). It also switches on the top-down scrim band, because a display
   * headline pushes the content column up into the zone that band covers.
   */
  titleSize?: 'default' | 'display';
  lede?: string;
  /** Rendered below the lede, inside the scrim's dark band — typically a Button. */
  actions?: ReactNode;
  /**
   * CSS `object-position` for the photograph, e.g. `'50% 22%'`. Default
   * `'50% 50%'` (the browser default, and what every hero rendered before this
   * prop existed). Set it when the crop, not the scrim, is what has to move:
   * the scrims are contrast-tuned across the whole hero and darkening one to
   * dodge a bright region regresses the others (see the third scrim's note).
   * A call site passing this must record how the value was measured.
   */
  focalPoint?: string;
  /** Loads the image eagerly at high priority — reserve for the above-the-fold hero. */
  priority?: boolean;
  className?: string;
}

export function NosHero({
  image,
  brandMark,
  eyebrow,
  title,
  titleSize = 'default',
  lede,
  actions,
  focalPoint = '50% 50%',
  priority = false,
  className = '',
}: NosHeroProps) {
  const isDisplayTitle = titleSize === 'display';
  return (
    <section
      className={[
        // nos-on-dark (R9/3, R8/3): every hero renders over a dark scrim —
        // see the file header — so any focus ring or status colour inside
        // it must read the on-dark alias, not the on-light default. See
        // nos-theme.css's `.nos-theme .nos-on-dark` block.
        'nos-on-dark relative flex min-h-[520px] overflow-hidden bg-[var(--night)]',
        // Below `sm` a display hero stacks: type block first, photograph under
        // it. A display headline plus its lede and actions is tall enough that
        // at 390 the overlay layout leaves the photograph as a few visible
        // pixels of scrimmed texture behind a full-height text column — the
        // flower, which is the brand's signature device, is effectively gone.
        // Stacking gives the bloom its own 3:2 box (the image's own aspect, so
        // `object-cover` crops nothing there) beneath type that now sits on the
        // flat night ground. From `sm` up it is the overlay layout, unchanged.
        isDisplayTitle ? 'flex-col items-stretch sm:flex-row sm:items-end' : 'items-end',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Photograph and its scrims share one box so the two layouts differ by
          this element alone: absolutely filling the section (every hero, and
          the display hero from `sm` up), or an in-flow band below the type
          (display only, below `sm`). The scrims are `inset-0` on THIS box, so
          they travel with the photograph instead of washing over stacked type
          that no longer sits on it. */}
      <div
        className={
          isDisplayTitle
            ? 'relative order-2 aspect-[3/2] w-full sm:absolute sm:inset-0 sm:aspect-auto sm:w-auto'
            : 'absolute inset-0'
        }
      >
        <Image
          src={image}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: focalPoint }}
        />
        {/* Scrim: dark-to-transparent, bottom to top, purple-tinted near-black.
          Text sits in the dense band at the bottom. Tuned to clear 4.5:1 for
          pale-gold text against orchid-yellow.jpg's brightest region. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(14,11,36,0.95) 0%, rgba(14,11,36,0.82) 30%, rgba(14,11,36,0.45) 58%, rgba(14,11,36,0) 88%)',
          }}
        />
        {/* Second scrim, left to right, purple-tinted near-black. The text
          column is left-aligned inside the max-width container, but the
          photo's brightest region isn't guaranteed to sit under the
          right-hand two-thirds — orchid-yellow.jpg and orchid-pink.jpg (the
          two brightest cleared images) both have bright petals reaching
          into the left column, where small brand-tint text (an olive
          eyebrow, violet countdown digits) measured well under 4.5:1 even
          with the bottom-up scrim alone. This fade holds the text column
          dark regardless of what the photo underneath is doing there —
          on top of the bottom-up scrim, not instead of it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(14,11,36,0.85) 0%, rgba(14,11,36,0.55) 42%, rgba(14,11,36,0.12) 72%, rgba(14,11,36,0) 100%)',
          }}
        />
        {/* Third scrim, top-down, whenever the hero carries text high up. The
          bottom-up scrim is deliberately near-transparent at the very top of
          the hero (it exists to hold a headline at the BOTTOM), so anything
          sitting above the eyebrow lands in an unscrimmed zone. Measured
          directly against the composited photo (not an average): without this,
          the lockup's Jost subtitle line read 2.44:1 on orchid-violet.jpg.

          Gated on `brandMark || titleSize === 'display'`, not `brandMark`
          alone. A display-scale headline is far taller than the default one,
          so it pushes the whole content column UP into exactly the zone this
          band exists to cover — and it does so whether or not a mark sits
          above it. Measured with the band gone under a tall headline block,
          worst case across orchid-yellow/pink/violet at 390 and 1280:
          headline 1.37:1, strapline 2.49:1, eyebrow 1.23:1 — a regression, as
          the eyebrow had been passing. The other eleven heroes pass neither
          prop, so they render exactly as before.

          Retuned from h-[45%]/0.80 to h-[62%]/0.85 for the taller block.
          Restoring the old 45% band passes but only reaches 4.84:1 on the
          strapline — too thin for the line that already failed once.

          The 62% figure comes from measuring a THIRD width. Tuned against 390
          and 1280 alone, h-[55%]/0.82 looked comfortable at 7.37:1 worst case;
          adding 1024 to the sweep exposed the real worst case at 4.78:1
          (strapline, orchid-dark) — passing, but with 0.28 of headroom. The
          intermediate widths put the text on different ground than either
          endpoint, so two widths were not enough to characterise this scrim.
          h-[62%]/0.85 takes the worst case to 5.98:1; a denser 68%/0.86 reaches
          7.07:1 but starts visibly flattening the photograph, which is the
          brand's signature device. Lightest band that clears with real margin —
          gradient only, no duotone, filter or vignette on the photograph. */}
        {brandMark || isDisplayTitle ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[62%]"
            style={{
              background:
                'linear-gradient(to bottom, rgba(14,11,36,0.85) 0%, rgba(14,11,36,0.64) 55%, rgba(14,11,36,0) 100%)',
            }}
          />
        ) : null}
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-8 py-14">
        {brandMark ? <div className="mb-2">{brandMark}</div> : null}
        {/* Olive is legal text only on a flat royal-purple/night ground (6.16:1,
            golden table) — over a photograph, brand tints are decoration and
            legibility wins (guardrail 6). Measured `text-[var(--olive)]` at
            olive-on-bright-petal below 4.5:1 on orchid-yellow.jpg and
            orchid-pink.jpg; pale gold holds regardless of what's under it. */}
        {eyebrow ? (
          <span className="font-sans text-[12px] font-medium uppercase tracking-[0.3em] text-ivory">
            {eyebrow}
          </span>
        ) : null}
        {/* One `<h1>`, always — NosHero owns the page's heading level and no
            call site passes an element that carries its own. `display` only
            changes the type scale and the measure; the element, the font and
            the sentence casing are the same in both sizes. */}
        <h1
          className={[
            'font-serif font-medium leading-[1.05] text-ivory',
            isDisplayTitle
              ? // Measure, not just size: at --display-xl the full show name
                // fits on one line from ~1150px up, and a single 38-character
                // line reads as a strapline rather than a headline. The cap
                // holds it to two lines at every width — verified by counting
                // rendered line boxes at 390/1024/1280, not by trusting the
                // `ch` value (see the M7 hero-dom golden, D1.6).
                'max-w-[19ch] text-[length:var(--display-xl)]'
              : 'max-w-[20ch] text-[clamp(36px,5.6vw,64px)]',
          ].join(' ')}
        >
          {title}
        </h1>
        {lede ? (
          <p className="max-w-[58ch] font-sans text-[19px] leading-[1.55] text-[var(--lilac-pale)]">
            {lede}
          </p>
        ) : null}
        {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
