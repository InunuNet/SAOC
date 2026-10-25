// F5 rendered (event detail, SAOC host) at 390@3, 768@1, 1280@1 and 1440@2.
//   SV-1  the National Show event page renders the existing ShowBand ([data-home-section="show-band"])
//         once, below the meta <dl>; its primary CTA goes to the NOS origin /tickets and its secondary
//         CTA to the NOS origin root, both derived from the configured origin (no literal nos.saoc.co.za
//         unless that is the configured origin); an ordinary event page has no band (the live dataset holds
//         only the show event, so that half is asserted statically in f5-event-static.mjs and here when one exists)
//   SV-2  the kind chip ([data-event-kind]) sits on its own line above the h1, 16px (+-1) between the
//         chip's bottom edge and the h1's top edge, and "All events" back link is >=44px tall
// Needs a build made with NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3002 (the origin asserted).
// Run as: node contracts/checks/polish-wave-2026-10-25/f5-event-detail-rendered.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['app/(marketing)/events/[slug]/page.tsx']);
if (stale.length) finish('f5-event-detail-rendered', stale);

const { chromium } = require('playwright');
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];
const NOS_ORIGIN = 'http://nos.localhost:3002';

const srv = await startServer();
const browser = await chromium.launch();
try {
  const listing = await get(srv.port, '/events', 'localhost');
  const sitemap = await get(srv.port, '/sitemap.xml', 'localhost');
  const slugs = [...new Set([...listing.body.matchAll(/href="\/events\/([a-z0-9-]+)"/g)].map((m) => m[1]), ...[...sitemap.body.matchAll(/\/events\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]))].filter((s) => s !== 'submit');
  const showSlug = slugs.find((s) => /national-(orchid|show)|south-african-national/.test(s));
  const otherSlug = slugs.find((s) => s !== showSlug);
  if (!showSlug) failures.push(`no National Show event link on /events (slugs: ${slugs.join(', ') || 'none'}); check cannot run`);

  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    const open = async (slug) => {
      const r = await page.goto(`http://localhost:${srv.port}/events/${slug}`, { waitUntil: 'load', timeout: 30000 });
      if (!r || r.status() !== 200) failures.push(`${tag} /events/${slug}: HTTP ${r ? r.status() : 'none'}`);
    };

    if (showSlug) {
      await open(showSlug);
      const bands = page.locator('[data-home-section="show-band"]');
      const n = await bands.count();
      if (n !== 1) failures.push(`${tag} show event: ${n} show bands, want 1`);
      else {
        const dl = await page.locator('main dl, dl').first().boundingBox();
        const band = await bands.first().boundingBox();
        if (!dl || !band || band.y < dl.y + dl.height - 1) failures.push(`${tag} show event: the band is not below the meta table`);
        const primary = await page.locator('[data-show-band-cta="primary"]').first().getAttribute('href');
        const secondary = await page.locator('[data-show-band-cta="secondary"]').first().getAttribute('href');
        if (primary !== `${NOS_ORIGIN}/tickets`) failures.push(`${tag} Tickets CTA href is ${primary}, want ${NOS_ORIGIN}/tickets`);
        if (secondary !== NOS_ORIGIN && secondary !== `${NOS_ORIGIN}/`) failures.push(`${tag} National Show CTA href is ${secondary}, want ${NOS_ORIGIN}`);
      }
      const chip = page.locator('[data-event-kind]');
      const h1 = page.locator('h1').first();
      if ((await chip.count()) !== 1) failures.push(`${tag} show event: ${await chip.count()} [data-event-kind] chips, want 1`);
      else {
        const c = await chip.boundingBox();
        const h = await h1.boundingBox();
        const back = await page.getByRole('link', { name: /All events/ }).first().boundingBox();
        const gap = h.y - (c.y + c.height);
        if (Math.abs(gap - 16) > 1) failures.push(`${tag} chip-to-h1 gap is ${gap.toFixed(1)}px, want 16`);
        if (back && back.y + back.height > c.y + 0.5) failures.push(`${tag} chip shares a line with the back link`);
      }
      const back = await page.getByRole('link', { name: /All events/ }).first().boundingBox();
      if (!back || back.height < 44) failures.push(`${tag} "All events" link is ${back ? back.height.toFixed(1) : 'missing'}px tall, want >=44`);
    }
    if (otherSlug) {
      await open(otherSlug);
      if ((await page.locator('[data-home-section="show-band"]').count()) !== 0) failures.push(`${tag} ordinary event /events/${otherSlug} shows the National Show band`);
      const back = await page.getByRole('link', { name: /All events/ }).first().boundingBox();
      if (!back || back.height < 44) failures.push(`${tag} ordinary event "All events" link is ${back ? back.height.toFixed(1) : 'missing'}px tall, want >=44`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f5-event-detail-rendered', failures);
