// F3-T (NOS Site beta critique, 2026-10-16): the shared ticket UI as it renders on /national-show/conferences, /workshops and /tickets.
//  1. [F16 re-pin: public never sees it; admin-only] The "TEST MODE — Ozow charges R0.01" banner (components/tickets/OzowSandboxTestModeBanner.tsx) is gated on PAYMENT MODE only (NOS Design
//     ruling): driven by /api/tickets/ozow-sandbox-test-mode, never on hostname or NODE_ENV. Proven by mocking that status route:
//       enabled:false -> no banner at all; enabled:true -> a thin full-width bar in flow (not fixed/sticky/absolute), Karla 700 12px uppercase,
//       ink (royal) text on gold-100, 1px --line rule, covering no content.
//  1a. Launch posture: with nationalShow.salesOpen=false (the launch runbook default) NO TEST MODE banner, form, quantity control or price renders on
//     /tickets, /national-show/tickets, /conferences or /workshops, even when the status API says enabled:true (the banner lives inside the purchase
//     form, which is not rendered while sales are closed). salesOpen is Sanity-side, so this is measured on whatever the server serves: a page showing
//     "Sales closed" must pass the assertion; NOS_SALES_CLOSED=1 (set by the gate against a salesOpen=false dataset) additionally FAILS a page that
//     is not closed. The static twin (check-f3-static.mjs sales-gate) proves the code path.
//  1b. /tickets: no single primary - every "Add to booking" button has the same background, colour and size; no new hero CTA. If a hero fan
//     ([data-nos-ticket-fan]) exists its cards are visible at 390 and anchor to a resolving #ticket-{id}.
//  2. "Buy Ticket" and every ticket control use the NOS button role (F2 Button.tsx: Karla 700 14px uppercase), never the off-palette violet
//     rgb(126, 63, 151) as a fill, text or border colour.
//  3. No visible text under 12px (the 10.5px pill, the 11px legends and labels).
//  4. Quantity steppers (button[aria-label*="quantity" i]) and quantity inputs (input[type=number]) are at least 44x44px.
import { main, openPage, withBrowser, VP_DESKTOP, VP_PHONE, rgbOf, rgbNear, firstFamily, BASE, ROYAL_RGB, GOLD_100_RGB, LINE_RGB } from './_f3lib.mjs';

const ROUTES = ['/national-show/conferences', '/national-show/workshops', '/national-show/tickets'];
const VIOLET = [126, 63, 151];

