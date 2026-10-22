// nos-vendor-apply-form (r55) rendered: a fresh PUBLIC production build (no beta wall, SITE_PUBLIC_LAUNCH=true), next start 3010-3019 minus
// 3002, 3013 and 3016. QA input, hash-locked. Golden: goldens/edits.json (limits) and goldens/render-baseline.json (the dc664ef9 render:
// axe counts, geometry and unrelated typography, recorded with NOS_VA_RECORD=1 on the unmodified base). Nothing here writes a form,
// reads an order or a person: pages are only loaded and measured. Widths 1280 and 390.
//   R1  every visible text-like control (input except hidden/checkbox/radio/file/button/submit, select, textarea) on each NOS form route
//       computes to >= 16px: /national-show/vendors/apply, /national-show/vendors/register (code entry; the full register form is token-gated),
//       the first two /tickets/<slug>?quantity=2 checkouts that render a quantity control, and the NOS footer newsletter input that every
//       NOS route carries. Each route must show its named controls (so the check cannot pass on an empty page).
//   R2  vendor apply: from the subnav's bottom edge to the top of the first form text is 40-56px (Codi: about 48px) at both widths.
//   R3  vendor apply stands input: at 1280 no wider than 14ch (Codi: about 12ch) and the other five fields keep the full form width; at 390
//       not wider than its container; the field still has its label and 16px type.
//   R4  no horizontal overflow of the page, and the footer newsletter row does not clip its input.
//   R5  axe (WCAG 2.2 AA) finds no more of any rule than the base render did, per route and width.
//   R6  nothing else moved: the hero's bottom, the subnav height and the computed font-size of labels, the h1, the required sentence, the
//       footer text and button equal the base render.
//   Element screenshots (r55-<width>-<route>.png) land in <checkout>/.tmp/va-shots/.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot, specDir } from './_lib.mjs';
import { authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const G = goldenJson('edits.json');
const RECORD = process.env.NOS_VA_RECORD === '1';
const BASELINE = RECORD ? null : goldenJson('render-baseline.json');
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const failures = [];
const recorded = {};

// Runs in the page.
function measure({ probes, standsId }) {
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden], [aria-hidden="true"]');
  };
  const SKIP = new Set(['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'image', 'reset']);
  const controls = [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => !SKIP.has(e.type) && shown(e))
    .map((e) => ({ id: e.id || e.name || '(none)', type: e.type, size: parseFloat(getComputedStyle(e).fontSize), width: e.getBoundingClientRect().width }));
  const chOf = (e) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(e).font}`;
    probe.textContent = '0'.repeat(100);
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return w;
  };
  const stands = standsId ? document.getElementById(standsId) : null;
  const form = document.querySelector('main form');
  const nav = document.querySelector('.nos-subnav');
  const hero = document.querySelector('.nos-hero');
  const firstText = form ? [...form.children].find((c) => c.tagName === 'P') ?? null : null;
  const nf = document.querySelector('.nf-form');
  const nfInput = document.getElementById('nf-email');
  return {
    controls,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    footerClip: nf && nfInput ? nfInput.scrollWidth - nfInput.clientWidth : 0,
    gap: nav && firstText ? firstText.getBoundingClientRect().top - nav.getBoundingClientRect().bottom : null,
    heroBottom: hero ? hero.getBoundingClientRect().bottom + scrollY : null,
    navHeight: nav ? nav.getBoundingClientRect().height : null,
    stands: stands ? { width: stands.getBoundingClientRect().width, ch: chOf(stands), parent: stands.parentElement.getBoundingClientRect().width, label: Boolean(document.querySelector(`label[for="${standsId}"]`)) } : null,
    formWidth: form ? form.getBoundingClientRect().width : null,
    typography: Object.fromEntries(probes.map((s) => { const el = document.querySelector(s); return [s, el ? getComputedStyle(el).fontSize : null]; })),
  };
}

const browser = await chromium.launch(process.env.NOS_VA_CHROME ? { executablePath: process.env.NOS_VA_CHROME } : {});
const srv = await serve('public');
if (srv.failures) { console.error(srv.failures.join('\n')); await browser.close(); process.exit(1); }
try {
  for (const width of G.widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await authorize(ctx, srv);
    const page = await ctx.newPage();
    // No request this check makes may write: only GETs are allowed through.
    await ctx.route('**/api/**', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));

    const hub = await page.goto(`${srv.origin}/tickets`, { waitUntil: 'networkidle' });
    if (!hub || hub.status() !== 200) { failures.push(`@${width}: /tickets answered ${hub?.status()} (INFRA)`); await ctx.close(); continue; }
    const slugs = await page.evaluate(() => [...document.querySelectorAll('article[data-ticket-slug]')].map((a) => a.dataset.ticketSlug));
    const targets = [];
    for (const r of G.routes) {
      if (!r.path.includes('{ticket}')) { targets.push(r); continue; }
      let found = 0;
      for (const slug of slugs) {
        if (found === 2) break;
        const url = r.path.replace('{ticket}', slug);
        const res = await page.goto(`${srv.origin}${url}`, { waitUntil: 'networkidle' });
        if (res?.status() === 200 && (await page.locator('#ticket-quantity').count()) > 0) { found += 1; targets.push({ ...r, path: url, tag: r.path.replace('{ticket}', `{ticket${found}}`) }); }
      }
      if (found === 0) failures.push(`@${width}: no /tickets/<slug> checkout with a quantity control among ${slugs.join(', ')} (INFRA)`);
    }

    for (const r of targets) {
      const at = `${r.path} @${width}`;
      const res = await page.goto(`${srv.origin}${r.path}`, { waitUntil: 'networkidle' });
      if (!res || res.status() !== 200) { failures.push(`${at}: answered ${res?.status()}`); continue; }
      const isApply = r.path === G.gap.route;
      const m = await page.evaluate(measure, { probes: G.typographyProbes, standsId: isApply ? G.stands.id : null });

      // R1
      for (const id of r.mustHave) if (!m.controls.some((c) => c.id === id)) failures.push(`${at}: expected visible control "${id}" is missing (R1)`);
      for (const pre of r.mustHavePrefix ?? []) if (!m.controls.some((c) => c.id.startsWith(pre))) failures.push(`${at}: no visible control with id prefix "${pre}" (R1)`);
      for (const c of m.controls) if (c.size < G.minControlPx) failures.push(`${at}: ${c.type} control "${c.id}" computes to ${c.size}px, below ${G.minControlPx}px (R1)`);

      // R4
      if (m.overflowX > 0) failures.push(`${at}: the page scrolls horizontally by ${m.overflowX}px (R4)`);
      if (m.footerClip > 0) failures.push(`${at}: the footer newsletter input clips its content by ${m.footerClip}px (R4)`);

      if (isApply) {
        // R2
        if (m.gap === null) failures.push(`${at}: no subnav or no first form text to measure the gap (R2)`);
        else if (m.gap < G.gap.minPx || m.gap > G.gap.maxPx) failures.push(`${at}: subnav-to-form-text gap is ${m.gap.toFixed(1)}px, outside ${G.gap.minPx}-${G.gap.maxPx}px (R2)`);
        // R3
        const s = m.stands;
        if (!s) failures.push(`${at}: the stands input #${G.stands.id} is missing (R3)`);
        else {
          if (!s.label) failures.push(`${at}: the stands input lost its label (R3)`);
          if (width >= 1280 && s.width / s.ch > G.stands.maxCh) failures.push(`${at}: stands input is ${(s.width / s.ch).toFixed(1)}ch (${s.width.toFixed(0)}px) wide, over ${G.stands.maxCh}ch (R3)`);
          if (s.width > s.parent + 0.5) failures.push(`${at}: stands input (${s.width.toFixed(0)}px) is wider than its container (${s.parent.toFixed(0)}px) (R3)`);
          const others = m.controls.filter((c) => c.id.startsWith('vendor-register-') && c.id !== G.stands.id);
          for (const o of others) if (o.width < m.formWidth - 1) failures.push(`${at}: "${o.id}" is ${o.width.toFixed(0)}px, narrower than the form (${m.formWidth.toFixed(0)}px): only the stands field may change (R3)`);
        }
      }

      // R5
      await page.addScriptTag({ path: axeSource() });
      const axe = await page.evaluate(async (tags) => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } });
        return Object.fromEntries(r.violations.map((v) => [v.id, v.nodes.length]));
      }, AXE_TAGS);

      const key = `${r.tag ?? r.path}@${width}`;
      recorded[key] = { axe, heroBottom: m.heroBottom, navHeight: m.navHeight, typography: m.typography };
      if (!RECORD) {
        const base = BASELINE[key];
        if (!base) failures.push(`${at}: no baseline for ${key} (INFRA)`);
        else {
          for (const [rule, n] of Object.entries(axe)) if (n > (base.axe[rule] ?? 0)) failures.push(`${at}: axe "${rule}" has ${n} node(s), the base render had ${base.axe[rule] ?? 0} (R5)`);
          // R6
          if (m.heroBottom !== base.heroBottom) failures.push(`${at}: hero bottom moved ${base.heroBottom} -> ${m.heroBottom} (R6)`);
          if (m.navHeight !== base.navHeight) failures.push(`${at}: subnav height changed ${base.navHeight} -> ${m.navHeight} (R6)`);
          for (const [sel, size] of Object.entries(m.typography)) if (size !== base.typography[sel]) failures.push(`${at}: font-size of "${sel}" changed ${base.typography[sel]} -> ${size} (R6)`);
        }
      }
      await page.locator('main').first().screenshot({ path: path.join(SHOTS, `r55-${width}-${r.path.replace(/[^a-z0-9]+/gi, '_')}.png`) }).catch(() => {});
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await srv.stop();
}

if (RECORD) {
  writeFileSync(path.join(specDir, 'goldens', 'render-baseline.json'), `${JSON.stringify(recorded, null, 2)}\n`);
  console.log(`RECORDED: ${Object.keys(recorded).length} route/width baselines (${failures.length} measurement failure(s) ignored while recording)`);
  process.exit(0);
}
finish('rendered.mjs', failures, `R1-R6 hold on ${Object.keys(recorded).length} route/width renders.`);
