// nos-archive-public-r64 rendered: PUBLIC and PREVIEW production builds (_server.mjs; ports 3010-3019 minus 3002, 3013, 3016). QA input, hash-locked.
// Goldens: goldens/edits.json. Nothing here writes: pages are fetched and screenshotted, Sanity is READ (published perspective, public CDN).
// The rule under test (Codi, r64 P2/P3; saoc-82 approval): a public build hides /national-show/archive (404) and every link to it until Sanity holds a past
// show that carries recorded facts; a preview build keeps the route and every link. The expectation is computed live from Sanity (hasRecords), so the
// check flips with the data instead of naming a year. The live dataset holds no past show (2026-10-22), so the hidden branch is what runs today; the
// "records exist" branch is proved by unit.mjs.
//   PUBLIC (hasRecords false)
//   R1  GET /national-show/archive, /archive/2027 and /archive/2024 answer 404.
//   R2  no probe page (hub, faq, sponsors, tickets, /about = SAOC chrome) and not the 404 page itself carries the string national-show/archive anywhere in its
//       HTML, flight payload included: no link, no nav prop, no breadcrumb label.
//   R3  the hub "Planning a visit" list has 4 entries (preview 5) and the "Explore the show pages" index has 15 links (preview 16).
//   R4  /sitemap.xml does not list /national-show/archive.
//   PREVIEW
//   P1  /national-show/archive answers 200 with H1 "Past shows" and a <title> containing "Past shows" and not "Archive"; none of the old nouns in the text.
//   P2  every probe page still carries the archive href; hub destinations 5, Explore index 16.
//   P3  /sitemap.xml still lists /national-show/archive; /archive/2027 answers 404 as at base (no such record).
//   hasRecords true flips R1-R4 to "reachable and linked" (200, href present, sitemap lists it).
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { authorize, require, serve } from './_server.mjs';

const G = goldenJson('edits.json');
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const MODES = (process.env.NOS_ARCH_MODES ?? 'public,preview').split(',').filter(Boolean);
const failures = [];

