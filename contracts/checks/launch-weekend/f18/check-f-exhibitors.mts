// F18-A6 (R77 #3): the Exhibitors key-dates table drops a dateNote that only restates "not set" (the chip already says it) and keeps everything else.
// Table-driven by goldens/f18/exhibitors-tbc.json; the predicate under test is the one the dev exports as restatesPending from lib/data/exhibitor-keydates-note.ts (or the dev's
// named module; the check discovers it: any file under lib/ or components/ exporting restatesPending). Then the live DOM: no rendered [data-nos-keydate-row] note matches the
// predicate on a pending row, every pending row still carries its chip.
// Run: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 pnpm exec tsx contracts/checks/launch-weekend/f18/check-f-exhibitors.mts   (cwd = implementation worktree)
import { execFileSync } from 'node:child_process';

import { BASE, T, readGolden, withBrowser, openPage } from './_lib.mjs';

const G = readGolden('exhibitors-tbc.json') as { pattern: string; flags: string; cases: { dateNote: string; status: string; rendered: boolean }[] };
const E = T.exhibitors;
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const re = new RegExp(G.pattern, G.flags);

const hit = execFileSync('grep', ['-rl', 'export.*restatesPending', 'lib', 'components'], { encoding: 'utf8' }).split('\n').filter(Boolean)[0];
if (!hit) fail('no module exports restatesPending (lib/ or components/)');
else {
  const mod = await import(`../../../../${hit}`);
  const fn = mod.restatesPending as (note: string | null | undefined, status?: string | null) => boolean;
  if (typeof fn !== 'function') fail(`${hit}: restatesPending is not a function`);
  else for (const c of G.cases) {
    const dropped = fn(c.dateNote, c.status);
    if (dropped === c.rendered) fail(`restatesPending(${JSON.stringify(c.dateNote)}, ${c.status}) = ${dropped}; the golden renders it: ${c.rendered}`);
  }
  if (typeof fn === 'function' && (fn(null, 'pending') !== false || fn('', 'pending') !== false)) fail('restatesPending must be false for an empty note (nothing to drop)');
}

await withBrowser(async (browser) => {
  const { ctx, page, status } = await openPage(browser, { width: 1280, height: 800 }, E.route);
  if (status !== 200) fail(`${E.route}: HTTP ${status}`);
  else {
    const rows = await page.evaluate(({ rowSel, markerSel }) => [...document.querySelectorAll(rowSel)].map((r) => ({ text: (r.textContent ?? '').replace(/\s+/g, ' ').trim(), marker: !!r.querySelector(markerSel), note: [...r.querySelectorAll('[data-nos-keydate-note], p, small')].map((n) => (n.textContent ?? '').trim()) })), { rowSel: E.rowSelector, markerSel: E.markerSelector });
    if (!rows.length) fail('no key-date rows on /exhibitors');
    for (const r of rows) if (r.marker) for (const n of r.note) if (n && re.test(n) && !/confirmed by the show committee/i.test(n)) fail(`a pending row still renders a restating sentence: "${n}"`);
    if (rows.some((r) => !r.marker && /not (yet )?set|to be set/i.test(r.text))) fail('a row without a chip says it is unset: the chip is the single marker');
  }
  await ctx.close();
});
void BASE;
if (problems.length) { console.error(`FAIL F18-A6 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A6 exhibitors key dates');
