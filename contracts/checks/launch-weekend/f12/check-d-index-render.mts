// F12-A5 - the real NosShowIndex module, server-rendered with react-dom/server: current-page marking, 16 items kept, one aria-current.
// Run: pnpm exec tsx contracts/checks/launch-weekend/f12/check-d-index-render.mts
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import { NosShowIndex } from '../../../../components/nos/NosShowIndex';

const groups = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f12/hub-index-groups.json', 'utf8')) as { groups: { hrefs: string[] }[]; total: number };
const all = groups.groups.flatMap((g) => g.hrefs);
const problems: string[] = [];

const render = (current?: string) => renderToStaticMarkup(createElement(NosShowIndex as (p: { current?: string }) => ReturnType<typeof NosShowIndex>, current === undefined ? {} : { current }));
const anchors = (html: string) => [...html.matchAll(/<a\b([^>]*)>/g)].map((m) => ({ attrs: m[1], href: /href="([^"]*)"/.exec(m[1])?.[1] ?? '', aria: /aria-current="([^"]*)"/.exec(m[1])?.[1] ?? null, cls: /class="([^"]*)"/.exec(m[1])?.[1] ?? '' }));

for (const current of [undefined, '/national-show', '/national-show/faq', '/national-show/tickets', '/national-show/archive']) {
  const html = render(current);
  const a = anchors(html);
  const tag = `current=${current ?? '(omitted)'}`;
  if (a.length !== groups.total) problems.push(`${tag}: ${a.length} anchors, want ${groups.total} (the current page is marked, never omitted)`);
  if (JSON.stringify(a.map((x) => x.href)) !== JSON.stringify(all)) problems.push(`${tag}: anchor hrefs differ from the golden order`);
  const marked = a.filter((x) => x.aria !== null);
  const expected = current && all.includes(current) ? 1 : 0;
  if (marked.length !== expected) problems.push(`${tag}: ${marked.length} aria-current anchors, want ${expected}`);
  for (const mk of marked) {
    if (mk.href !== current) problems.push(`${tag}: aria-current on ${mk.href}`);
    if (mk.aria !== 'page') problems.push(`${tag}: aria-current="${mk.aria}", want "page"`);
    if (!/text-accent/.test(mk.cls) && !new RegExp(`aria-current[^>]*>[\\s\\S]{0,200}?text-accent`).test(html)) problems.push(`${tag}: the current item does not carry text-accent`);
  }
}
if (problems.length) { console.error(`FAIL F12-A5 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F12-A5 index render');
