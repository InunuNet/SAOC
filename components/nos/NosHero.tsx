// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. The NOS hero, in two kinds that share one DOM contract:
//
//   photo  the inner hero is the SAOC interior hero system (Brad, 26 Nov 2026, superseding NOS
//          Design NH2's split panel): from 768px a full-bleed photograph, copy top-anchored in a
//          left column on the mirrored PageHero scrim in the NOS ink (lib/interior-hero.ts), the
//          bloom side bare; below 768px a 2/1 photo band leads and the copy sits under it. The hub
//          (`titleSize="display"`) keeps its full-bleed photograph under the 6-stop ramp. Only
//          the rights-cleared production photographs may appear (components/nos/hero-photos.ts);
//          the 13-photo Ormerod set in branding/ is NOT rights-cleared (guardrail D5). No
//          duotone, filter, transform or vignette on the photograph itself.
//   type   (R29) a route with no crop: a typographic hero on solid #0B0A14, same min-height and
//          top-anchored copy, no image, svg or scrim.
//
// The route decides: `route` is looked up in the crop map (inner) or the photo map (hub); a
// route with no entry is typographic. Geometry and stack breakpoints live in nos-theme.css
// (`.nos-hero`). Selected by the F2/F3 checks:
//
//   section[data-nos-hero="hub" | "inner"][data-nos-hero-variant="photo" | "type"]
//     [data-nos-hero-media] > img            photo kind only
//     h1                                     exactly one (a loading.tsx fallback passes titleAs="p")
//     [data-nos-hero-lede]                   the lede / standfirst
//
// Inner heroes: [data-nos-hero-box] holds the crumbs, h1 and lede (the locked hero box from 1024 on a
// photo hero); [data-nos-hero-detail] holds the facts and actions, under the box on the page ground.
//
// Directly after an inner hero comes the R27 group sub-nav (NosSubNav), except on the hub
// and on tickets, which have none.
// =============================================================

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { HeroPicture } from '@/components/ui/HeroPicture';
import { heroSourceAspect } from '@/lib/data/saoc-hero-photos';
import type { ShowFact } from '@/lib/data/show-facts';
import { type HeroFact, normaliseHeroFacts } from '@/lib/hero-facts';
import heroSourceWidths from '@/lib/hero-source-widths.json';
import {
  fixedHeightCoverSize,
  mirroredCopyScrimGradient,
} from '@/lib/interior-hero';

import { heroCropFor, heroPhotoFor } from './hero-photos';
import { NosSubNav } from './NosSubNav';
import { getVisibleNav } from '@/lib/data/past-shows-public';
import { subNavGroupFor } from './nos-subnav-groups';

// A full-bleed hero photograph with large variants (lib/hero-source-widths.json) is served from the quality-88 set,
// up to its native width (lib/image-loader.ts), so it is never stretched on a high-density screen.
const FULL_BLEED_QUALITY = 88;

// The inner photo hero is the SAOC interior hero system (lib/interior-hero.ts; Brad, 26 Nov 2026), mirrored: the
// photograph is full bleed at every width from 768px, the copy column sits on the left on the NOS ink (--black,
// rgb 11 10 20) eased scrim, and the bloom side is the bare photograph. Below 768px the photograph is a 2:1 band
// above the title block, so no text sits over it. The box heights are in nos-structure.css (Inner hero sizing).
// The locked box (Brad, 26 Nov 2026: about 268px at 1288): nos-structure.css `clamp(268px, 20.8vw, 480px)`.
const INNER_TABLET_BOX_PX = 268;
const INNER_DESKTOP_BOX = 'clamp(268px, 20.8vw, 480px)';
const INNER_PHONE_BAND_VW = 50;
const INNER_SCRIM = mirroredCopyScrimGradient('11 10 20', 'var(--hero-copy-end)');

