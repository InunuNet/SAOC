// sponsor-enquiry-both-hosts REPORT-ONLY survey (phase 5, non-required): where does every NOS hash target actually land?
// NOS Design asked for this list after the sponsor-card anchor ruling (2026-10-28): the contract fixes only the sponsors card, every other
// NOS hash target is reported here, not asserted. This script NEVER fails the gate - it exits 0 whatever it finds (including when the
// credentials, browser or host are unavailable, in which case it prints why and the list is simply empty).
// Method: real Chromium on the deployed NOS host. Targets are discovered, not hard-coded - every same-origin link carrying a #hash found on
// the seed pages (header, footer, body), plus every .pc-sec-top presenter heading (presenters.css:57, scroll-margin-top 90px) - and the
// minimum set faq, plan-your-visit, legal and presenters is always named in the output, "NOT FOUND" when it could not be discovered.
// Each target is opened as a deep link (page load with #hash) at 390, 767, 768, 1024, 1440 and 2056 wide. The landing gap is the target's top
// minus the bottom of whatever is pinned to the top of the viewport (the sticky header), or the viewport top when nothing is pinned.
// NOS Design's gate is 16..40px; rows outside it are marked OUT, rows that cannot scroll that far are marked SHORT (end of page).
// Writes nothing and mocks nothing: it only loads public pages. Basic Auth is read from BETA_BASIC_AUTH_USER/PASSWORD in-script, never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after deploy)
//     or: NOS_BASE_URL=http://nos.localhost:<port> node <this file>   (against a local production build; no credentials needed)
import { chromium } from 'playwright';

// NOS_BASE_URL points the survey at a local production server (e.g. http://nos.localhost:3050, built with NEXT_PUBLIC_NOS_SITE_URL set to that origin);
// the default is the deployed NOS host, which needs the Basic Auth variables below.
const ORIGIN = (process.env.NOS_BASE_URL ?? 'https://nos.saoc.co.za').replace(/\/+$/, '');
const LOCAL = Boolean(process.env.NOS_BASE_URL);
const SEED_PATHS = ['/national-show', '/national-show/about', '/national-show/faq', '/national-show/plan-your-visit', '/national-show/sponsors', '/national-show/programme',
  '/national-show/what-to-expect', '/national-show/workshops', '/national-show/symposium', '/national-show/tickets', '/national-show/vendors', '/national-show/award-entries',
  '/national-show/international-guests', '/national-show/conferences', '/national-show/wosa-conference', '/national-show/media-kit', '/national-show/contact', '/national-show/archive'];
