// nos-critique-r3 F2 — rendered check for R43 (body floor at 390). Starts `next start` on 3010-3019 (never 3002) via _server.mjs.
//
// R43 @390x844 (golden spec-f2 §2):
//   NAMED  every affected element (route + own-text prefix) computes its AFTER size: running prose
//          17px (NOS routes), 16px (SAOC home cards, and the 2-up class cards on the hub);
//   META   labels/meta that must NOT be inflated keep their exact BEFORE size (11-15px, listed);
//   SWEEP  on 10 routes no running-prose leaf (own text >= 4 words and (>= 40 chars or ends in . ? !),
//          not uppercase/tracked, not a pill badge, not in .nos-show-page-notice, not in the
//          EXEMPT_TEXT list) computes < 16px;
//   LABELS every uppercase/tracked leaf stays <= 14px and >= 12px (labels are not inflated);
//   C4     no horizontal overflow on any swept route.
// Requires a current build. Run as: node contracts/checks/nos-critique-r3/check-rendered-f2.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { CSS, GRID, SECTION, finish, gitRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f2.mjs';
const failures = [];
const { chromium } = require('playwright');
const SHOTS = path.resolve(gitRoot, '..', 'critique-r3-shots');
const NS = 'app/(marketing)/national-show';

const stale = assertFreshBuild([GRID, SECTION, CSS, `${NS}/page.tsx`, `${NS}/tickets/page.tsx`]);
if (stale.length > 0) finish(NAME, stale);

// [route, own-text prefix, before px, min px, max px, source]
const NAMED = [
  ['/', 'From Cape Town to Polokwane', 13, 16, 16, 'components/home/NavCards.tsx:130'],
  ['/', 'Every three years.', 13, 16, 16, 'components/home/NavCards.tsx:130'],
  ['/', 'AM, FCC, HCC', 13, 16, 16, 'components/home/NavCards.tsx:130'],
  ['/', 'Founded in Bloemfontein', 13, 16, 16, 'components/home/NavCards.tsx:130'],
  ['/', 'Partner organisation hosting', 15, 16, 16, 'components/home/PartnersSection.tsx:74'],
  ['/', 'One of the world', 15, 16, 16, 'components/home/PartnersSection.tsx:74'],
  ['/national-show', 'The 2027 theme', 14, 17, 17, 'components/nos/VisitorLinkCard.tsx:23'],
  ['/national-show', 'Travel from the airports', 14, 17, 17, 'components/nos/VisitorLinkCard.tsx:23'],
  ['/national-show', 'Opening hours, admission', 14, 17, 17, 'components/nos/VisitorLinkCard.tsx:23'],
  ['/national-show', 'Previous editions', 14, 17, 17, 'components/nos/VisitorLinkCard.tsx:23'],
  ['/national-show', 'Looking for your local orchid society', 15, 17, 17, 'national-show/page.tsx:586'],
  ['/national-show', 'Cattleya, Laelia', 13, 16, 17, 'components/nos/JudgingGroupCard.tsx:32'],
  ['/national-show', 'Vanda, Ascocenda', 13, 16, 17, 'components/nos/JudgingGroupCard.tsx:32'],
  ['/national-show', 'Contact your provincial society', 14, 17, 17, 'components/nos/ExhibitorStageCard.tsx'],
  ['/national-show', 'SAOC accredited judges', 14, 17, 17, 'components/nos/ExhibitorStageCard.tsx'],
  ['/national-show/plan-your-visit', 'The show is held at the hangar', 15, 17, 17, 'components/show/VenueCard.tsx:80'],
  ['/national-show/plan-your-visit', 'Works from any mobile', 13, 17, 17, 'plan-your-visit/page.tsx:157'],
  ['/national-show/plan-your-visit', 'The committee will supply', 13, 17, 17, 'plan-your-visit/page.tsx:157'],
  ['/national-show/what-to-expect', 'Dates and daily opening hours', 13, 17, 17, 'what-to-expect/page.tsx:160'],
  ['/national-show/what-to-expect', 'The final day usually closes', 13, 17, 17, 'what-to-expect/page.tsx:160'],
  ['/national-show/tickets', 'See what is involved in exhibiting', 14, 17, 17, 'tickets/page.tsx:188'],
  ['/national-show/tickets', 'Register a trade booth', 14, 17, 17, 'tickets/page.tsx:188'],
  ['/national-show/tickets', 'Book Sunset Cocktails', 14, 17, 17, 'tickets/page.tsx:188'],
  ['/national-show/sa-exhibitors', 'No South African nurseries', 15, 17, 17, 'components/show/nos/RealEmptyListing.tsx:36'],
  ['/national-show/international-guests', 'No international guests', 15, 17, 17, 'components/show/nos/RealEmptyListing.tsx:36'],
  ['/national-show/exhibitors', 'Staging start not set', 15, 17, 17, 'components/show/ExhibitorKeyDates.tsx:96'],
  ['/national-show/exhibitors', 'When you can start delivering', 15, 17, 17, 'components/show/ExhibitorKeyDates.tsx:105'],
  ['/national-show/exhibitors', 'Lead times across the shows', 15, 17, 17, 'components/show/ExhibitorQuestions.tsx:49'],
  ['/national-show/faq', 'The show is at Stellenbosch Flying Club', 15, 17, 17, 'components/show/ShowFaqList.tsx:99'],
  ['/national-show/faq', 'Parking arrangements', 15, 17, 17, 'components/show/ShowFaqList.tsx:99'],
];
// Meta that must keep its exact BEFORE size(s): [route, prefix, [sizes]]
const META = [
  ['/', 'SINCE 1968', [11]],
  ['/', 'The Hangar, Stellenbosch Flying Club', [15, 14]],
  ['/national-show/plan-your-visit', 'Ambulance and fire', [12]],
  ['/national-show/tickets', 'Provisional pricing', [12]],
  ['/national-show/tickets', 'You must choose a day', [13]],
  ['/national-show/exhibitors', 'Exhibitor entries are not yet open', [12]],
  ['/national-show/exhibitors', 'By the published entry deadline', [12]],
];
const SWEEP = ['/', '/national-show', '/national-show/plan-your-visit', '/national-show/what-to-expect', '/national-show/tickets',
  '/national-show/sa-exhibitors', '/national-show/international-guests', '/national-show/exhibitors', '/national-show/faq', '/national-show/archive'];
