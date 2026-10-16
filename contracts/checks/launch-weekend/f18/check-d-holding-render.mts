// F18-A4 (render level, no CMS, no server): the holding state and the beta/public split, proved with fixture pages built the way hydratePage builds them
// (applyContentGaps(sections, withhold)), so the proof does not depend on live Sanity content or on a rebuilt server. Both modes, both layouts.
//   public, no real prose            -> exactly one [data-nos-holding]: facts, the existing "Be the first to know" band, NO related-page mini list (the full Explore index is the one list); NO [data-nos-content-gap], NO TBC label, NO gap sentence, NO builder purpose sentence
//   public, real prose + gap block   -> no holding; with hideContentGap the gap goes, without it F17's default holds (the gap renders)
//   beta (placeholders visible)      -> never a holding state; the labelled placeholder and its notice render
//   listing layout                   -> holding only when the listing is empty (listingEmpty) and no prose remains; the listing renders when it is not empty
//   fallback page (document absent)  -> the F24 marker data-nos-content-state="fallback-unpublished" survives on the holding section
//   RealEmptyListing                 -> the "Each entry will show" schema preview renders only when showSchemaPreview is true (default: beta only)
//   publicHeroLede                   -> undefined for every "drop" summary in goldens/f18/lede-verdicts.json, the text itself for every "keep"; no lede element renders for a dropped one
// Run: pnpm exec tsx contracts/checks/launch-weekend/f18/check-d-holding-render.mts   (cwd = implementation worktree; the "@/" alias needs tsx)
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ShowContentState } from '../../../../components/show/nos/ShowContentState';
import { RealEmptyListing } from '../../../../components/show/nos/RealEmptyListing';
import { wrapShowPageResult } from '../../../../components/show/nos/show-content-state-internal';
import { wrapGatedProse } from '../../../../components/nos/gated-prose-internal';
import { applyContentGaps, buildAbsentShowPage, CONTENT_GAP_LABEL, ABSENT_SHOW_PAGE_FIXED_SENTENCE, type ShowPage, type ShowPageSection } from '../../../../lib/data/show-pages';
import { publicHeroLede } from '../../../../lib/data/show-page-presentation';

const G = '.agent/memory/project/specs/launch-weekend/goldens/f18';
const tokens = JSON.parse(readFileSync(`${G}/tokens.json`, 'utf8'));
const verdicts = JSON.parse(readFileSync(`${G}/lede-verdicts.json`, 'utf8')) as { pages: { pageKey: string; summary: string; verdict: 'drop' | 'keep' }[] };
const H = tokens.holding;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const block = (text: string) => ({ _type: 'block', _key: `k-${text.length}`, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `s-${text.length}`, text, marks: [] }] });
const real = (key = 'overview'): ShowPageSection => ({ sectionKey: key, heading: 'A real heading', kind: 'prose', body: wrapGatedProse([block('A real sentence supplied by the Council.') as never], null), notice: null });
const noticeW = { label: 'Placeholder copy', text: 'This copy is a placeholder.', tone: 'warning' as const };
const placeholder = (key: string): ShowPageSection => ({ sectionKey: key, heading: 'Placeholder heading', kind: 'prose', body: wrapGatedProse([block('Invented filler sentence.') as never], noticeW), notice: noticeW });
const PURPOSE = 'The overall schedule of sessions across the four show days.';
const page = (sections: ShowPageSection[], extra: Partial<ShowPage> = {}): ShowPage => ({ pageKey: '11-programme', specNumber: 11, title: 'Programme', summary: null, sections, pageProvenance: 'placeholder-ai', notice: null, seoTitle: null, seoDescription: null, seoImage: null, ...extra });
const facts = [{ label: 'Dates', value: '23–26 September 2027' }, { label: 'Host', value: 'Fixture Host' }, { label: 'Venue', value: 'Fixture Venue' }, { label: 'Cycle', value: 'Triennial' }];
const render = (p: ShowPage, props: Record<string, unknown>) => renderToStaticMarkup(createElement(ShowContentState as never, { result: wrapShowPageResult(p), route: '/national-show/programme', layout: 'prose', holding: { facts }, ...props }));
const has = (html: string, s: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, '&').includes(s);

