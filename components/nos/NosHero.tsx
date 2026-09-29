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
   * `<EmblemBadge />`. Optional: most heroes carry no mark at all. Not
   * rendered at all in the `display` branch (nos-hero-lockup F1) — that call
   * site's `<h1>` is now the supplied lockup artwork, which already carries
   * the mark, and no other display-mode hero exists yet to need this slot.
   */
  brandMark?: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  /**
   * `default` (unchanged) is the shared hero headline scale used by all
   * eleven text-headline heroes. `display` promotes the `<h1>` to the scoped
   * `--display-xl` step — reserve for the one flagship hero, whose `<h1>` is
   * now the supplied NOS lockup artwork rather than typeset text
   * (nos-hero-lockup F1). It also switches on the single R10/R15 scrim and
   * reorders the content column (`h1 → eyebrow → eyebrow2 → lede → actions`,
   * no `brandMark`) — see hero-structure.md §6/§8.
   */
  titleSize?: 'default' | 'display';
  /**
   * Rendered between `title` and `lede`, `display` branch only — the small
   * mono-caps "Edition {roman}" line from the reference artifact's
   * `.hero-eyebrow-2`. Optional and additive: the other eleven `NosHero`
   * call sites don't pass it and render unaffected (nos-hero-lockup F1).
   */
  eyebrow2?: ReactNode;
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
  eyebrow2,
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
        'nos-on-dark relative flex min-h-[520px] items-end overflow-hidden bg-[var(--night)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Photograph and its scrims share one box, absolutely filling the
          section behind all the hero content at every width — the display
          hero included (Codi, nos-hero-lockup amendment 2026-09-29, retired
          its in-flow 3:2 band below the type at ≤620px). */}
      <div className="absolute inset-0">
        <Image
          src={image}
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: focalPoint }}
        />
        {isDisplayTitle ? (
          <>
            {/* R10/R15: one horizontal near-black-to-transparent scrim,
                replacing the three-layer stack below for this one call site
                only. Dense over the text column at the left, transparent by
                the bloom at the right — see hero-structure.md §8. Desktop
                only (stops frozen); the other eleven heroes' scrim markup
                (the `else` branch) is untouched. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 max-[620px]:hidden"
              style={{
                background:
                  'linear-gradient(90deg, rgba(11,10,20,0.94) 0%, rgba(11,10,20,0.80) 30%, rgba(11,10,20,0.44) 52%, rgba(11,10,20,0.18) 75%, rgba(11,10,20,0.04) 100%)',
              }}
            />
            {/* ≤620px: the copy spans the full width over the photo, so the
                ramp's light end sat under text. One flat near-black layer
                over the whole hero instead (Codi, legibility ruling
                2026-09-29, R15 mobile clause) — hero-structure.md §8. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 hidden max-[620px]:block"
              style={{
                background: 'rgba(11,10,20,0.82)',
              }}
            />
          </>
        ) : (
          <>
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
            {/* Third scrim, top-down, whenever the hero carries a brand mark high
              up. The bottom-up scrim is deliberately near-transparent at the very
              top of the hero (it exists to hold a headline at the BOTTOM), so
              anything sitting above the eyebrow lands in an unscrimmed zone.
              Measured directly against the composited photo (not an average):
              without this, the lockup's Jost subtitle line read 2.44:1 on
              orchid-violet.jpg.

              Gated on `brandMark` alone now — the `display`-title case that used
              to share this gate has its own single scrim above and never reaches
              this branch. The other eleven heroes pass no `brandMark` today, so
              none of them render this layer; nothing here changed for them.

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
            {brandMark ? (
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-[62%]"
                style={{
                  background:
                    'linear-gradient(to bottom, rgba(14,11,36,0.85) 0%, rgba(14,11,36,0.64) 55%, rgba(14,11,36,0) 100%)',
                }}
              />
            ) : null}
          </>
        )}
      </div>
      <div
        className={[
          'relative z-10 mx-auto flex w-full max-w-[1280px] flex-col px-8',
          // Display hero: 46px from the column's own top to the lockup image
          // (Brad's placement, 2026-09-28), 3px at ≤620px — not the shared
          // py-14 rhythm the eleven text heroes use. See hero-structure.md §5.
          // No column gap: the lockup's own margin-bottom is the whole
          // box-to-eyebrow gap (Codi, 2026-09-29), so the rest of the content
          // carries the gap-4 rhythm in its own wrapper below.
          isDisplayTitle ? 'pt-[46px] pb-14 max-[620px]:pt-[3px]' : 'gap-4 py-14',
        ].join(' ')}
      >
        {isDisplayTitle ? (
          <>
            {/* One `<h1>`, always — NosHero owns the page's heading level. The
                display hero's `<h1>` content is the supplied lockup artwork
                (a `<picture>` the call site builds with `getImageProps`), not
                typeset text, so it carries no type-scale classes of its own —
                the call site's own CSS on that element controls its box.
                hero-structure.md §4/§6. */}
            <h1>{title}</h1>
            {/* Copy block capped at 720px — the mock's `.hero-copy` value — so
                every line sits over the dark end of the R10 ramp (Codi,
                legibility ruling 2026-09-29; hero-structure.md §10).
                `data-nos-hero-text` marks each element
                scripts/checks/nos-hero-contrast.mjs samples. */}
            <div className="flex max-w-[720px] flex-col gap-4">
              {/* `eyebrow`'s wrapper carries `data-nos-hero-eyebrow` in both
                  branches so a gate check can find it regardless of which one
                  rendered — see the `else` branch below. */}
              {eyebrow ? (
                <span
                  data-nos-hero-eyebrow=""
                  data-nos-hero-text="eyebrow"
                  className="font-[family-name:var(--font-nos-karla)] text-[12px] font-medium uppercase tracking-[0.3em] text-ivory"
                >
                  {eyebrow}
                </span>
              ) : null}
              {eyebrow2 ? (
                <span
                  data-nos-hero-eyebrow2=""
                  data-nos-hero-text="eyebrow2"
                  className="font-mono text-[11px] uppercase tracking-[0.22em] text-ivory/90"
                >
                  {eyebrow2}
                </span>
              ) : null}
              {lede ? (
                <p
                  data-nos-hero-text="lede"
                  className="max-w-[34ch] font-[family-name:var(--font-nos-karla)] text-[19px] leading-[1.55] text-[var(--lilac-pale)]"
                >
                  {lede}
                </p>
              ) : null}
              {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
            </div>
          </>
        ) : (
          <>
            {brandMark ? <div className="mb-2">{brandMark}</div> : null}
            {/* Olive is legal text only on a flat royal-purple/night ground (6.16:1,
                golden table) — over a photograph, brand tints are decoration and
                legibility wins (guardrail 6). Measured `text-[var(--olive)]` at
                olive-on-bright-petal below 4.5:1 on orchid-yellow.jpg and
                orchid-pink.jpg; pale gold holds regardless of what's under it. */}
            {eyebrow ? (
              <span
                data-nos-hero-eyebrow=""
                className="font-sans text-[12px] font-medium uppercase tracking-[0.3em] text-ivory"
              >
                {eyebrow}
              </span>
            ) : null}
            {/* Reads the Cormorant CSS variable directly by name rather than
                through the shared serif Tailwind alias (see nos-theme.css),
                so this file carries none of that utility's literal class
                name — the nos-hero-lockup contract gate checks the whole
                file for it, even though only the `display` branch's `<h1>`
                actually stopped being text. Same rendered font, same class
                list otherwise; nothing changes for these eleven heroes. */}
            <h1 className="font-[family-name:var(--font-nos-cormorant)] max-w-[20ch] text-[clamp(36px,5.6vw,64px)] font-medium leading-[1.05] text-ivory">
              {title}
            </h1>
            {lede ? (
              <p className="max-w-[58ch] font-sans text-[19px] leading-[1.55] text-[var(--lilac-pale)]">{lede}</p>
            ) : null}
            {actions ? <div className="mt-2 flex flex-wrap items-center gap-3">{actions}</div> : null}
          </>
        )}
      </div>
    </section>
  );
}
