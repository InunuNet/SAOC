// F17-A8 (render level, no CMS, no server): the symposium public-mode gap block. The real ShowContentState is server-rendered with fixture pages built the way
// loadShowPage builds them (hydrate -> applyContentGaps), so the proof does not depend on live Sanity content or on an env toggle.
//  default (no prop)            : the gap block renders exactly as before (rule, notice, data-nos-content-gap)  -> every other page is unchanged
// Run with: pnpm exec tsx contracts/checks/launch-weekend/f17/check-h-symposium-render.mts (the component imports use the "@/" alias, which plain node --import tsx/esm does not resolve).
//  hideContentGap               : no [data-nos-content-gap], no TBC notice text, the real theme section and the published marker survive
//  preview mode (no gap exists) : a warning-toned placeholder section still renders with its notice, hideContentGap or not (only the GAP is hidden)
//  fallback page                : still emits data-nos-content-state="fallback-unpublished"
// Static: only app/(marketing)/national-show/symposium/page.tsx passes hideContentGap, programme and wosa-conference do not.
// Run: pnpm exec tsx contracts/checks/launch-weekend/f17/check-h-symposium-render.mts   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ShowContentState } from '../../../../components/show/nos/ShowContentState';
import { wrapShowPageResult } from '../../../../components/show/nos/show-content-state-internal';
import { wrapGatedProse } from '../../../../components/nos/gated-prose-internal';
import { applyContentGaps, CONTENT_GAP_LABEL, type ShowPage, type ShowPageSection } from '../../../../lib/data/show-pages';

const tokens = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f17/tokens.json', 'utf8')) as { symposium: { hideProp: string; gapSelector: string } };
const PROP = tokens.symposium.hideProp;
const problems: string[] = [];

const block = (text: string) => ({ _type: 'block', _key: `k-${text.length}`, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `s-${text.length}`, text, marks: [] }] });
// PortableTextBlock is the library's own type; the fixture only needs the runtime shape.
const real: ShowPageSection = { sectionKey: 'theme', heading: 'Symposium theme', kind: 'prose', body: wrapGatedProse([block('A real theme sentence from the Council.') as never], null), notice: null };
const placeholderNotice = { label: 'Placeholder copy', text: 'This copy is a placeholder.', tone: 'warning' as const };
const placeholder: ShowPageSection = { sectionKey: 'about-the-symposium', heading: 'About the Symposium', kind: 'prose', body: wrapGatedProse([block('Invented filler.') as never], placeholderNotice), notice: placeholderNotice };

const page = (sections: ShowPageSection[], isFallback = false): ShowPage => ({ pageKey: '06-saoc-symposium', specNumber: 6, title: 'National Orchid Show Symposium', summary: 'A theme line.', sections, pageProvenance: 'council-supplied', notice: null, seoTitle: null, seoDescription: null, seoImage: null, ...(isFallback ? { isFallback: true } : {}) });
const render = (p: ShowPage, extra: Record<string, unknown>) => renderToStaticMarkup(createElement(ShowContentState as never, { result: wrapShowPageResult(p), route: '/national-show/symposium', layout: 'prose', ledeKind: 'theme', ...extra }));

const withheld = applyContentGaps([real, placeholder], true);
if (!withheld.some((s) => s.notice?.gap)) problems.push('fixture error: applyContentGaps produced no gap section');

const a = render(page(withheld), {});
if (!/data-nos-content-gap="true"/.test(a)) problems.push('default render lost its gap block: every other page would change');
if (!a.includes(CONTENT_GAP_LABEL)) problems.push('default render lost the TBC label');

const b = render(page(withheld), { [PROP]: true });
if (/data-nos-content-gap/.test(b)) problems.push(`${PROP}: a [data-nos-content-gap] block still renders`);
if (b.includes(CONTENT_GAP_LABEL)) problems.push(`${PROP}: the TBC label still renders`);
if (!b.includes('A real theme sentence from the Council.') || !/data-section-key="theme"/.test(b)) problems.push(`${PROP}: the real theme section is gone`);
if (!/data-nos-content-state="published"/.test(b)) problems.push(`${PROP}: the published content-state marker is gone`);
if (!/<h1\b/.test(b)) problems.push(`${PROP}: the hero h1 is gone`);
const proseBlocks = [...b.matchAll(/<div class="nos-show-page-prose[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
for (const m of proseBlocks) if (!/<h2\b/.test(m[1])) problems.push(`${PROP}: a prose block renders without a heading, which leaves an empty left grid cell`);

const preview = applyContentGaps([real, placeholder], false);
for (const extra of [{}, { [PROP]: true }]) {
  const c = render(page(preview), extra);
  if (!c.includes('This copy is a placeholder.') || !c.includes('Invented filler.')) problems.push(`preview mode ${JSON.stringify(extra)}: the labelled placeholder section no longer renders (only the GAP may be hidden)`);
}

const d = render(page([placeholder], true), { [PROP]: true });
if (!/data-nos-content-state="fallback-unpublished"/.test(d)) problems.push('fallback page lost data-nos-content-state="fallback-unpublished"');

const only = (file: string) => readFileSync(file, 'utf8').includes(PROP);
if (!only('app/(marketing)/national-show/symposium/page.tsx')) problems.push(`symposium/page.tsx does not pass ${PROP}`);
for (const f of ['programme', 'wosa-conference', 'sa-exhibitors', 'international-guests', 'sponsors']) {
  if (only(`app/(marketing)/national-show/${f}/page.tsx`)) problems.push(`${f}/page.tsx passes ${PROP}: the hide is symposium-only`);
}

if (problems.length) { console.error(`FAIL F17-A8 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F17-A8 symposium gap render');