function measure() {
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!(r.width > 2 && r.height > 2)) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || x.hasAttribute('hidden')) return false; } return true; };
  const small = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentElement;
    if (!n.textContent.trim() || !p || p.closest('script, style, noscript, template') || !vis(p)) continue;
    const px = parseFloat(getComputedStyle(p).fontSize);
    if (px < 12 - 0.01) small.push(`${px}px "${n.textContent.trim().slice(0, 30)}"`);
  }
  const violet = [];
  for (const e of document.querySelectorAll('main a, main button, main input, main label, main span, main div')) {
    if (!vis(e)) continue;
    const s = getComputedStyle(e);
    for (const [k, v] of [['background', s.backgroundColor], ['colour', s.color], ['border', s.borderTopColor]]) if (/rgb\(126, 63, 151\)/.test(v) && (k !== 'border' || parseFloat(s.borderTopWidth) > 0) && (k !== 'colour' || (e.textContent ?? '').trim())) violet.push(`${e.tagName.toLowerCase()} ${k}`);
  }
  const buy = [...document.querySelectorAll('main a, main button')].filter((e) => /^buy ticket/i.test((e.textContent ?? '').trim()) && vis(e)).map((e) => { const s = getComputedStyle(e); return { text: e.textContent.trim(), family: s.fontFamily, weight: Number(s.fontWeight), size: parseFloat(s.fontSize), tt: s.textTransform, bg: s.backgroundColor, colour: s.color }; });
  const steppers = [...document.querySelectorAll('main button[aria-label*="quantity" i], main input[type="number"]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { what: `${e.tagName.toLowerCase()}[${e.getAttribute('aria-label')}]`, w: r.width, h: r.height }; });
  const banner = /TEST MODE|Ozow charges/i.test(document.body.innerText);
  const add = [...document.querySelectorAll('main a, main button')].filter((e) => /^add to booking/i.test((e.textContent ?? '').trim()) && vis(e)).map((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { bg: s.backgroundColor, colour: s.color, size: s.fontSize, border: s.borderTopColor, w: Math.round(r.width), h: Math.round(r.height) }; });
  const fan = document.querySelector('[data-nos-ticket-fan]');
  const fanInfo = fan ? [...fan.querySelectorAll('a[href^="#"]')].map((a) => { const r = a.getBoundingClientRect(); const id = a.getAttribute('href').slice(1); return { href: a.getAttribute('href'), visible: vis(a) && r.right > 0 && r.left < innerWidth, resolves: !!document.getElementById(id) }; }) : null;
  return { small: [...new Set(small)], violet: [...new Set(violet)], buy, steppers, banner, add, fanInfo };
}

await main('F3-T tickets', async (r) => {
  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const { ctx, page, status } = await openPage(browser, vp, route);
        const tag = `${route} @${name}`;
        if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
        const m = await page.evaluate(measure);
        const addKeys = new Set(m.add.map((a) => `${a.bg}|${a.colour}|${a.size}|${a.border}`));
        if (addKeys.size > 1) r.fail(`${tag}: "Add to booking" buttons are not equal-weight (${[...addKeys].join(' vs ')})`);
        if (route.endsWith('/tickets') && m.fanInfo) for (const f of m.fanInfo) { if (!f.visible && name === '390') r.fail(`${tag}: hero fan card ${f.href} is not visible at 390`); if (!f.resolves) r.fail(`${tag}: hero fan anchor ${f.href} resolves to no #ticket-{id}`); }
        for (const s of m.small) r.fail(`${tag}: text under 12px: ${s}`);
        for (const v of m.violet) r.fail(`${tag}: off-palette violet rgb(126, 63, 151) used as ${v}`);
        for (const b of m.buy) if (!/karla/i.test(firstFamily(b.family)) || b.weight !== 700 || Math.abs(b.size - 14) > 0.3 || b.tt !== 'uppercase' || rgbNear(rgbOf(b.bg), VIOLET, 3)) r.fail(`${tag}: "${b.text}" is ${firstFamily(b.family)} ${b.weight} ${b.size}px ${b.tt} on ${b.bg}, want the NOS button role (Karla 700 14px uppercase, not violet)`);
        for (const s of m.steppers) if (s.w < 43.9 || s.h < 43.9) r.fail(`${tag}: ${s.what} is ${s.w.toFixed(0)}x${s.h.toFixed(0)}px, want >=44x44`);
        await ctx.close();
      }
    }
  });

  await withBrowser(async (browser) => {
    for (const route of ROUTES) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        for (const enabled of [false, true]) {
          const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
          const page = await ctx.newPage();
          page.setDefaultTimeout(8000);
          await page.route('**/api/tickets/ozow-sandbox-test-mode', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled }) }));
          await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(600);
          const tag = `${route} @${name} mode=${enabled ? 'test' : 'live'}`;
          const b = await page.evaluate(() => {
            const el = [...document.querySelectorAll('[role="status"], div, p')].filter((e) => /TEST MODE|Ozow charges/i.test(e.textContent ?? '') && !e.querySelector('[role="status"], div, p'))[0];
            if (!el) return null;
            const s = getComputedStyle(el); const r = el.getBoundingClientRect();
            const bar = el.closest('[role="status"]') ?? el;
            const bs = getComputedStyle(bar); const br = bar.getBoundingClientRect();
            return { family: s.fontFamily, weight: Number(s.fontWeight), size: parseFloat(s.fontSize), tt: s.textTransform, colour: s.color, bg: bs.backgroundColor, bw: parseFloat(bs.borderTopWidth) + parseFloat(bs.borderBottomWidth), bcol: bs.borderTopColor === 'rgba(0, 0, 0, 0)' || parseFloat(bs.borderTopWidth) === 0 ? bs.borderBottomColor : bs.borderTopColor, position: bs.position, w: br.width, h: br.height, vw: innerWidth, x: br.left };
          });
          // RE-PINNED by launch-weekend F16: the strip is for verified admins only (lib/admin-viewer.ts), so a public visitor never sees it,
          // whatever the status API says. The admin-positive path and the in-container geometry are proven by launch-weekend/f16 check-e-testmode.
          if (b) r.fail(`${tag}: a TEST MODE banner renders for a public visitor (F16: admin-only)`);
          await ctx.close();
        }
      }
    }
  });

  await withBrowser(async (browser) => {
    for (const route of ['/tickets', ...ROUTES]) {
      for (const [name, vp] of [['1280', VP_DESKTOP], ['390', VP_PHONE]]) {
        const ctx = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        page.setDefaultTimeout(8000);
        await page.route('**/api/tickets/ozow-sandbox-test-mode', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true }) }));
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);
        const tag = `${route} @${name} (status enabled:true)`;
        const m = await page.evaluate(() => {
          const txt = document.querySelector('main')?.innerText ?? '';
          return { closed: /sales (are )?closed/i.test(txt), banner: /TEST MODE|Ozow charges/i.test(document.body.innerText), form: !!document.querySelector('main form, main input[type="number"], main button[aria-label*="quantity" i]'), price: /\bR\s?\d[\d\s,.]*/.test(txt) };
        });
        if (process.env.NOS_SALES_CLOSED === '1' && !m.closed) r.fail(`${tag}: NOS_SALES_CLOSED=1 but the page is not in the sales-closed state`);
        if (m.closed || process.env.NOS_SALES_CLOSED === '1') {
          if (m.banner) r.fail(`${tag}: sales closed but a TEST MODE banner renders`);
          if (m.form) r.fail(`${tag}: sales closed but a ticket form / quantity control renders`);
          if (m.price) r.fail(`${tag}: sales closed but a price (R...) renders`);
        }
        await ctx.close();
      }
    }
  });
});