/** The `sizes` of the inner photograph: a cover image is as wide as the larger of the box and box height x aspect. */
function innerPhotoSizes(src: string): string {
  const aspect = heroSourceAspect(src);
  return [
    `(max-width: 767px) max(100vw, calc(${INNER_PHONE_BAND_VW}vw * ${aspect}))`,
    `(max-width: 1023px) ${fixedHeightCoverSize(INNER_TABLET_BOX_PX, aspect)}`,
    `max(100vw, calc(${INNER_DESKTOP_BOX} * ${aspect}))`,
  ].join(', ');
}

// HB-3: the hub photo's painted width per band, from the box it fills with object-fit: cover on the
// 3:2 source. At 767px and below the media is a fixed-height band (height x aspect wide); from
// 1024px it fills the hero, up to its height ceiling; between, the 2/1 band is width-driven.
const HUB_PHONE_BAND_HEIGHT_PX = 300;
const HUB_DESKTOP_MAX_HEIGHT_PX = 820;
const HUB_SOURCE_ASPECT = 1.5;
const HUB_PHOTO_SIZES = `(max-width: 767px) max(100vw, ${Math.round(HUB_PHONE_BAND_HEIGHT_PX * HUB_SOURCE_ASPECT)}px), (min-width: 1024px) max(100vw, ${Math.round(HUB_DESKTOP_MAX_HEIGHT_PX * HUB_SOURCE_ASPECT)}px), 100vw`;

// LT-1: an inner h1 longer than this gets `.is-long`, a smaller clamp that holds it to one line in the 62% column.
const LONG_TITLE_CHARS = 20;

// The locked photo box (from 1024) holds the crumbs, a one-line h1 and two lede lines in its 570px text
// column. A longer lede, or any lede under a long (two-line) title, cannot fit the locked height, so it
// leaves the box and leads the detail on the page ground, as every lede does below 1024 (27 Nov 2026:
// /vendors/apply clipped 41-49px, the early-bird and SAOC-symposium tickets 20-34px over).
const LEDE_IN_BOX_MAX_CHARS = 100;

/** Whether an inner photo hero's lede goes under the locked box, on the page ground, instead of inside it. */
function ledeLeavesBox(title: ReactNode, lede: ReactNode): boolean {
  if (typeof lede !== 'string') return false;
  const longTitle = typeof title === 'string' && title.length > LONG_TITLE_CHARS;
  return longTitle || lede.length > LEDE_IN_BOX_MAX_CHARS;
}

const FALLBACK_TITLE_STYLE: CSSProperties = {
  fontFamily: 'var(--serif)',
  fontOpticalSizing: 'none',
  textWrap: 'balance',
};

/** Routes whose hero carries no group sub-nav: the hub (it has the destinations list) and tickets. */
const NO_SUBNAV_ROUTES: ReadonlySet<string> = new Set(['/national-show', '/national-show/tickets']);

// buildShowFacts() fills an absent field with these strings. A hero fact is a real value or it is
// omitted: HeroFact has no "to be confirmed" shape (shared API, lib/hero-facts.ts).
const SHOW_FACT_FILLER: ReadonlySet<string> = new Set([
  'Dates to be confirmed',
  'Venue to be confirmed',
  'Host region to be confirmed',
]);

/**
 * The hero facts a page takes from the published show facts: only the named labels, in the order
 * named, with any filler value omitted. `normaliseHeroFacts` then drops the row below two facts.
 */
export function heroFactsFromShow(
  showFacts: readonly ShowFact[],
  labels: readonly string[],
): HeroFact[] {
  const facts: HeroFact[] = [];
  for (const label of labels) {
    const fact = showFacts.find((candidate) => candidate.label === label);
    if (fact && !SHOW_FACT_FILLER.has(fact.value)) {
      facts.push({ term: fact.label, value: fact.value });
    }
  }
  return facts;
}

const YEAR = /\b(\d{4})\b/;
const LEADING_WEEKDAY = /^[A-Za-z]+\s+/;

/**
 * The facts of one bookable event (SY-G1, WO-G1): its date without the weekday plus the show's year, its
 * hours as the ticket product states them, and the venue from the published show facts. A fact with no
 * value is left out, never filled; `normaliseHeroFacts` then drops the row below two facts.
 */