async function readHasRecords() {
  const env = {};
  try {
    for (const line of readFileSync(path.join(repoRoot, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^(NEXT_PUBLIC_SANITY_PROJECT_ID|NEXT_PUBLIC_SANITY_DATASET)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* fall back to the process env */ }
  const project = env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.NEXT_PUBLIC_SANITY_DATASET;
  const url = `https://${project}.apicdn.sanity.io/v${G.sanityApiVersion}/data/query/${dataset}?perspective=published&query=${encodeURIComponent(G.sanityPastQuery)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`INFRA: Sanity read answered ${res.status}`);
  const docs = (await res.json()).result ?? [];
  const fact = (d) => typeof d.year === 'number' && ((typeof d.location === 'string' && d.location.trim() !== '') || d.entries > 0 || d.exhibitors > 0 || d.awards > 0);
  return docs.some(fact);
}

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const block = (html, open) => { const i = html.indexOf(open); if (i < 0) return ''; const j = html.indexOf('</nav>', i); return html.slice(i, j < 0 ? undefined : j); };
const anchors = (s) => (s.match(/<a\s/g) ?? []).length;
const destinations = (html) => { const i = html.indexOf('data-nos-destinations'); if (i < 0) return -1; const j = html.indexOf('</ul>', i); return (html.slice(i, j).match(/<li[\s>]/g) ?? []).length; };

const hasRecords = await readHasRecords();
const { chromium } = require('playwright');
let browser = null;
try { browser = await chromium.launch(process.env.NOS_ARCH_CHROME ? { executablePath: process.env.NOS_ARCH_CHROME } : {}); } catch (e) { console.warn(`note: screenshots skipped (${String(e).split('\n')[0]})`); }

try {
  for (const mode of MODES) {
    const srv = await serve(mode);
    if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
    try {
      const get = async (p) => { const r = await fetch(`${srv.origin}${p}`, { headers: srv.headers, redirect: 'manual' }); return { status: r.status, html: await r.text() }; };
      const visible = mode === 'preview' || hasRecords;
      const at = (p) => `${mode} ${p}`;

      // archive routes
      const arch = await get(G.archivePath);
      if (arch.status !== (visible ? 200 : 404)) failures.push(`${at(G.archivePath)} answered ${arch.status}, needs ${visible ? 200 : 404} (${mode === 'public' ? 'R1' : 'P1'})`);
      for (const y of [G.yearPath, G.yearPathPast]) {
        const r = await get(y);
        if (!hasRecords && r.status !== 404) failures.push(`${at(y)} answered ${r.status}, needs 404 (${mode === 'public' ? 'R1' : 'P3'})`);
      }

      // leaks / presence on the probe pages
      const probes = [...G.leakProbePages];
      const pages = {};
      for (const p of probes) {
        const r = await get(p);
        pages[p] = r.html;
        if (r.status !== 200) failures.push(`${at(p)} answered ${r.status} (INFRA)`);
        const n = r.html.split('national-show/archive').length - 1;
        // /about wears the SAOC chrome, whose menus are closed in the HTML: its presence is proved in the browser below.
        if (visible && n < 1 && p !== '/about') failures.push(`${at(p)} carries no link to the archive (P2)`);
        if (!visible && n > 0) failures.push(`${at(p)} still carries national-show/archive ${n} time(s): a dead link or a leaked nav prop (R2)`);
      }
      if (!visible) {
        const n = arch.html.split('national-show/archive').length - 1;
        if (n > 0) failures.push(`${at(G.archivePath)} (the 404 page) carries national-show/archive ${n} time(s) (R2)`);
      }

      // counts on the hub and an inner page
      const hubDest = destinations(pages['/national-show']);
      if (hubDest !== (visible ? 5 : 4)) failures.push(`${at('/national-show')} "Planning a visit" lists ${hubDest}, needs ${visible ? 5 : 4} (${visible ? 'P2' : 'R3'})`);
      const explore = anchors(block(pages['/national-show/faq'], 'aria-label="Explore the show pages"'));
      if (explore !== (visible ? 16 : 15)) failures.push(`${at('/national-show/faq')} Explore index holds ${explore} links, needs ${visible ? 16 : 15} (${visible ? 'P2' : 'R3'})`);

      // sitemap
      const sm = await get('/sitemap.xml');
      const listed = sm.html.includes(`${G.archivePath}<`);
      if (sm.status !== 200) failures.push(`${at('/sitemap.xml')} answered ${sm.status} (INFRA)`);
      else if (listed !== visible) failures.push(`${at('/sitemap.xml')} ${listed ? 'lists' : 'does not list'} ${G.archivePath}, needs ${visible ? 'listed' : 'absent'} (${visible ? 'P3' : 'R4'})`);

      // preview: the archive page itself, one noun
      if (mode === 'preview' && arch.status === 200) {
        const h1 = (arch.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1];
        const h1Text = h1 ? text(h1).trim() : '';
        if (h1Text !== G.noun) failures.push(`${at(G.archivePath)} H1 is "${h1Text}", needs "${G.noun}" (P1)`);
        const title = text((arch.html.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1] ?? '').trim();
        if (!title.includes(G.noun) || /archive/i.test(title)) failures.push(`${at(G.archivePath)} title is "${title}", needs "${G.noun}" and no "Archive" (P1)`);
        const body = text(arch.html);
        for (const old of G.oldNouns.filter((o) => o !== 'Archive')) if (body.includes(old)) failures.push(`${at(G.archivePath)} still shows the old noun "${old}" (P1)`);
      }

      if (browser) {
        for (const width of [1280, 390]) {
          const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
          await authorize(ctx, srv);
          const page = await ctx.newPage();
          try {
            // SAOC chrome (/about, desktop width): open the National Show mega and count the archive links. (The mobile menu keeps its sections collapsed;
            // static.mjs S4 pins that it receives the same filtered nav.)
            if (width >= 1240) {
              await page.goto(`${srv.origin}/about`, { waitUntil: 'networkidle', timeout: 60_000 });
              await page.locator('nav[aria-label="Primary"] button[aria-haspopup="true"]').first().click({ timeout: 10_000 }).catch((e) => failures.push(`${at('/about')} (${width}): INFRA - the menu trigger did not click: ${String(e).split('\n')[0]}`));
              await page.waitForTimeout(400);
              const linked = await page.locator(`a[href="${G.archivePath}"]`).count();
              if (visible ? linked < 1 : linked > 0) failures.push(`${at('/about')} (SAOC chrome, ${width}) has ${linked} archive link(s) once the menu is open, needs ${visible ? 'at least 1' : 0} (${visible ? 'P2' : 'R2'})`);
            }
            const t = mode === 'preview' ? G.archivePath : '/national-show/faq';
            await page.goto(`${srv.origin}${t}`, { waitUntil: 'networkidle', timeout: 60_000 });
            const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
            if (over) failures.push(`${at(t)} overflows horizontally at ${width} (X1)`);
            await page.screenshot({ path: path.join(SHOTS, `r64-${mode}-${width}.png`), fullPage: true }).catch(() => {});
          } finally { await ctx.close(); }
        }
      }
    } finally {
      await srv.stop();
    }
  }
} finally {
  if (browser) await browser.close();
}
finish('rendered.mjs', failures, `R1-R4 / P1-P3 hold in ${MODES.join(' + ')} (hasRecords=${hasRecords}).`);
