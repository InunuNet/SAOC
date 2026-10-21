// nos-critique-r12 f2 rendered (production build, next start 3010-3019): /tickets/vip?quantity=1 and /national-show/tickets at 360, 375, 768 and 1280.
//   Outline: axe-core heading-order reports no violation on either route (sweep-221 found h1 -> h3 "VIP Ticket" on /tickets/vip).
//   Level:   the single-ticket page's one .nk-name is an h2 reading "VIP Ticket"; /national-show/tickets keeps the BASE tag of every .nk-name (h3 under a TicketSection h2).
//   Zero visual change: every .nk-name, in order, has the text, the computed style (goldens/f2-nkname-baseline.json props) and the box (within 0.5px) that
//   @architect captured on a 26fde668 next start. `--capture` prints a fresh baseline and never writes a file.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { finish, golden, repoRoot } from './_lib.mjs';
import { AUTH, assertFreshBuild, axeSource, require, startServer } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const VIP = '/tickets/vip?quantity=1';
const HUB = '/national-show/tickets';
const BOX_TOLERANCE_PX = 0.5;
const baseline = JSON.parse(golden('f2-nkname-baseline.json'));
const failures = [];
const got = {};

let browser;
let srv;
try {
  const sourceFiles = JSON.parse(golden('f2-footprint.json')).filter((rel) => existsSync(path.join(repoRoot, rel)));
  if (!process.env.NOS_CR12_ORIGIN) {
    const stale = assertFreshBuild(sourceFiles);
    if (stale.length > 0) finish(NAME, stale);
  }
  srv = process.env.NOS_CR12_ORIGIN ? { origin: process.env.NOS_CR12_ORIGIN, stop: () => {} } : await startServer();
  const axe = axeSource();
  browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  for (const route of [VIP, HUB]) {
    got[route] = {};
    for (const width of baseline.widths) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: { authorization: AUTH } });
      const page = await ctx.newPage();
      const res = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) failures.push(`${route} @${width}: HTTP ${res && res.status()}`);
      else {
        await page.evaluate(() => document.fonts.ready);
        const names = await page.evaluate((props) => [...document.querySelectorAll('.nk-name')].map((el) => {
          const cs = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return { tag: el.tagName.toLowerCase(), text: el.textContent.trim(), width: Math.round(b.width * 100) / 100, height: Math.round(b.height * 100) / 100, style: Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])) };
        }), baseline.props);
        await page.addScriptTag({ path: axe });
        // axe is injected globally by the script tag above
        const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'rule', values: ['heading-order'] } })).violations.flatMap((v) => v.nodes.map((n) => n.target.join(' '))));
        got[route][width] = { names, violations };
      }
      await ctx.close();
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
  const routes = Object.fromEntries(Object.entries(got).map(([r, byW]) => [r, Object.fromEntries(Object.entries(byW).map(([w, m]) => [w, m.names]))]));
  process.stdout.write(`${JSON.stringify({ ...baseline, routes }, null, 2)}\n`);
  process.exit(0);
}

for (const route of [VIP, HUB]) {
  for (const width of baseline.widths) {
    const tag = `${route} @${width}`;
    const m = got[route]?.[width];
    const want = baseline.routes[route]?.[String(width)];
    if (!m) { failures.push(`${tag}: not measured`); continue; }
    if (m.violations.length) failures.push(`${tag}: axe heading-order violations at ${m.violations.join(', ')}`);
    if (!want) { failures.push(`${tag}: no baseline`); continue; }
    if (m.names.length !== want.length) { failures.push(`${tag}: ${m.names.length} .nk-name elements, baseline ${want.length}`); continue; }
    m.names.forEach((n, i) => {
      const w = want[i];
      const wantTag = route === VIP ? 'h2' : w.tag;
      if (n.tag !== wantTag) failures.push(`${tag}: .nk-name ${i} "${n.text}" is ${n.tag}, want ${wantTag}`);
      if (n.text !== w.text) failures.push(`${tag}: .nk-name ${i} reads "${n.text}", baseline "${w.text}"`);
      for (const p of baseline.props) if (n.style[p] !== w.style[p]) failures.push(`${tag}: .nk-name ${i} ${p} ${JSON.stringify(n.style[p])}, baseline ${JSON.stringify(w.style[p])}`);
      if (Math.abs(n.width - w.width) > BOX_TOLERANCE_PX || Math.abs(n.height - w.height) > BOX_TOLERANCE_PX) failures.push(`${tag}: .nk-name ${i} box ${n.width}x${n.height}, baseline ${w.width}x${w.height}`);
    });
    if (route === VIP && !(m.names.length === 1 && m.names[0].text === 'VIP Ticket')) failures.push(`${tag}: want exactly one .nk-name "VIP Ticket" (the summary card renders only while sales are open)`);
  }
}

finish(NAME, failures, 'axe heading-order is clean on /tickets/vip and /national-show/tickets at 360-1280, the single-ticket name is an h2, and every .nk-name keeps its BASE text, computed style and box.');
