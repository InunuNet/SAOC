// F4 rendered at 390@3, 768@1, 1280@1 and 1440@2, on the env-gated fixture route /ticket-fixtures/buy (the real
// buy form needs an on-sale product, which a hermetic build does not have).
//   - flagless server: the fixture is a 404
//   - flagged server (NOS Design ruling): the form shows "Refunds · Privacy" on ONE line after the Buy button, "Refunds"
//     -> /refunds and "Privacy" -> /privacy, each underlined, >=24px tall, text contrast >=4.5:1 on the ground it
//     sits on, the first starting no more than 160px below the Buy button's bottom edge, no horizontal overflow
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
        deco: getComputedStyle(a).textDecorationLine,
        color: getComputedStyle(a).color,
      }));
      const channels = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      let ground = [255, 255, 255];
      for (let el = form?.querySelector('.nk-policy'); el; el = el.parentElement) {
        const bg = channels(getComputedStyle(el).backgroundColor);
        if (bg.length >= 3 && (bg[3] === undefined || bg[3] > 0.99)) { ground = bg.slice(0, 3); break; }
      }
      const ratio = links.map((l) => { const [hi, lo] = [lum(channels(l.color)), lum(ground)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); });
      const line = (form?.querySelector('.nk-policy')?.textContent ?? '').replace(/\s+/g, ' ').trim();
      return {
        hasForm: !!form,
        buyBottom: buy ? buy.getBoundingClientRect().bottom : null,
        links, ratio, line,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (!m.hasForm) { failures.push(`${tag}: no buy form on the fixture`); await ctx.close(); continue; }
    const want = [['Refunds', '/refunds'], ['Privacy', '/privacy']];
    if (m.line !== 'Refunds · Privacy') failures.push(`${tag}: policy line reads "${m.line}", want "Refunds · Privacy"`);
    if (m.links.length !== 2) failures.push(`${tag}: ${m.links.length} policy links in the form, want 2`);
    else {
      m.links.forEach((l, i) => {
        if (l.text !== want[i][0] || l.href !== want[i][1]) failures.push(`${tag}: link ${i + 1} is "${l.text}" -> ${l.href}, want "${want[i][0]}" -> ${want[i][1]}`);
        if (l.h < 24) failures.push(`${tag}: "${l.text}" is ${l.h.toFixed(1)}px tall, want >=24`);
        if (!/underline/.test(l.deco)) failures.push(`${tag}: "${l.text}" is not underlined (${l.deco})`);
        if (m.ratio[i] < 4.5) failures.push(`${tag}: "${l.text}" contrast ${m.ratio[i].toFixed(2)}:1, want >=4.5:1`);
      });
      if (Math.abs(m.links[0].top - m.links[1].top) > 2) failures.push(`${tag}: Refunds and Privacy are not on one line (tops ${m.links[0].top.toFixed(0)}, ${m.links[1].top.toFixed(0)})`);
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
