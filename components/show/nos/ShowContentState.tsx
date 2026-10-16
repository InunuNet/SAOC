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

import { LongFormPage } from '@/components/nos/LongFormPage';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ShowPageProse, showPageProseParts } from '@/components/nos/ShowPageProse';
import type { ShowFact } from '@/lib/data/show-facts';
import {
  withholdPlaceholderProse,
  type ShowPageResult,
  type ShowPageSection,
} from '@/lib/data/show-pages';
import { publicHeroLede } from '@/lib/data/show-page-presentation';

import { HoldingState } from './HoldingState';
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
  /** `theme` renders the page summary as the show's theme line in the hero (R70, symposium). */
  ledeKind?: 'theme';
  /**
   * Drops the R11 content-gap section (the muted "To be confirmed by the show committee"
   * block that applyContentGaps() substitutes for withheld copy) so the page ends on its
   * real content. Only the gap is hidden: a labelled placeholder section never is.
   */
  hideContentGap?: boolean;
  /**
   * R76 (F18): in PUBLIC mode (withholdPlaceholderProse()), a page with no real prose renders
   * the holding state (facts, sibling cards, the "Be the first to know" band) instead of a gap
   * block. `facts` are the show facts; `statement` is the page's own absence sentence;
   * `keepAfterProse` keeps `afterProse` after the cards. Never renders in beta, never hides
   * real prose, and a fallback page keeps its data-nos-content-state marker on the holding section.
   */
  holding?: { facts: readonly ShowFact[]; statement?: string; keepAfterProse?: boolean };
  /** Listing-layout routes: true while the listing has no entries (a holding page needs both). */
  listingEmpty?: boolean;
  /**
   * R75 (F18): renders the page's first council-supplied prose section in the shared long-form
   * template (components/nos/LongFormPage.tsx) instead of the plain prose block. Published
   * branch only; a page with no such section renders as before.
   */
  longform?: { facts: readonly ShowFact[] };
}

export function ShowContentState({
  result,
  route,
  layout,
  listingContent,
  afterProse,
  afterHero,
  ledeKind,
  hideContentGap,
  holding,
  listingEmpty,
  longform,
}: ShowContentStateProps) {
  const page = unwrapShowPageResult(result);
  const withhold = withholdPlaceholderProse();
  // A listing page's body is its listing (with its own absence sentence), so a gap block is
  // never rendered in front of it.
  const sections =
    hideContentGap || layout === 'listing'
      ? page.sections.filter((section) => !section.notice?.gap)
      : page.sections;
  const state = page.isFallback === true ? 'fallback-unpublished' : 'published';
  // Public mode drops a builder-brief summary from the lede; beta shows it as it always did.
  const lede = withhold ? publicHeroLede(page.summary) : (page.summary ?? undefined);
  const hero = (
    <NosHero route={route} title={page.title} lede={lede} ledeKind={ledeKind} priority />
  );

  // The fallback page's own sections (a gap block, the manifest purpose) are never real prose.
  const realProse =
    page.isFallback === true ? [] : sections.filter((section) => !section.notice?.gap);
  // A listing layout renders only its prose-kind sections; a prose layout renders them all.
  const isRendered = (section: ShowPageSection) => layout !== 'listing' || section.kind === 'prose';
  const renderedProse = realProse.filter(isRendered);
  const holdsNow =
    withhold && (layout === 'prose' || listingEmpty === true) && renderedProse.length === 0;

  if (holdsNow && holding) {
    return (
      <>
        {hero}
        {afterHero}
        <HoldingState
          route={route}
          facts={holding.facts}
          statement={holding.statement}
          afterCards={holding.keepAfterProse ? afterProse : null}
          contentState={state}
        />
      </>
    );
  }

  const lead =
    longform && state === 'published'
      ? sections.find((section) => section.kind === 'prose' && showPageProseParts(section) !== null)
      : undefined;
  const leadParts = lead ? showPageProseParts(lead) : null;
  const rest = lead ? sections.filter((section) => section !== lead) : sections;

  return (
    <>
      {hero}

      {state === 'fallback-unpublished' ? (
        <NosSection data-nos-content-state={state} wrapClassName="space-y-10">
          {afterHero}
          {sections.map((section) => (
            <ShowPageProse key={section.sectionKey} section={section} />
          ))}
          {layout === 'prose' ? afterProse : null}
        </NosSection>
      ) : layout === 'listing' ? (
        <NosSection data-nos-content-state={state} wrapClassName="space-y-12">
          {afterHero}
          {leadParts && longform ? (
            <LongFormPage
              facts={longform.facts}
              heading={leadParts.heading}
              pageTitle={page.title}
              paragraphs={leadParts.paragraphs}
            />
          ) : null}
          <div className="space-y-10">
            {rest
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
          {sections.map((section) => (
            <ShowPageProse key={section.sectionKey} section={section} />
          ))}
          {afterProse}
        </NosSection>
      )}
    </>
  );
}
