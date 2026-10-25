// F7 rendered at 390@3, 768@1, 1280@1 and 1440@2 (SAOC host).
//   TG-1 standalone links are >=44px tall with their text size, colour and underline unchanged
//        (compared with goldens/f7-visual-baseline.json, recorded on the unchanged tree):
//        society page email, phone, website, Facebook, Instagram; home "Full calendar"; /contact info@.
//        The /societies search input (and its row) is >=44px tall.
//        ("All events" on event pages is F5; /events/submit inputs are F6.) Inline prose links are exempt:
//        only the anchors named above are measured.
//   SG-1 html has scrollbar-gutter: stable on the SAOC host and on the NOS host.
// Society pages come from the live listing: up to 30 are crawled, and each link kind must be found at
// least once, so the check cannot pass by measuring nothing.
// Run as: node contracts/checks/polish-wave-2026-10-25/f7-targets-rendered.mjs [--record]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { finish, repoRoot } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';

const RECORD = process.argv.includes('--record');
const BASELINE_PATH = resolve(repoRoot, '.agent/memory/project/specs/polish-wave-2026-10-25/goldens/f7-visual-baseline.json');
const failures = [];
const stale = buildProblem(['app/globals.css']);
if (stale.length) finish('f7-targets-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];
const SOCIETY_KINDS = {
  email: (p) => p.locator('dd a[href^="mailto:"]').first(),
  phone: (p) => p.locator('dd a[href^="tel:"]').first(),
  website: (p) => p.getByRole('link', { name: /Visit society website/ }).first(),
  facebook: (p) => p.getByRole('link', { name: /Facebook page/ }).first(),
  instagram: (p) => p.getByRole('link', { name: /Instagram page/ }).first(),
};
const look = (el) => el.evaluate((n) => {
  const cs = getComputedStyle(n);
  const r = n.getBoundingClientRect();
  return { h: r.height, fontSize: cs.fontSize, color: cs.color, deco: cs.textDecorationLine };
});

const baseline = RECORD ? {} : JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const recorded = {};
function judge(tag, kind, m) {
  if (RECORD) { recorded[kind] ??= { fontSize: m.fontSize, color: m.color, deco: m.deco }; return; }
  if (m.h < 44) failures.push(`${tag} ${kind}: ${m.h.toFixed(1)}px tall, want >=44`);
  const b = baseline[kind];
  if (!b) failures.push(`${tag} ${kind}: no baseline record`);
  else if (b.fontSize !== m.fontSize || b.color !== m.color || b.deco !== m.deco) {
    failures.push(`${tag} ${kind}: look changed (${m.fontSize} ${m.color} ${m.deco}), baseline ${b.fontSize} ${b.color} ${b.deco}`);
  }
}

const srv = await startServer();
const browser = await chromium.launch();
try {
  const listing = await get(srv.port, '/societies', 'localhost');
  const slugs = [...new Set([...listing.body.matchAll(/href="\/societies\/([a-z0-9-]+)"/g)].map((m) => m[1]))].slice(0, 30);
  if (slugs.length < 3) failures.push(`only ${slugs.length} society links on /societies; check cannot run`);
  const seen = new Set();

  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    const go = (host, path) => page.goto(`http://${host}:${srv.port}${path}`, { waitUntil: 'load', timeout: 30000 });

    for (const slug of slugs) {
      await go('localhost', `/societies/${slug}`);
      for (const [kind, find] of Object.entries(SOCIETY_KINDS)) {
        const el = find(page);
        if ((await el.count()) === 0) continue;
        seen.add(kind);
        judge(`${tag} /societies/${slug}`, `society-${kind}`, await look(el));
      }
    }
    await go('localhost', '/');
    const cal = page.getByRole('link', { name: /Full calendar/ }).first();
    if ((await cal.count()) === 0) failures.push(`${tag} home: no "Full calendar" link`);
    else judge(`${tag} /`, 'home-full-calendar', await look(cal));

    await go('localhost', '/contact');
    const info = page.locator('main a[href="mailto:info@saoc.co.za"]').first();
    if ((await info.count()) === 0) failures.push(`${tag} /contact: no info@ link`);
    else judge(`${tag} /contact`, 'contact-info-email', await look(info));

    await go('localhost', '/societies');
    const search = page.locator('#societies-search');
    const sb = await search.boundingBox();
    if (!sb) failures.push(`${tag} /societies: no search input`);
    else if (!RECORD && sb.height < 44) failures.push(`${tag} /societies search input is ${sb.height.toFixed(1)}px tall, want >=44`);

    for (const host of ['localhost', 'nos.localhost']) {
      await go(host, host === 'localhost' ? '/about' : '/');
      const gutter = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter);
      if (!RECORD && !/^stable\b/.test(gutter)) failures.push(`${tag} ${host}: html scrollbar-gutter is "${gutter}", want stable`);
    }
    await ctx.close();
  }
  for (const kind of Object.keys(SOCIETY_KINDS)) if (!seen.has(kind)) failures.push(`no society page among the first ${slugs.length} has a ${kind} link; check would be vacuous`);
} finally {
  await browser.close();
  srv.stop();
}
if (RECORD) {
  writeFileSync(BASELINE_PATH, JSON.stringify(recorded, null, 2) + '\n');
  console.log('RECORDED', Object.keys(recorded).join(', '));
} else {
  finish('f7-targets-rendered', failures);
}