const REQUIRED = [['faq', /\/faq#/], ['plan-your-visit', /\/plan-your-visit#/], ['legal', /legal|privacy|terms|refund|cancel|popia/i], ['presenters', /^presenters:/]];
const VIEWPORTS = [{ w: 390, h: 844 }, { w: 767, h: 1024 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1440, h: 900 }, { w: 2056, h: 1200 }];
const GATE_MIN = 16; const GATE_MAX = 40;
const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const report = (line) => console.log(line);

if (!LOCAL && (!user || !pass)) { report('REPORT-ONLY: BETA_BASIC_AUTH_USER / BETA_BASIC_AUTH_PASSWORD not set; nothing surveyed (run from the project root with .env.local).'); process.exit(0); }
let browser;
try { browser = await chromium.launch(); } catch (error) { report(`REPORT-ONLY: chromium unavailable (${error.name}); nothing surveyed.`); process.exit(0); }

const targets = new Map(); // key "path#hash" or "presenters:path#id" -> { url, label, selector }
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(LOCAL ? {} : { httpCredentials: { username: user, password: pass } }) });
  for (const path of SEED_PATHS) {
    const page = await context.newPage();
    try {
      const res = await page.goto(`${ORIGIN}${path}`, { waitUntil: 'networkidle', timeout: 45000 });
      if (!res || res.status() !== 200) { report(`note: ${path} returned ${res?.status()}, skipped as a seed`); continue; }
      const found = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="#"]')].map((a) => { const u = new URL(a.href, location.href); return { origin: u.origin, path: u.pathname, hash: u.hash, text: (a.textContent || '').trim().slice(0, 40) }; });
        const presenters = [...document.querySelectorAll('.pc-sec-top')].map((el) => { const withId = el.id ? el : (el.closest('[id]') || el.querySelector('[id]')); return { id: withId ? withId.id : '', text: (el.textContent || '').trim().slice(0, 40) }; });
        return { links, presenters };
      });
      for (const l of found.links) {
        if (l.origin !== ORIGIN || l.hash.length < 2 || l.hash === '#main-content') continue; // the skip link targets <main> at the top of the page, not a landing position
        const key = `${l.path}${l.hash}`;
        if (!targets.has(key)) targets.set(key, { url: `${ORIGIN}${l.path}${l.hash}`, label: `${l.path}${l.hash}${l.text ? `  ("${l.text}")` : ''}` });
      }
      for (const p of found.presenters) {
        const key = `presenters:${path}#${p.id || `(no-id:${p.text})`}`;
        if (!targets.has(key)) targets.set(key, p.id ? { url: `${ORIGIN}${path}#${p.id}`, label: `presenters heading ${path}#${p.id}` } : { url: null, label: `presenters heading on ${path} ("${p.text}") has no id, so no hash link can land on it` });
      }
    } catch (error) { report(`note: ${path} could not be read (${error.name}), skipped as a seed`); } finally { await page.close().catch(() => {}); }
  }
  await context.close();

  const rows = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, ...(LOCAL ? {} : { httpCredentials: { username: user, password: pass } }) });
    for (const [key, t] of targets) {
      if (!t.url) { rows.push({ key, vp: vp.w, verdict: 'NO-ID', gap: null, label: t.label }); continue; }
      const page = await ctx.newPage();
      try {
        await page.goto(t.url, { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(1200);
        const m = await page.evaluate(() => {
          const id = decodeURIComponent(location.hash.slice(1));
          const el = document.getElementById(id);
          if (!el) return { missing: true };
          let chromeBottom = 0;
          for (const e of document.querySelectorAll('body *')) {
            const p = getComputedStyle(e).position;
            if (p !== 'fixed' && p !== 'sticky') continue;
            const r = e.getBoundingClientRect();
            if (r.top <= 1 && r.height > 0 && r.bottom > chromeBottom && r.bottom < innerHeight / 2) chromeBottom = r.bottom;
          }
          const top = el.getBoundingClientRect().top;
          return { top, chromeBottom, atEnd: scrollY + innerHeight >= document.documentElement.scrollHeight - 1, scrollMargin: getComputedStyle(el).scrollMarginTop };
        });
        if (m.missing) { rows.push({ key, vp: vp.w, verdict: 'NO-ELEMENT', gap: null, label: t.label }); continue; }
        const gap = m.top - m.chromeBottom;
        const inGate = gap >= GATE_MIN && gap <= GATE_MAX;
        rows.push({ key, vp: vp.w, verdict: inGate ? 'ok' : (m.atEnd && gap > GATE_MAX ? 'SHORT' : 'OUT'), gap, pinned: m.chromeBottom, margin: m.scrollMargin, label: t.label });
      } catch (error) { rows.push({ key, vp: vp.w, verdict: `ERROR(${error.name})`, gap: null, label: t.label }); } finally { await page.close().catch(() => {}); }
    }
    await ctx.close();
  }

  report(`NOS hash-target landing survey (gate ${GATE_MIN}..${GATE_MAX}px below whatever is pinned, else the viewport top). REPORT-ONLY, never fails.`);
  report('verdict  width  gap(px)  pinned  scroll-margin  target');
  for (const r of rows.sort((a, b) => a.key.localeCompare(b.key) || a.vp - b.vp)) {
    report(`${r.verdict.padEnd(8)} ${String(r.vp).padStart(5)}  ${r.gap === null ? '    -' : r.gap.toFixed(1).padStart(7)}  ${r.pinned === undefined ? '     -' : r.pinned.toFixed(0).padStart(6)}  ${(r.margin ?? '-').padStart(13)}  ${r.label}`);
  }
  report('--- required minimum coverage ---');
  for (const [name, re] of REQUIRED) {
    const hit = [...targets.entries()].filter(([k, t]) => re.test(k) || re.test(t.label));
    report(`${name.padEnd(16)} ${hit.length ? `${hit.length} target(s) surveyed` : 'NOT FOUND among the seed pages (nothing to survey)'}`);
  }
  const out = rows.filter((r) => r.verdict === 'OUT').length;
  report(`summary: ${targets.size} target(s) x ${VIEWPORTS.length} viewports = ${rows.length} landing(s); OUT ${out}, SHORT ${rows.filter((r) => r.verdict === 'SHORT').length}, no-id/no-element/error ${rows.filter((r) => !['ok', 'OUT', 'SHORT'].includes(r.verdict)).length}`);
} catch (error) {
  report(`REPORT-ONLY: survey stopped early (${error.name}); list above is partial.`);
} finally {
  await browser.close().catch(() => {});
}
process.exit(0);
