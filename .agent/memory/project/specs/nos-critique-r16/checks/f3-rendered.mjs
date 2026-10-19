// nos-critique-r16 F3 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f3-media.json, f3-events.json. Both modes, 1280 and 390.
//   R1  /media-kit "Brand assets": exactly the golden tiles (h2 names, in order); each tile's download href is its golden path and the
//       served bytes hash to the golden sha256; the preview image is the same file (raw path or its /images/_opt/<basename>-N.webp
//       derivative); tile (c) sits on --primary-800 rgb(34,40,31).
//   R2  every "What's on" row on / and every event row on /events is exactly one link: href /events/<slug> answering 200 with an h1 equal
//       to the row title; accessible name exactly the title; no other interactive element inside the row or the link. The count of row
//       links equals the golden's verified rows for that route.
//   R3  the row keeps its affordances: on / the aria-hidden arrow is inside the link; hovering the link changes a background inside it.
import { createHash } from 'node:crypto';
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f3-rendered.mjs';
const M = goldenJson('f3-media.json');
const E = goldenJson('f3-events.json');
const WIDTHS = [1280, 390];
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]';
const failures = [];
let checks = 0;

const tilePath = (tile) => tile.path ?? (tile.dest ? `/${tile.dest.replace(/^public\//, '')}` : null);
const basename = (p) => p.split('/').pop().replace(/\.[a-z0-9]+$/i, '');

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      const at = (route) => `${mode} ${route} @${width}`;
      const go = async (route) => { const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'networkidle' }); return r ? r.status() : 0; };
      const fetchSha = async (p) => { const r = await ctx.request.get(`${srv.origin}${p}`); return r.ok() ? createHash('sha256').update(await r.body()).digest('hex') : `HTTP ${r.status()}`; };

      // R1
      checks += 1;
      await go(M.route);
      const tiles = await page.evaluate((section) => {
        const label = [...document.querySelectorAll('main p')].find((p) => p.textContent.trim() === section);
        const sec = label?.closest('section');
        if (!sec) return null;
        return [...sec.querySelectorAll('h2')].map((h) => {
          const card = h.parentElement;
          const img = card.querySelector('img');
          const box = img?.parentElement;
          let bg = null;
          for (let e = box; e && e !== card.parentElement; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } }
          return { name: h.textContent.trim(), href: card.querySelector('a[download]')?.getAttribute('href') ?? null, src: img ? new URL(img.currentSrc || img.src).pathname + new URL(img.currentSrc || img.src).search : null, previewBg: bg };
        });
      }, M.section);
      const where = at(M.route);
      if (!tiles) failures.push(`${where}: no "${M.section}" section (R1)`);
      else {
        const want = M.tiles.map((tile) => tile.name);
        const got = tiles.map((tile) => tile.name);
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${where}: tiles ${JSON.stringify(got)}, want ${JSON.stringify(want)} (R1)`);
        for (const tile of M.tiles) {
          const t = tiles.find((x) => x.name === tile.name);
          if (!t) continue;
          const p = tilePath(tile);
          if (t.href !== p) failures.push(`${where}: tile "${tile.name}" downloads ${t.href}, want ${p} (R1)`);
          else { const h = await fetchSha(p); if (h !== tile.sha256) failures.push(`${where}: ${p} served sha256 ${h}, want ${tile.sha256} (R1)`); }
          const okSrc = t.src === p || new RegExp(`^/images/_opt/${basename(p)}-\\d+\\.webp$`).test(t.src ?? '') || (t.src ?? '').startsWith(`/_next/image?url=${encodeURIComponent(p)}&`);
          if (!okSrc) failures.push(`${where}: tile "${tile.name}" preview ${t.src}, want ${p} or its optimised derivative (R1)`);
          if (tile.previewBg && t.previewBg !== tile.previewBg) failures.push(`${where}: tile "${tile.name}" preview ground ${t.previewBg}, want ${tile.previewBg} (R1)`);
        }
      }

      // R2 + R3
      for (const row of E.rows) {
        checks += 1;
        await go(row.route);
        const rw = at(row.route);
        const expected = E.verified.rows.filter((v) => v.onRoutes.includes(row.route));
        const links = await page.evaluate(({ scope, pattern, interactive }) => {
          const root = document.querySelector(scope);
          if (!root) return null;
          const re = new RegExp(pattern);
          return [...root.querySelectorAll('a[href]')].filter((a) => re.test(a.getAttribute('href'))).map((a, i) => {
            a.setAttribute('data-r16-row', String(i));
            const rowEl = a.closest('article, li') ?? a;
            const inner = [...a.querySelectorAll(interactive)].length;
            const others = [...rowEl.querySelectorAll(interactive)].filter((x) => x !== a && !a.contains(x)).length + (a.parentElement?.closest(interactive) ? 1 : 0);
            const arrow = [...a.querySelectorAll('[aria-hidden="true"]')].some((x) => x.textContent.trim() === '→');
            return { i, href: a.getAttribute('href'), inner, others, arrow };
          });
        }, { scope: row.scope, pattern: E.hrefPattern, interactive: INTERACTIVE });
        if (!links) { failures.push(`${rw}: no ${row.scope} (R2)`); continue; }
        if (links.length !== expected.length) failures.push(`${rw}: ${links.length} event-row links, want ${expected.length} (${expected.map((v) => v.title).join(', ')}) (R2)`);
        for (const v of expected) {
          const href = `/events/${v.slug}`;
          const link = links.find((l) => l.href === href);
          if (!link) { failures.push(`${rw}: no row link to ${href} for "${v.title}" (R2)`); continue; }
          const named = page.locator(row.scope).getByRole('link', { name: v.title, exact: true });
          const n = await named.count();
          if (n !== 1) failures.push(`${rw}: ${n} links with accessible name exactly "${v.title}", want 1 (R2)`);
          if (link.inner) failures.push(`${rw}: row link ${href} nests ${link.inner} interactive element(s) (R2)`);
          if (link.others) failures.push(`${rw}: row for "${v.title}" has ${link.others} other interactive element(s) (R2)`);
          if (row.arrow && !link.arrow) failures.push(`${rw}: row link ${href} lost its aria-hidden ${row.arrow} (R3)`);
          if (row.hover) {
            const a = page.locator(`[data-r16-row="${link.i}"]`);
            const snap = () => a.evaluate((el) => [el, ...el.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundColor).join('|'));
            await page.mouse.move(0, 0);
            await page.waitForTimeout(250);
            const before = await snap();
            await a.hover();
            await page.waitForTimeout(250);
            if ((await snap()) === before) failures.push(`${rw}: hovering the row link ${href} changes no background (R3)`);
          }
          const dest = await ctx.newPage();
          const r = await dest.goto(`${srv.origin}${href}`, { waitUntil: 'domcontentloaded' });
          const st = r ? r.status() : 0;
          const h1 = st === 200 ? await dest.locator('h1').first().innerText().catch(() => null) : null;
          await dest.close();
          if (st !== 200) failures.push(`${rw}: ${href} answers HTTP ${st}, want 200 (R2)`);
          else if ((h1 ?? '').trim() !== v.title) failures.push(`${rw}: ${href} h1 ${JSON.stringify(h1)}, want ${JSON.stringify(v.title)} (R2)`);
        }
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`${mode}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish(NAME, failures, `F3 rendered: ${checks} checks across ${MODES.join('/')} at ${WIDTHS.join('/')}: three byte-identical brand tiles, one titled link per event row to its 200 page.`);
