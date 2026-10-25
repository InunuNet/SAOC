// F3 rendered (a ticket page on the NOS host) at 390@3, 768@1, 1280@1 and 1440@2.
//   CL-1 every breadcrumb link in the hero is >=44px tall, with its 15px size and no underline unchanged
//   CL-2 the ticket body's form column starts on the same left edge as the hero h1 (within 1px)
// A ticket slug is taken from the tickets hub (nos.localhost /tickets), so the check measures a real page. The
// breadcrumbs and the body container render whether or not the product is purchasable. If the dataset has no
// ticket link the check fails loudly rather than measuring nothing.
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f3-layout-rendered.mjs
import { finish } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';
import { VIEWPORTS } from './_viewports.mjs';

const failures = [];
const stale = buildProblem(['app/(nos)/tickets/[slug]/page.tsx', 'app/(nos)/national-show/nos-structure.css']);
if (stale.length) finish('f3-layout-rendered', stale);

const { chromium } = require('playwright');
const srv = await startServer();
const browser = await chromium.launch();
try {
  const hub = await get(srv.port, '/tickets', 'nos.localhost');
  const slug = [...hub.body.matchAll(/href="\/tickets\/([a-z0-9-]+)"/g)].map((m) => m[1]).find((s) => s !== 'confirmation' && s !== 'cancelled');
  if (!slug) failures.push('no /tickets/<slug> link on the NOS tickets hub; the check cannot run');
  else {
    for (const vp of VIEWPORTS) {
      const tag = `${vp.width}@${vp.dpr}`;
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
      const page = await ctx.newPage();
      await page.goto(`http://nos.localhost:${srv.port}/tickets/${slug}`, { waitUntil: 'load', timeout: 30000 });
      const m = await page.evaluate(() => {
        const links = [...document.querySelectorAll('nav.nk-crumbs a')].map((a) => {
          const cs = getComputedStyle(a);
          return { text: (a.textContent ?? '').trim(), h: a.getBoundingClientRect().height, fontSize: cs.fontSize, deco: cs.textDecorationLine };
        });
        const h1 = document.querySelector('main h1, h1');
        const col = document.querySelector('[data-ticket-body] > div');
        return {
          links,
          h1Left: h1 ? h1.getBoundingClientRect().left : null,
          colLeft: col ? col.getBoundingClientRect().left : null,
        };
      });
      if (m.links.length < 2) failures.push(`${tag}: ${m.links.length} breadcrumb links, want >=2`);
      for (const l of m.links) {
        if (l.h < 44) failures.push(`${tag}: crumb "${l.text}" is ${l.h.toFixed(1)}px tall, want >=44`);
        if (l.fontSize !== '15px' || l.deco !== 'none') failures.push(`${tag}: crumb "${l.text}" look changed (${l.fontSize}, ${l.deco}), want 15px, none`);
      }
      if (m.h1Left === null || m.colLeft === null) failures.push(`${tag}: h1 or [data-ticket-body] > div not found`);
      else if (Math.abs(m.h1Left - m.colLeft) > 1) failures.push(`${tag}: form column starts at x=${m.colLeft.toFixed(1)}, hero h1 at x=${m.h1Left.toFixed(1)}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f3-layout-rendered', failures);
