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
// The marker itself sits on the CONTENT region only (F3: the <section> that carries the
// rhythm), never the hero or the sub-nav (never-404-fallback.golden.md §2).
// =============================================================
import type { ReactNode } from 'react';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ShowPageProse } from '@/components/nos/ShowPageProse';
import type { ShowPageResult } from '@/lib/data/show-pages';

import { unwrapShowPageResult } from './show-content-state-internal';

export interface ShowContentStateProps {
  result: ShowPageResult;
  /** The route the hero heads; it decides photo or typographic hero and the sub-nav group. */
  route: string;
  /**
   * `'prose'` (programme, symposium, wosa-conference) renders every section in the one
   * content container. `'listing'` (sa-exhibitors, international-guests, sponsors) renders
   * only the `prose`-kind sections first, then `listingContent` below them in the same
   * container.
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
   * independent of the ShowPage (e.g. wosa-conference's WOSA link-out). Rendered in both
   * the published and the fallback branch; listingContent stays published-only.
   */
  afterProse?: ReactNode;
  /**
   * Static content rendered straight after the hero, in every state (e.g. symposium's
   * "Presenters (N)" jump link, R44-A5). No wrapper or styling of its own.
   */
  afterHero?: ReactNode;
}

export function ShowContentState({
  result,
  route,
  layout,
  listingContent,
  afterProse,
  afterHero,
}: ShowContentStateProps) {
  const page = unwrapShowPageResult(result);
  const state = page.isFallback === true ? 'fallback-unpublished' : 'published';

  return (
    <>
      <NosHero route={route} title={page.title} lede={page.summary ?? undefined} priority />

      {state === 'fallback-unpublished' ? (
        <NosSection data-nos-content-state={state} wrapClassName="space-y-10">
          {afterHero}
          {page.sections.map((section) => (
            <ShowPageProse key={section.sectionKey} section={section} />
          ))}
          {layout === 'prose' ? afterProse : null}
        </NosSection>
      ) : layout === 'listing' ? (
        <NosSection data-nos-content-state={state} wrapClassName="space-y-12">
          {afterHero}
          <div className="space-y-10">
            {page.sections
              .filter((section) => section.kind === 'prose')
              .map((section) => (
                <ShowPageProse key={section.sectionKey} section={section} />
              ))}
          </div>
          {listingContent}
        </NosSection>
      ) : (
        <NosSection data-nos-content-state={state} wrapClassName="space-y-10">
          {afterHero}
          {page.sections.map((section) => (
            <ShowPageProse key={section.sectionKey} section={section} />
          ))}
          {afterProse}
        </NosSection>
      )}
    </>
  );
}