// Prose-looking text that is meta by decision (golden spec-f2 §2): captions/legal/hints attached to a control.
const EXEMPT_TEXT = ['^Provisional pricing', '^You must choose a day', '^Early-bird pricing ends'];

const SCAN = `(args) => {
  const exempt = args.exempt.map((s) => new RegExp(s));
  const out = { prose: [], labels: [], byText: {}, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  for (const el of document.querySelectorAll('main *')) {
    if (el.closest('header, nav, footer, script, style') || el.offsetParent === null) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\\s+/g, ' ').trim();
    if (own.length < 3) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const tracked = parseFloat(cs.letterSpacing) > 0.5 || cs.textTransform === 'uppercase';
    for (const p of args.prefixes) if (own.startsWith(p)) (out.byText[p] ||= []).push(size);
    const words = own.split(' ').length;
    const sel = (() => { const t = el.tagName.toLowerCase(); const c = typeof el.className === 'string' ? el.className.split(/\\s+/).filter(Boolean).slice(0, 3).join('.') : ''; return t + (c ? '.' + c : ''); })();
    if (tracked) { if (own.length >= 8) out.labels.push({ size, own: own.slice(0, 50), sel }); continue; }
    const prose = words >= 4 && (own.length >= 40 || /[.?!]$/.test(own));
    if (!prose) continue;
    if (el.closest('.nos-show-page-notice') || el.closest('[class*="radius-pill"]') || exempt.some((r) => r.test(own))) continue;
    out.prose.push({ size, own: own.slice(0, 60), sel });
  }
  return out;
}`;

const table = [];
let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  const { origin } = srv;
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
  const headers = { authorization: AUTH };

  // ---------------- R43 at 390 ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: headers });
    const page = await ctx.newPage();
    for (const route of SWEEP) {
      const tag = `${route} @390`;
      const res = await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); continue; }
      const prefixes = [...NAMED, ...META].filter((r) => r[0] === route).map((r) => r[1]);
      const s = await page.evaluate(`(${SCAN})(${JSON.stringify({ exempt: EXEMPT_TEXT, prefixes })})`);
      if (s.sw > s.cw) failures.push(`${tag}: C4 horizontal overflow, scrollWidth ${s.sw} > clientWidth ${s.cw}`);
      for (const [, prefix, before, min, max, src] of NAMED.filter((r) => r[0] === route)) {
        const sizes = s.byText[prefix];
        if (!sizes || sizes.length === 0) { failures.push(`${tag}: NAMED "${prefix}" not found (${src})`); continue; }
        table.push(`  ${route} "${prefix}": ${before}px -> ${[...new Set(sizes)].join('/')}px (${src})`);
        for (const size of sizes) if (size < min || size > max) failures.push(`${tag}: "${prefix}" is ${size}px, want ${min === max ? min : `${min}-${max}`}px (was ${before}px; ${src})`);
      }
      for (const [, prefix, sizes] of META.filter((r) => r[0] === route)) {
        const got = s.byText[prefix];
        if (!got || got.length === 0) { failures.push(`${tag}: META "${prefix}" not found`); continue; }
        for (const size of got) if (!sizes.includes(size)) failures.push(`${tag}: meta "${prefix}" is ${size}px, must stay ${sizes.join(' or ')}px (labels/meta are not inflated)`);
      }
      for (const p of s.prose) if (p.size < 16) failures.push(`${tag}: running prose ${p.size}px < 16px floor: "${p.own}" (${p.sel})`);
      for (const l of s.labels) if (l.size > 14 || (route !== '/' && l.size < 12)) failures.push(`${tag}: label ${l.size}px outside ${route === '/' ? '<=14' : '12-14'}px: "${l.own}" (${l.sel})`);
      await page.screenshot({ path: path.join(SHOTS, `r43-${route.replace(/\W+/g, '_') || 'home'}-390.png`), fullPage: true });
    }
    await ctx.close();
  }

} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}

finish(NAME, failures, `R43 body floor at 390 (${NAMED.length} named elements, ${META.length} meta pins, ${SWEEP.length}-route prose/label sweep). Before -> after:\n${table.join('\n')}\nShots: ${SHOTS}`);
