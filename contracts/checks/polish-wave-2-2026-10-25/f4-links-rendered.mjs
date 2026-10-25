// F4 rendered at 390@3, 768@1, 1280@1 and 1440@2, on the env-gated fixture route /ticket-fixtures/buy (the real
// buy form needs an on-sale product, which a hermetic build does not have).
//   - flagless server: the fixture is a 404
//   - flagged server: the form shows exactly two policy links after the Buy button, "Refund & Cancellation Policy"
//     -> /refunds and "Privacy and Personal Information Policy" -> /privacy, each >=44px tall, the first starting no
//     more than 160px below the Buy button's bottom edge, no horizontal overflow
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f4-links-rendered.mjs
import { finish } from './_lib.mjs';
import { buildProblem, get, require, startServer } from './_server.mjs';
import { VIEWPORTS } from './_viewports.mjs';

const failures = [];
const stale = buildProblem(['components/tickets/TicketPurchaseForm.tsx', 'app/(nos)/national-show/nos-structure.css']);
if (stale.length) finish('f4-links-rendered', stale);

const flagless = await startServer();
try {
  const r = await get(flagless.port, '/ticket-fixtures/buy', 'localhost');
  if (r.status !== 404) failures.push(`flagless server: /ticket-fixtures/buy returned ${r.status}, want 404`);
} finally {
  flagless.stop();
}

const { chromium } = require('playwright');
const srv = await startServer({ env: { TICKET_FIXTURES: '1' } });
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const tag = `${vp.width}@${vp.dpr}`;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${srv.port}/ticket-fixtures/buy`, { waitUntil: 'load', timeout: 30000 });
    const m = await page.evaluate(() => {
      const form = document.querySelector('form[data-nos-ticket-form]');
      const buy = form?.querySelector('button[type="submit"]');
      const links = [...(form?.querySelectorAll('.nk-policy a') ?? [])].map((a) => ({
        text: (a.textContent ?? '').trim(),
        href: a.getAttribute('href'),
        h: a.getBoundingClientRect().height,
        top: a.getBoundingClientRect().top,
      }));
      return {
        hasForm: !!form,
        buyBottom: buy ? buy.getBoundingClientRect().bottom : null,
        links,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (!m.hasForm) { failures.push(`${tag}: no buy form on the fixture`); await ctx.close(); continue; }
    const want = [['Refund & Cancellation Policy', '/refunds'], ['Privacy and Personal Information Policy', '/privacy']];
    if (m.links.length !== 2) failures.push(`${tag}: ${m.links.length} policy links in the form, want 2`);
    else {
      m.links.forEach((l, i) => {
        if (l.text !== want[i][0] || l.href !== want[i][1]) failures.push(`${tag}: link ${i + 1} is "${l.text}" -> ${l.href}, want "${want[i][0]}" -> ${want[i][1]}`);
        if (l.h < 44) failures.push(`${tag}: "${l.text}" is ${l.h.toFixed(1)}px tall, want >=44`);
      });
      if (m.buyBottom !== null && !(m.links[0].top >= m.buyBottom - 1 && m.links[0].top - m.buyBottom <= 160)) failures.push(`${tag}: first policy link is ${(m.links[0].top - m.buyBottom).toFixed(0)}px from Buy, want 0-160 below`);
    }
    if (m.overflow > 0) failures.push(`${tag}: horizontal overflow of ${m.overflow}px`);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f4-links-rendered', failures);