// 1. public, nothing supplied: the holding state replaces the page body.
const gapOnly = applyContentGaps([placeholder('a'), placeholder('b')], true);
const pub = render(page(gapOnly), {});
if ((pub.match(/data-nos-holding(?=[\s=>])/g) ?? []).length !== 1) fail('public, no prose: want exactly one [data-nos-holding]');
for (const bad of ['data-nos-content-gap', CONTENT_GAP_LABEL, ABSENT_SHOW_PAGE_FIXED_SENTENCE, 'Placeholder copy', 'Invented filler']) if (has(pub, bad)) fail(`public holding render still contains "${bad}"`);
if (!/data-nos-content-state="published"/.test(pub)) fail('public holding render lost data-nos-content-state="published"');
if (!/<h1\b/.test(pub)) fail('public holding render lost the hero h1');
for (const f of facts) if (!has(pub, f.label) || !has(pub, f.value)) fail(`holding facts: "${f.label}" / "${f.value}" not rendered`);
// no related-page mini list (design-cb rotation ruling 4, F18b commit 4): the full Explore index below the page is the one list
if (/data-nos-holding-cards?/.test(pub)) fail('the holding state still renders the related-page mini list (data-nos-holding-card[s]); the full Explore index is the one list');
if (has(pub, H.strings.cardsEyebrow)) fail(`the holding state still carries the "${H.strings.cardsEyebrow}" eyebrow of the retired mini list`);
for (const s of [H.strings.ctaEyebrow, H.strings.ctaTitle, H.strings.ctaAction]) if (!has(pub, s)) fail(`holding band misses "${s}"`);
if (!has(pub, `href="${H.strings.ctaHref}"`)) fail('holding band misses its /contact action');

// 1b. public fallback (document absent, the real buildAbsentShowPage with no beta wall = public mode): holding too, F24 marker kept, the manifest purpose (a builder brief) not rendered.
const fb = render(buildAbsentShowPage('11-programme', { label: 'Programme', purpose: PURPOSE }, null), {});
if (!/data-nos-content-state="fallback-unpublished"/.test(fb)) fail('fallback holding render lost data-nos-content-state="fallback-unpublished"');
if (!/data-nos-holding/.test(fb)) fail('fallback public render is not a holding state');
if (has(fb, PURPOSE)) fail('fallback public render shows the manifest purpose sentence (a builder brief)');

// 2. public with real prose: no holding; the F17 gap default and the hide prop both hold.
const mixed = applyContentGaps([real(), placeholder('x')], true);
const keep = render(page(mixed), {});
if (/data-nos-holding/.test(keep)) fail('a page with real prose rendered a holding state');
if (!/data-nos-content-gap="true"/.test(keep)) fail('default render (no hideContentGap) lost F17\'s gap block');
const hid = render(page(mixed), { hideContentGap: true });
if (/data-nos-content-gap/.test(hid) || has(hid, CONTENT_GAP_LABEL)) fail('hideContentGap no longer removes the gap block');
if (!has(hid, 'A real sentence supplied by the Council.') || /data-nos-holding/.test(hid)) fail('hideContentGap lost the real prose or produced a holding state');

// 3. beta: placeholders visible, never a holding state.
const beta = render(page(applyContentGaps([placeholder('a')], false)), {});
if (/data-nos-holding/.test(beta)) fail('beta mode rendered a holding state');
if (!has(beta, 'Invented filler sentence.') || !has(beta, 'This copy is a placeholder.')) fail('beta mode lost the labelled placeholder section or its notice');