export function heroFactsForEvent(
  showFacts: readonly ShowFact[],
  product: { when: string; meta: string | null },
): HeroFact[] {
  const year = showFacts.find((fact) => fact.label === 'Dates')?.value.match(YEAR)?.[1];
  const day = product.when.replace(LEADING_WEEKDAY, '');
  const date = year && day ? `${day} ${year}` : null;
  const venue = heroFactsFromShow(showFacts, ['Venue']);
  return [
    ...(date ? [{ term: 'Date', value: date }] : []),
    ...(product.meta ? [{ term: 'Time', value: product.meta }] : []),
    ...venue,
  ];
}

export interface NosHeroProps {
  /** The pathname this hero heads, e.g. `/national-show/symposium` or `/national-show/archive/2024`. */
  route: string;
  title: ReactNode;
  /**
   * `default` renders the inner hero (R15 inner ramp, stacks at <=1023px). `display`
   * renders the hub hero (6-stop ramp, 22% photo inset) — reserve for the one flagship hero.
   */
  titleSize?: 'default' | 'display';
  /**
   * The element carrying the title. `p` is for a Suspense `loading.tsx` fallback: streaming leaves the
   * fallback in the document beside the resolved page, so an h1 there would double the page's own h1.
   * Every `.nos-hero-title` rule applies to either element.
   */
  titleAs?: 'h1' | 'p';
  lede?: ReactNode;
  /** `theme` sets the inner lede as a show's theme line (italic serif, R70) rather than a standfirst. */
  ledeKind?: 'theme';
  /**
   * Hub: the hero body's remaining children (facts, CTAs, countdown) — rendered as
   * direct children of the body grid so the stacked order can move the facts after
   * the CTAs. Inner: a single optional link row below the standfirst.
   */
  actions?: ReactNode;
  /** The facts row under the lede (2-4 real values; fewer than two renders no row). */
  facts?: readonly HeroFact[];
  /** A link target per fact term (e.g. a `tel:` href): that fact's value renders as a link. */
  factLinks?: Readonly<Record<string, string>>;
  /** A short label above the h1 (e.g. "Legal"); rendered only where the page already has the string. */
  eyebrow?: ReactNode;
  /** An optional breadcrumb trail, rendered before the h1 (the checkout step's hub trail, r18). */
  crumbs?: ReactNode;
  /** The current page's name: draws the standard "National Show — {name}" trail when `crumbs` is not given. */
  crumbLabel?: string;
  /** Loads the image eagerly at high priority — reserve for the above-the-fold hero. */
  priority?: boolean;
  className?: string;
}

