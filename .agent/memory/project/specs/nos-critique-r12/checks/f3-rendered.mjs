// nos-critique-r12 f3 rendered (production build, next start 3010-3019). For every 404 route the head is read twice: from the served HTML
// (fetch) and from the hydrated DOM in Chromium (network idle + 1.5s), because a nested notFound() can hydrate back to the layout's metadata.
//   NOS 404 (/national-show/zz-r12-missing, /national-show/zz-r12/nested): HTTP 404, one title "Page not found — National Orchid Show | SAOC",
//     no canonical, the NOS lede as the one description, robots present and every one noindex.
//   SAOC 404 (/zz-r12-missing, /zz-r12/nested) and the missing ticket (/tickets/zz-r12-missing): one title "Page not found | South African Orchid
//     Council" (distinct from the home title), no canonical, the SAOC lede, noindex. The SAOC 404s answer 404; the missing ticket's status is
//     recorded, not asserted (tickets/[slug]/loading.tsx streams a 200 before notFound(); see f3-spec.md).
//   Landmarks: each 404 has exactly one <main>, and axe-core (default rule set) reports no violation at 375 and 1280.
//   Zero visual change: on the SAOC 404, the missing ticket and /societies/zz-r12-missing, the not-found <section> box and the document size
//     equal goldens/f3-baseline.json (captured by @architect on a 26fde668 build; `--capture` prints it), and the new <main> has no margin,
//     padding or border.
//   S7 routes (lead finding 2): /societies/zz-r12-missing, /events/zz-r12-missing (SAOC not-found) and /national-show/archive/1800 (NOS not-found) meet the
//     same head, landmark and axe rules in the served HTML and the hydrated DOM.
//   Non-regression: the home, hub, archive and /tickets/vip heads keep their 26fde668 title (vip: or F4's NOS title) and canonical.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { finish, golden, repoRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, axeSource, require, startServer } from './_server.mjs';
import { HOME_TITLE, LEDE, SAOC_LEDE, SAOC_TITLE, TITLE } from './_f3.mjs';

const { chromium } = require('playwright');
const NAME = 'f3-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const WIDTHS = [375, 1280];
const HYDRATION_SETTLE_MS = 1500;
const BOX_TOLERANCE_PX = 0.5;
const NOT_FOUND = [
  { route: '/national-show/zz-r12-missing', status: 404, title: TITLE, lede: LEDE },
  { route: '/national-show/zz-r12/nested', status: 404, title: TITLE, lede: LEDE },
  { route: '/zz-r12-missing', status: 404, title: SAOC_TITLE, lede: SAOC_LEDE, box: true, newMain: true },
  { route: '/zz-r12/nested', status: 404, title: SAOC_TITLE, lede: SAOC_LEDE },
  { route: '/tickets/zz-r12-missing', status: null, title: SAOC_TITLE, lede: SAOC_LEDE, box: true },
  { route: '/societies/zz-r12-missing', status: 404, title: SAOC_TITLE, lede: SAOC_LEDE, box: true },
  { route: '/events/zz-r12-missing', status: 404, title: SAOC_TITLE, lede: SAOC_LEDE },
  { route: '/national-show/archive/1800', status: 404, title: TITLE, lede: LEDE },
];
const BOX_ONLY = [];
const KEEP = [
  { route: '/', title: HOME_TITLE, canonical: 'https://saoc.co.za' },
  { route: '/national-show', title: 'National Orchid Show | South African Orchid Council', canonical: 'https://saoc.co.za/national-show' },
  { route: '/national-show/archive', title: 'Archive — National Orchid Show | SAOC', canonical: 'https://saoc.co.za/national-show/archive' },
  // F4 moves every ticket title onto the NOS template (f4-spec.md), so either the 26fde668 title or F4's is kept.
  { route: '/tickets/vip', title: ['VIP Ticket | South African Orchid Council', 'VIP Ticket — National Orchid Show | SAOC'], canonical: 'https://saoc.co.za/tickets/vip' },
];
const failures = [];

const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function headOfHtml(html) {
  const all = (re) => [...html.matchAll(re)].map((m) => decode(m[1]));
  return { titles: all(/<title>([^<]*)<\/title>/g), canonicals: all(/<link rel="canonical" href="([^"]*)"/g), descriptions: all(/<meta name="description" content="([^"]*)"/g), robots: all(/<meta name="robots" content="([^"]*)"/g) };
}
const headOfDom = () => ({
  titles: [document.title],
  canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
  descriptions: [...document.querySelectorAll('meta[name="description"]')].map((m) => m.getAttribute('content')),
  robots: [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.getAttribute('content')),
});
const measureBox = () => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return [b.x, b.y + window.scrollY, b.width, b.height].map((v) => Math.round(v * 100) / 100); };
  const h1 = [...document.querySelectorAll('h1')].find((h) => h.textContent.trim() === 'This orchid has left the bench.');
  const main = document.querySelector('main');
  const cs = main ? getComputedStyle(main) : null;
  return { section: r(h1 ? h1.closest('section') : null), doc: [document.documentElement.scrollWidth, document.documentElement.scrollHeight], mainBox: cs ? ['margin', 'padding', 'border-width'].map((p) => ['top', 'right', 'bottom', 'left'].map((s) => cs.getPropertyValue(p === 'border-width' ? `border-${s}-width` : `${p}-${s}`)).join(' ')) : null };
};

