// =============================================================
// NOS — components/show/nos/ShowContentState.tsx
// F24 (national-show-ia-alignment, M4) — Server Component. THE ONLY renderer of a
// loadShowPageOrFallback() result, and the ONLY emitter of the data-nos-content-state
// marker (A7). It owns the fallback branch outright — the route author supplies only
// the published branch's listing/extra content, never the fallback markup itself — so
// rendering a fallback and emitting its marker and disclosure are the same act. Both
// branches emit the marker from the SAME discriminant this component switches on: one
// file, one expression, no second place to write it.
//
// See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/never-404-fallback.golden.md
// and goldens/m4/content-state-verifier.golden.md.
//
// It also owns the hero (NosHero) and the section-prose rendering for BOTH branches,
// which is what keeps `.sections`/`.title`/`.isFallback` out of every route module —
// ShowPageResult is opaque, so a route could not reach them even if it tried (NF15).
// The marker itself wraps the CONTENT region only, never the hero or ShowSectionNav
// (never-404-fallback.golden.md §2) — those render outside the marked div, and
// ShowSectionNav is still rendered by each route, unaffected by this component.
// =============================================================
import type { ReactNode } from 'react';

import { NosHero, type NosHeroImage } from '@/components/nos/NosHero';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import type { ShowPageResult } from '@/lib/data/show-pages';

import { unwrapShowPageResult } from './show-content-state-internal';

export interface ShowContentStateProps {
  result: ShowPageResult;
  heroImage: NosHeroImage;
  /**
   * `'prose'` (programme, symposium, wosa-conference) renders every section in a single
   * 900px column. `'listing'` (sa-exhibitors, international-guests, sponsors) renders
   * only the `prose`-kind sections in that column, then `listingContent` below it in a
   * 1280px outer wrapper — matching each route's pre-F24 layout exactly.
   */
  layout: 'prose' | 'listing';
  /**
   * Listing-layout routes only: the entity grid or RealEmptyListing built from data
   * fetched independently of the ShowPage (e.g. vendorNursery/showSponsor). Rendered in
   * the published branch only — an absent page shows the disclosure alone, never a
   * listing built alongside it.
   */
  listingContent?: ReactNode;
  /**
   * Prose-layout routes only: static content the route always wants after its prose,
   * independent of the ShowPage (e.g. wosa-conference's WOSA link-out). Rendered in the
   * published branch only, same rule as listingContent.
   */
  afterProse?: ReactNode;
}

export function ShowContentState({
  result,
  heroImage,
  layout,
  listingContent,
  afterProse,
}: ShowContentStateProps) {
  const page = unwrapShowPageResult(result);
  const state = page.isFallback === true ? 'fallback-unpublished' : 'published';

  return (
    <>
      <NosHero
        image={heroImage}
        eyebrow="National Show"
        title={page.title}
        lede={page.summary ?? undefined}
        priority
      />

      <div data-nos-content-state={state}>
        {state === 'fallback-unpublished' ? (
          <div className="mx-auto max-w-[900px] space-y-10 px-8 py-16">
            {page.sections.map((section) => (
              <ShowPageProse key={section.sectionKey} section={section} />
            ))}
          </div>
        ) : layout === 'listing' ? (
          <div className="mx-auto max-w-[1280px] space-y-12 px-8 py-16">
            <div className="mx-auto max-w-[900px] space-y-10">
              {page.sections
                .filter((section) => section.kind === 'prose')
                .map((section) => (
                  <ShowPageProse key={section.sectionKey} section={section} />
                ))}
            </div>
            {listingContent}
          </div>
        ) : (
          <div className="mx-auto max-w-[900px] space-y-10 px-8 py-16">
            {page.sections.map((section) => (
              <ShowPageProse key={section.sectionKey} section={section} />
            ))}
            {afterProse}
          </div>
        )}
      </div>
    </>
  );
}
