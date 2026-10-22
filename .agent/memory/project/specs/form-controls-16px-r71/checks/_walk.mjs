// Shared 390px walker for the form-controls-16px-r71 (r71) checks (QA input, hash-locked). Builds and serves `mode` (_server.mjs), walks the
// public routes that hold form controls plus the admin surfaces that render without a session, and returns one observation per visible
// text-entry control: its computed font-size and border-box height. Nothing here submits a form or writes anywhere: pages are loaded, the
// header search is opened and the vendor drawer is opened, nothing more. Admin surfaces: /admin/login (unauthenticated, real) and
// /admin-fixtures/[route] (static fixture data behind ADMIN_FIXTURES=1, set by _server.mjs on this local server only; no sign-in, no credentials).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { checksDir, goldenJson, repoRoot } from './_lib.mjs';
import { authorize, require, serve } from './_server.mjs';

const G = goldenJson('edits.json');

// Text-entry controls only: the inputs iOS zooms on focus. Checkboxes, radios, file pickers, buttons and hidden inputs are not text entry.
const NON_TEXT_TYPES = ['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image', 'range', 'color'];

/** Runs in the page: every visible text-entry control with its computed size. */
function scan({ nonText }) {
  const seen = new Map();
  const out = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const tag = el.tagName.toLowerCase();
    const type = tag === 'input' ? (el.getAttribute('type') || 'text').toLowerCase() : tag;
    if (nonText.includes(type)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let hidden = cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || r.width === 0 || r.height === 0;
    for (let n = el; n && !hidden; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden') || n.hasAttribute('inert')) hidden = true;
      else if (getComputedStyle(n).display === 'none' || getComputedStyle(n).visibility === 'hidden') hidden = true;
    }
    if (hidden) continue;
    const label = el.id || el.getAttribute('name') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const base = `${tag}[${type}]#${label}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    out.push({ key: `${base}@${nth}`, fontSize: parseFloat(cs.fontSize), height: Math.round(r.height * 100) / 100 });
  }
  return out;
}

/** Walks `mode`. Returns { observations: [{ route, key, fontSize, height }], pages: [{ route, status, controls }], failures }. */
export async function walk(mode) {
  const failures = [];
  const observations = [];
  const pages = [];
  const srv = await serve(mode);
  if (srv.failures) return { observations, pages, failures: srv.failures.map((f) => `${mode}: ${f}`) };
  const { chromium } = require('playwright');
  let browser;
  try {
    browser = await chromium.launch(process.env.FC16_CHROME ? { executablePath: process.env.FC16_CHROME } : {});
  } catch (e) {
    await srv.stop();
    return { observations, pages, failures: [`${mode}: INFRA - chromium did not launch: ${String(e).split('\n')[0]}`] };
  }
  try {
    // The routes to walk: the golden list, every path in the sitemap, and one ticket detail page found from the tickets hub.
    const routes = new Set(G.publicRoutes);
    try {
      const sm = await fetch(`${srv.origin}/sitemap.xml`, { headers: srv.headers });
      for (const m of (await sm.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
        try { const u = new URL(m[1]); if (u.pathname !== '/') routes.add(u.pathname); } catch { /* not a URL */ }
      }
    } catch { /* the golden list still runs */ }
    try {
      const hub = await (await fetch(`${srv.origin}/national-show/tickets`, { headers: srv.headers })).text();
      const slug = hub.match(/href="(\/tickets\/[a-z0-9-]+)"/);
      if (slug) routes.add(slug[1]);
    } catch { /* optional */ }
    for (let i = 0; i < G.vendorDrawerCount; i++) routes.add(`/admin-fixtures/vendors?view=fixture-vendor-${i}`);
    for (const r of G.adminRoutes) routes.add(r);

    const ctx = await browser.newContext({ viewport: { width: G.width, height: 900 }, reducedMotion: 'reduce' });
    await authorize(ctx, srv);
    const page = await ctx.newPage();
    try {
      for (const route of [...routes].sort()) {
        let status = 0;
        try {
          const resp = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle', timeout: 60_000 });
          status = resp ? resp.status() : 0;
        } catch (e) {
          failures.push(`${mode} ${route}: INFRA - navigation failed: ${String(e).split('\n')[0]}`);
          continue;
        }
        await page.waitForTimeout(250);
        const found = await page.evaluate(scan, { nonText: NON_TEXT_TYPES });
        for (const c of found) observations.push({ route, ...c });
        pages.push({ route, status, controls: found.length });
        // The header search is a dialog that mounts its input on open.
        if (route === G.searchRoute) {
          const trigger = page.locator('button[aria-label="Open search"]').first();
          if (await trigger.isVisible().catch(() => false)) {
            await trigger.click({ timeout: 10_000 }).catch((e) => failures.push(`${mode} ${route}: INFRA - the search trigger did not click: ${String(e).split('\n')[0]}`));
            await page.waitForTimeout(400);
            for (const c of await page.evaluate(scan, { nonText: NON_TEXT_TYPES })) {
              if (!found.some((f) => f.key === c.key)) observations.push({ route: `${route}#search-open`, ...c });
            }
          } else {
            failures.push(`${mode} ${route}: the "Open search" trigger is not visible at ${G.width}, so the search input was not walked`);
          }
        }
      }
      // /events/submit shows its form to a member session only, which no check forges: the component is server-rendered (tsx) and loaded
      // in the browser under the real built stylesheets and the real <html>/<body> classes taken from /contact.
      const form = spawnSync(path.join(repoRoot, 'node_modules', '.bin', 'tsx'), [path.join(checksDir, '_render-submit-event-form.mjs')], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (form.status !== 0) {
        failures.push(`${mode} ${G.syntheticRoute}: INFRA - the SubmitEventForm render failed: ${`${form.stdout}${form.stderr}`.slice(-1500)}`);
      } else {
        const shell = await (await fetch(`${srv.origin}/contact`, { headers: srv.headers })).text();
        const links = [...shell.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join('');
        const attr = (tag) => (shell.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`)) ?? [])[1] ?? '';
        await page.goto(`${srv.origin}/about`, { waitUntil: 'domcontentloaded', timeout: 60_000 }); // same origin as the stylesheets
        await page.setContent(`<!doctype html><html class="${attr('html')}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><base href="${srv.origin}/">${links}</head><body class="${attr('body')}"><div class="max-w-xl mx-auto px-4 py-12">${form.stdout}</div></body></html>`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(250);
        const found = await page.evaluate(scan, { nonText: NON_TEXT_TYPES });
        for (const c of found) observations.push({ route: G.syntheticRoute, ...c });
        pages.push({ route: G.syntheticRoute, status: 200, controls: found.length });
      }
    } finally {
      await ctx.close();
    }
  } finally {
    await browser.close();
    await srv.stop();
  }
  return { observations, pages, failures };
}