function checkHead(tag, h, want) {
  if (h.titles.length !== 1 || h.titles[0] !== want.title) failures.push(`${tag}: titles ${JSON.stringify(h.titles)}, want ["${want.title}"]`);
  if (want.title === SAOC_TITLE && h.titles[0] === HOME_TITLE) failures.push(`${tag}: the 404 title equals the home title`);
  if (h.canonicals.length) failures.push(`${tag}: canonical ${JSON.stringify(h.canonicals)}, want none`);
  if (h.descriptions.length !== 1 || h.descriptions[0] !== want.lede) failures.push(`${tag}: descriptions ${JSON.stringify(h.descriptions)}, want ["${want.lede}"]`);
  if (!h.robots.length || !h.robots.every((c) => /\bnoindex\b/.test(c))) failures.push(`${tag}: robots ${JSON.stringify(h.robots)}, want at least one, every one noindex`);
}

let browser;
let srv;
const boxes = {};
const statuses = {};
try {
  const sourceFiles = [...new Set(['f1', 'f2', 'f3'].flatMap((f) => JSON.parse(golden(`${f}-footprint.json`))))].filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR12_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR12_ORIGIN ? { origin: process.env.NOS_CR12_ORIGIN, stop: () => {} } : await startServer();
  const axe = axeSource();
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  for (const want of [...NOT_FOUND, ...BOX_ONLY.map((route) => ({ route, boxOnly: true, box: true }))]) {
    if (!CAPTURE && !want.boxOnly) {
      const res = await fetch(`${srv.origin}${want.route}`, { headers: { authorization: AUTH } });
      statuses[want.route] = res.status;
      if (want.status !== null && res.status !== want.status) failures.push(`${want.route}: HTTP ${res.status}, want ${want.status}`);
      checkHead(`${want.route} (served HTML)`, headOfHtml(await res.text()), want);
    }
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      await page.goto(`${srv.origin}${want.route}`, { waitUntil: 'networkidle' });
      await page.evaluate((ms) => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, ms))), HYDRATION_SETTLE_MS);
      const tag = `${want.route} @${width}`;
      if (want.box) boxes[want.route] = { ...(boxes[want.route] ?? {}), [width]: await page.evaluate(measureBox) };
      if (!CAPTURE && !want.boxOnly) {
        checkHead(`${tag} (hydrated DOM)`, await page.evaluate(headOfDom), want);
        const mains = await page.evaluate(() => document.querySelectorAll('main').length);
        if (mains !== 1) failures.push(`${tag}: ${mains} <main> elements, want 1`);
        await page.addScriptTag({ path: axe });
        // axe is injected globally by the script tag above
        const v = await page.evaluate(async () => (await window.axe.run(document)).violations.map((x) => `${x.id}(${x.nodes.length})`));
        if (v.length) failures.push(`${tag}: axe violations ${v.join(', ')}`);
      }
      await ctx.close();
    }
  }
  if (!CAPTURE) {
    for (const k of KEEP) {
      const res = await fetch(`${srv.origin}${k.route}`, { headers: { authorization: AUTH } });
      const h = headOfHtml(await res.text());
      if (res.status !== 200) failures.push(`${k.route}: HTTP ${res.status}, want 200 (non-regression)`);
      if (h.titles.length !== 1 || ![k.title].flat().includes(h.titles[0])) failures.push(`${k.route}: titles ${JSON.stringify(h.titles)}, want one of ${JSON.stringify([k.title].flat())} (non-regression)`);
      if (h.canonicals.length !== 1 || h.canonicals[0] !== k.canonical) failures.push(`${k.route}: canonicals ${JSON.stringify(h.canonicals)}, want ["${k.canonical}"] (non-regression)`);
    }
  }
} catch (e) {
  failures.push(`render error: ${e && e.message ? e.message : e}`);
} finally {
  if (srv) await srv.stop();
  if (browser) await browser.close();
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  process.stdout.write(`${JSON.stringify({ recorded: 'from the 26fde668 build (next start, beta mode, DPR 1); section = [x, y, w, h] of the not-found <section>, doc = [scrollWidth, scrollHeight]', widths: WIDTHS, boxes: Object.fromEntries(Object.entries(boxes).map(([r, byW]) => [r, Object.fromEntries(Object.entries(byW).map(([w, m]) => [w, { section: m.section, doc: m.doc }]))])) }, null, 1)}\n`);
  process.exit(0);
}

const want = JSON.parse(golden('f3-baseline.json')).boxes;
const NEW_MAIN = new Set(NOT_FOUND.filter((n) => n.newMain).map((n) => n.route));
const near = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= BOX_TOLERANCE_PX);
for (const [route, byW] of Object.entries(boxes)) {
  for (const [width, m] of Object.entries(byW)) {
    const w = want[route]?.[width];
    const tag = `${route} @${width}`;
    if (!w) { failures.push(`${tag}: no baseline`); continue; }
    if (!near(m.section, w.section)) failures.push(`${tag}: not-found section box ${JSON.stringify(m.section)}, baseline ${JSON.stringify(w.section)}`);
    if (!near(m.doc, w.doc)) failures.push(`${tag}: document size ${JSON.stringify(m.doc)}, baseline ${JSON.stringify(w.doc)}`);
    if (NEW_MAIN.has(route) && (!m.mainBox || m.mainBox.some((v) => v !== '0px 0px 0px 0px'))) failures.push(`${tag}: <main> margin/padding/border ${JSON.stringify(m.mainBox)}, want all 0px`);
  }
}

finish(NAME, failures, `both 404s and the missing ticket carry one-suffix titles, their own ledes, no canonical and noindex in the served and hydrated head, one <main> and no axe violation; boxes match 26fde668; missing-ticket status ${statuses['/tickets/zz-r12-missing']}.`);