export async function NosHero({
  route,
  title,
  titleSize = 'default',
  titleAs = 'h1',
  lede,
  ledeKind,
  actions,
  eyebrow,
  facts,
  factLinks,
  crumbs,
  crumbLabel,
  priority = false,
  className = '',
}: NosHeroProps) {
  const isHub = titleSize === 'display';
  const kind = isHub ? 'hub' : 'inner';
  const photo = isHub ? heroPhotoFor(route) : heroCropFor(route);
  const variant = photo ? 'photo' : 'type';
  const heroFacts = normaliseHeroFacts(facts);
  const titleClass =
    !isHub && typeof title === 'string' && title.length > LONG_TITLE_CHARS
      ? 'nos-hero-title is-long'
      : 'nos-hero-title';
  const group = NO_SUBNAV_ROUTES.has(route) ? null : subNavGroupFor(route, await getVisibleNav());
  const groundLede = Boolean(photo) && !isHub && ledeLeavesBox(title, lede);
  const hasDetail = Boolean(heroFacts || actions || groundLede);
  const ledeEl = lede ? (
    <p data-nos-hero-lede="" data-nos-hero-text="lede" data-nos-lede={ledeKind} className="nos-hero-lede">
      {lede}
    </p>
  ) : null;
  const head = (
    <>
      {eyebrow ? (
        <p data-nos-hero-eyebrow="" className="nos-hero-eyebrow">
          {eyebrow}
        </p>
      ) : null}
      {crumbs ??
        (crumbLabel ? (
          <nav className="nk-crumbs" aria-label="Breadcrumb">
            <Link href="/">National Orchid Show</Link>
            <span className="nk-crumb">
              <span className="nk-sep" aria-hidden="true">
                <span className="sr-only">–</span>
              </span>
              <span aria-current="page">{crumbLabel}</span>
            </span>
          </nav>
        ) : null)}
      {titleAs === 'p' ? (
        // Restates the heading rule in nos-theme.css (`.nos-theme :is(h1...)`), which a p misses,
        // so the fallback is identical to the h1 it stands in for on the first frame.
        <p className={titleClass} style={FALLBACK_TITLE_STYLE}>
          {title}
        </p>
      ) : (
        <h1 className={titleClass}>{title}</h1>
      )}
    </>
  );

  return (
    <>
      <section
        data-nos-hero={kind}
        data-nos-hero-variant={variant}
        // nos-on-dark: every hero renders over near-black, so focus rings and status
        // colours inside it read the on-dark aliases (see nos-theme.css).
        className={['nos-on-dark', 'nos-hero', `nos-hero-${kind}`, `nos-hero-${variant}`, className]
          .filter(Boolean)
          .join(' ')}
      >
        {photo ? (
          <div
            data-nos-hero-media=""
            className="nos-hero-media"
            style={
              photo.objectPosition
                ? ({ '--nos-hero-pos': photo.objectPosition } as CSSProperties)
                : undefined
            }
          >
            {isHub ? (
              <Image
                src={photo.src}
                alt=""
                fill
                priority={priority}
                fetchPriority={priority ? 'high' : undefined}
                sizes={HUB_PHOTO_SIZES}
                quality={photo.src in heroSourceWidths ? FULL_BLEED_QUALITY : undefined}
                className="nos-hero-img"
              />
            ) : (
              <HeroPicture
                src={photo.src}
                priority={priority}
                sizes={innerPhotoSizes(photo.src)}
                className="nos-hero-img"
              />
            )}
          </div>
        ) : null}
        {isHub && photo ? <div aria-hidden="true" className="nos-hero-scrim" /> : null}
        {!isHub && photo ? (
          <div
            data-hero-scrim="copy"
            aria-hidden="true"
            className="nos-hero-copy-scrim"
            style={{ '--scrim-gradient': INNER_SCRIM } as CSSProperties}
          />
        ) : null}
        <div className="nos-hero-copy">
          {isHub ? (
            <>
              {head}
              <div className="nos-hero-body">
                {lede ? (
                  <p data-nos-hero-lede="" data-nos-hero-text="lede" className="nos-hero-lede">
                    {lede}
                  </p>
                ) : null}
                {actions}
              </div>
            </>
          ) : (
            <>
              <div data-nos-hero-box="" className="nos-hero-box">
                <div data-nos-hero-head="" className="nos-hero-head">
                  {head}
                </div>
                {groundLede ? null : ledeEl}
              </div>
              {hasDetail ? (
                <div data-nos-hero-detail="" className="nos-hero-detail">
                  {groundLede ? ledeEl : null}
                  {heroFacts ? (
                    <dl data-hero-facts="" data-fact-count={heroFacts.length} className="hero-facts">
                      {heroFacts.map((fact) => (
                        <div key={fact.term} data-hero-fact="">
                          <dt>{fact.term}</dt>
                          <dd>
                            {factLinks?.[fact.term] ? (
                              <a href={factLinks[fact.term]}>{fact.value}</a>
                            ) : (
                              fact.value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {actions ? <div className="nos-hero-actions">{actions}</div> : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
      {group && group.items.length > 1 ? (
        <NosSubNav
          label={`${group.heading} pages`}
          items={group.items}
          currentHref={group.currentHref}
          exact={group.exact}
        />
      ) : null}
    </>
  );
}