// 4. listing layout.
const listing = (empty: boolean, mode: 'public' | 'beta') => render(page(mode === 'public' ? applyContentGaps([placeholder('a')], true) : applyContentGaps([placeholder('a')], false)), { layout: 'listing', route: '/national-show/international-guests', listingEmpty: empty, holding: { facts, statement: 'FIXTURE ABSENCE SENTENCE.' }, listingContent: createElement('div', { 'data-fixture-listing': '' }, 'LISTING') });
const l1 = listing(true, 'public');
if (!/data-nos-holding/.test(l1) || !has(l1, 'FIXTURE ABSENCE SENTENCE.')) fail('listing, public, empty: want the holding state carrying the page absence sentence');
if (/data-fixture-listing/.test(l1)) fail('listing, public, empty: the empty listing must not render beside the holding state');
const l2 = listing(false, 'public');
if (/data-nos-holding/.test(l2) || !/data-fixture-listing/.test(l2)) fail('listing, public, non-empty: want the listing and no holding state');
const l3 = listing(true, 'beta');
if (/data-nos-holding/.test(l3) || !/data-fixture-listing/.test(l3)) fail('listing, beta, empty: want the listing (with its schema preview) and no holding state');

// 5. RealEmptyListing schema preview is beta-only.
const rel = (p: Record<string, unknown>) => renderToStaticMarkup(createElement(RealEmptyListing as never, { fieldLabels: ['A', 'B'], absenceStatement: 'ABSENCE.', ...p }));
if (has(rel({ showSchemaPreview: false }), 'Each entry will show')) fail('RealEmptyListing showSchemaPreview=false still renders the schema preview');
if (!has(rel({ showSchemaPreview: true }), 'Each entry will show')) fail('RealEmptyListing showSchemaPreview=true lost the schema preview');
if (!has(rel({ showSchemaPreview: false }), 'ABSENCE.')) fail('RealEmptyListing dropped its absence statement');
process.env.SITE_PUBLIC_LAUNCH = 'true';
if (has(rel({}), 'Each entry will show')) fail('RealEmptyListing default in a public build renders the schema preview');
delete process.env.SITE_PUBLIC_LAUNCH;
process.env.SHOW_PLACEHOLDER_PREVIEW = 'true'; process.env.BETA_BASIC_AUTH_USER = 'u'; process.env.BETA_BASIC_AUTH_PASSWORD = 'p';
if (!has(rel({}), 'Each entry will show')) fail('RealEmptyListing default in the beta preview lost the schema preview');
delete process.env.SHOW_PLACEHOLDER_PREVIEW; delete process.env.BETA_BASIC_AUTH_USER; delete process.env.BETA_BASIC_AUTH_PASSWORD;

// 6. ledes (R76b).
for (const v of verdicts.pages) {
  const got = publicHeroLede(v.summary);
  if (v.verdict === 'drop' && got !== undefined) fail(`publicHeroLede keeps the builder brief of ${v.pageKey}: "${v.summary}"`);
  if (v.verdict === 'keep' && got !== v.summary) fail(`publicHeroLede changed or dropped the public summary of ${v.pageKey}`);
}
if (publicHeroLede(null) !== undefined || publicHeroLede(undefined) !== undefined) fail('publicHeroLede(null) must be undefined');
const dropped = verdicts.pages.find((v) => v.verdict === 'drop');
const keptp = verdicts.pages.find((v) => v.verdict === 'keep');
if (dropped && /data-nos-hero-lede/.test(render(page(applyContentGaps([real()], true), { summary: dropped.summary }), {}))) fail('a dropped summary still renders a hero lede through ShowContentState');
if (keptp && !has(render(page(applyContentGaps([real()], true), { summary: keptp.summary }), {}), keptp.summary)) fail('a kept summary no longer renders as the hero lede');
const theme = 'From Wild Origins to Cultivated Excellence: The Future of Orchids';
if (!has(render(page(applyContentGaps([real()], true), { summary: theme }), { ledeKind: 'theme' }), theme)) fail('the symposium theme line (R70) no longer renders as the hero lede');

if (problems.length) { console.error(`FAIL F18-A4 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A4 holding state, mode split, ledes (render level)');
