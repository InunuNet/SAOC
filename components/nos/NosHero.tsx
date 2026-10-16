// =============================================================
// NOS — components/nos/NosHero.tsx
// Server Component. The NOS hero, in two kinds that share one DOM contract:
//
//   photo  (R15) full-bleed studio orchid photography under one 90deg near-black ramp
//          (never purple), copy on the dark end. Only the five rights-cleared production
//          photographs may appear, each on exactly ONE route (R29, components/nos/
//          hero-photos.ts); the 13-photo Ormerod set in branding/ is NOT rights-cleared
//          (guardrail D5). No duotone, filter or vignette on the photograph itself.
//   type   (R29) every other route: a typographic hero on solid #0B0A14. h1 and standfirst
//          only, on the 1080px grid shared with the sections below. No image, svg, scrim.
//
// The route decides: `route` is looked up in the photo map; a route with no entry is
// typographic. Geometry, ramps and stack breakpoints live in nos-theme.css (`.nos-hero`),
// cited there to the approved mock. Selected by the F2/F3 checks:
//
//   section[data-nos-hero="hub" | "inner"][data-nos-hero-variant="photo" | "type"]
//     [data-nos-hero-media] > img            photo kind only
//     h1                                     exactly one
//     [data-nos-hero-lede]                   the lede / standfirst
//
// Directly after an inner hero comes the R27 group sub-nav (NosSubNav), except on the hub
// and on tickets, which have none.
// =============================================================

import Image from 'next/image';
import type { ReactNode } from 'react';

import { heroPhotoFor } from './hero-photos';
import { NosSubNav } from './NosSubNav';
import { subNavGroupFor } from './nos-subnav-groups';

/** Routes whose hero carries no group sub-nav: the hub (it has the destinations list) and tickets. */
const NO_SUBNAV_ROUTES: ReadonlySet<string> = new Set(['/national-show', '/national-show/tickets']);

export interface NosHeroProps {
  /** The pathname this hero heads, e.g. `/national-show/symposium` or `/national-show/archive/2024`. */
  route: string;
  title: ReactNode;
  /**
   * `default` renders the inner hero (R15 inner ramp, stacks at <=1023px). `display`
   * renders the hub hero (6-stop ramp, 22% photo inset) — reserve for the one flagship hero.
   */
  titleSize?: 'default' | 'display';
  lede?: string;
  /**
   * Hub: the hero body's remaining children (facts, CTAs, countdown) — rendered as
   * direct children of the body grid so the stacked order can move the facts after
   * the CTAs. Inner: a single optional link row below the standfirst.
   */
  actions?: ReactNode;
  /** Loads the image eagerly at high priority — reserve for the above-the-fold hero. */
  priority?: boolean;
  className?: string;
}

export function NosHero({
  route,
  title,
  titleSize = 'default',
  lede,
  actions,
  priority = false,
  className = '',
}: NosHeroProps) {
  const isHub = titleSize === 'display';
  const kind = isHub ? 'hub' : 'inner';
  const photo = heroPhotoFor(route);
  const variant = photo ? 'photo' : 'type';
  const group = NO_SUBNAV_ROUTES.has(route) ? null : subNavGroupFor(route);

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
          <div data-nos-hero-media="" className="nos-hero-media">
            <Image
              src={photo.src}
              alt=""
              fill
              priority={priority}
              sizes="100vw"
              className="nos-hero-img"
            />
          </div>
        ) : null}
        {isHub && photo ? <div aria-hidden="true" className="nos-hero-scrim" /> : null}
        <div className="nos-hero-copy">
          <h1 className="nos-hero-title">{title}</h1>
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
                <p data-nos-hero-lede="" data-nos-hero-text="lede" className="nos-hero-lede">
                  {lede}
                </p>
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
