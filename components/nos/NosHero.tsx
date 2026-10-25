// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. The NOS hero, in two kinds that share one DOM contract:
//
//   photo  (NOS Design NH2) the inner split studio panel: copy top-anchored on solid #0B0A14,
//          one cropped studio photograph in a 46% panel flush right (16px bottom-left radius,
//          no scrim); below 768px a 2/1 photo band leads and the copy sits under it. The hub
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
// Directly after an inner hero comes the R27 group sub-nav (NosSubNav), except on the hub
// and on tickets, which have none.
// =============================================================

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import type { ShowFact } from '@/lib/data/show-facts';
import { type HeroFact, normaliseHeroFacts } from '@/lib/hero-facts';
import heroSourceWidths from '@/lib/hero-source-widths.json';

import { heroCropFor, heroPhotoFor } from './hero-photos';
import { NosSubNav } from './NosSubNav';
import { getVisibleNav } from '@/lib/data/past-shows-public';
import { subNavGroupFor } from './nos-subnav-groups';

// A full-bleed hero photograph with large variants (lib/hero-source-widths.json) is served from the quality-88 set,
// up to its native width (lib/image-loader.ts), so it is never stretched on a high-density screen.
const FULL_BLEED_QUALITY = 88;

// DS-1 (c): the photo box is 62% wide from 768px (38% to the right edge), a full-width band below it.
// From 768 to 1023 the box is narrower than the 1.9:1 crop is wide at hero height, so object-fit: cover
// paints the crop at height x aspect (about 920px at the tallest hero measured there).
const INNER_PHOTO_SIZES = '(min-width: 1024px) 62vw, (min-width: 768px) max(62vw, 920px), 100vw';

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
  const group = NO_SUBNAV_ROUTES.has(route) ? null : subNavGroupFor(route, await getVisibleNav());

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
            <Image
              src={photo.src}
              alt=""
              fill
              priority={priority}
              fetchPriority={priority ? 'high' : undefined}
              sizes={isHub ? '100vw' : INNER_PHOTO_SIZES}
              quality={photo.src in heroSourceWidths ? FULL_BLEED_QUALITY : undefined}
              className="nos-hero-img"
            />
          </div>
        ) : null}
        {isHub && photo ? <div aria-hidden="true" className="nos-hero-scrim" /> : null}
        <div className="nos-hero-copy">
          {eyebrow ? (
            <p data-nos-hero-eyebrow="" className="nos-hero-eyebrow">
              {eyebrow}
            </p>
          ) : null}
          {crumbs ??
            (crumbLabel ? (
              <nav className="nk-crumbs" aria-label="Breadcrumb">
                <Link href="/">National Show</Link>
                <span className="nk-crumb">
                  <span className="nk-sep" aria-hidden="true" />
                  <span aria-current="page">{crumbLabel}</span>
                </span>
              </nav>
            ) : null)}
          {titleAs === 'p' ? (
            // Restates the heading rule in nos-theme.css (`.nos-theme :is(h1...)`), which a p misses,
            // so the fallback is identical to the h1 it stands in for on the first frame.
            <p className="nos-hero-title" style={FALLBACK_TITLE_STYLE}>
              {title}
            </p>
          ) : (
            <h1 className="nos-hero-title">{title}</h1>
          )}
          {isHub ? (
            <div className="nos-hero-body">
              {lede ? (
                <p data-nos-hero-lede="" data-nos-hero-text="lede" className="nos-hero-lede">
                  {lede}
                </p>
              ) : null}
              {actions}
            </div>
          ) : (
            <>
              {lede ? (
                <p
                  data-nos-hero-lede=""
                  data-nos-hero-text="lede"
                  data-nos-lede={ledeKind}
                  className="nos-hero-lede"
                >
                  {lede}
                </p>
              ) : null}
              {heroFacts ? (
                <dl data-hero-facts="" data-fact-count={heroFacts.length} className="hero-facts">
                  {heroFacts.map((fact) => (
                    <div key={fact.term} data-hero-fact="">
                      <dt>{fact.term}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {actions ? <div className="nos-hero-actions">{actions}</div> : null}
            </>
          )}
        </div>
      </section>
      {group ? (
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
