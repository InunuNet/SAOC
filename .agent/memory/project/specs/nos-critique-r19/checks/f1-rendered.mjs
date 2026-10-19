// nos-critique-r19 F1 rendered (fresh PUBLIC and PREVIEW production builds, next start 3010-3019 minus 3013). QA input, hash-locked.
// Goldens: goldens/f1-edits.json, f1-baseline.json. Both modes, 1280 and 390, on the ticket state pages:
//   /tickets/cancelled, /tickets/cancelled?ref=R19-CHECK (the booking-ref line shows), /tickets/confirmation?ref=<bogus> and
//   /tickets/confirmation with no ref (both the booking-not-found state; no Firestore fixture is needed, a bogus ref finds no ticket).
//   R1  "Back to tickets" is exactly one link in main, to /national-show/tickets, an nk-btn nk-cta: its left edge equals the h1's and the
//       lede's (+-1px), it is its natural (max-content) width (+-1px) and narrower than the h1 column, and it is 50px tall.
//   R2  the title: "Payment cancelled | South African Orchid Council" and "Booking not found | South African Orchid Council", both in the
//       server HTML (<title> of the HTTP response) and in document.title after hydration.
//   R3  not-found: one h1, "Booking not found"; the hero lede is an existing not-found sentence: BASE's rendered fallback (f1-baseline.json)
//       or the CMS confirmationNotFoundMessage (f1-edits.json notFound.cmsMessage); no other element in main carries "Booking not found";
//       no "Back to tickets" text link remains; 4s after load the state has not changed (no poller "Confirming" state).
//   R4  cancelled: the h1, the lede and their boxes equal BASE (+-1px); the booking ref line, when shown, starts on the same edge.
//   R5  no horizontal overflow.
// `--capture` prints goldens/f1-baseline.json (captured by @architect on BASE 93940e04, both modes).
import { BASE, finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const CAPTURE = process.argv.includes('--capture');
const G = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const ROUTES = [
  { route: '/tickets/cancelled', kind: 'cancelled' },
  { route: '/tickets/cancelled?ref=R19-CHECK', kind: 'cancelled', ref: 'R19-CHECK' },
  { route: `/tickets/confirmation?ref=${G.notFound.bogusRef}`, kind: 'notFound' },
  { route: '/tickets/confirmation', kind: 'notFound' },
];
const HUB = '/national-show/tickets';
const SETTLE_MS = 4000;
const failures = [];
const got = {};
let checks = 0;
const near = (a, b) => Math.abs(a - b) <= 1;
const baseline = CAPTURE ? null : goldenJson('f1-baseline.json').got;

const measure = (page) => page.evaluate(({ HUB }) => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, w: r.width, h: r.height }; };
  const main = document.querySelector('main') ?? document.body;
  const h1s = [...document.querySelectorAll('h1')];
  const lede = document.querySelector('[data-nos-hero-lede]');
  const links = [...main.querySelectorAll('a')].filter((a) => /^back to tickets$/i.test(norm(a.textContent)));
  const btn = links[0] ?? null;
  let natural = null;
  if (btn) { const keep = btn.style.width; btn.style.width = 'max-content'; natural = btn.getBoundingClientRect().width; btn.style.width = keep; }
  const textLinks = links.filter((a) => !(a.getAttribute('class') ?? '').split(/\s+/).includes('nk-btn')).length;
  const refLine = [...main.querySelectorAll('p')].find((p) => /^Booking ref:/.test(norm(p.textContent)));
  const notFoundCarriers = [...main.querySelectorAll('*')].filter((e) => e.children.length === 0 && norm(e.textContent) === 'Booking not found').map((e) => e.tagName.toLowerCase());
  return {
    title: document.title, h1s: h1s.map((h) => norm(h.textContent)), h1: box(h1s[0]), lede: box(lede), ledeText: lede ? norm(lede.textContent) : null,
    links: links.length, btn: btn ? { ...box(btn), href: btn.getAttribute('href'), cls: btn.getAttribute('class'), natural } : null, textLinks,
    ref: refLine ? box(refLine) : null, notFoundCarriers, confirming: /Confirming your payment/.test(main.textContent),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, hub: HUB,
  };
}, { HUB });

// BASE renders not-found client-side (ConfirmationPoller): its sentence is the <p> after the h2.
const baseNotFound = (page) => page.evaluate(() => {
  const h2 = [...document.querySelectorAll('main h2')].find((h) => h.textContent.trim() === 'Booking not found');
  return h2 && h2.nextElementSibling ? h2.nextElementSibling.textContent.replace(/\s+/g, ' ').trim() : null;
});

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      for (const { route, kind, ref } of ROUTES) {
        checks += 1;
        const at = `${mode} ${route} @${width}`;
        const r = await page.goto(`${srv.origin}${route}`, { waitUntil: 'load' }); // the poller polls every 3s, so networkidle may never come
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); continue; }
        const html = await r.text();
        await page.waitForTimeout(SETTLE_MS);
        await page.evaluate(async () => { await document.fonts.ready; });
        const m = await measure(page);
        if (CAPTURE) {
          got[`${mode} ${route} @${width}`] = kind === 'cancelled' ? { h1s: m.h1s, h1: m.h1, lede: m.lede, ledeText: m.ledeText } : { notFoundMessage: await baseNotFound(page) };
          continue;
        }
        const b = baseline[`${mode} ${route} @${width}`];
        if (!b) { failures.push(`${at}: no baseline`); continue; }

        // R1
        if (m.links !== 1 || !m.btn) failures.push(`${at}: ${m.links} "Back to tickets" links in main, want 1 (R1)`);
        else {
          const cls = (m.btn.cls ?? '').split(/\s+/);
          if (m.btn.href !== HUB) failures.push(`${at}: "Back to tickets" goes to ${m.btn.href}, want ${HUB} (R1)`);
          if (!cls.includes('nk-btn') || !cls.includes('nk-cta')) failures.push(`${at}: "Back to tickets" is not an nk-btn nk-cta (class ${JSON.stringify(m.btn.cls)}) (R1)`);
          if (!m.h1 || !near(m.btn.left, m.h1.left)) failures.push(`${at}: button left ${Math.round(m.btn.left)}px, h1 left ${m.h1 ? Math.round(m.h1.left) : '-'}px (R1)`);
          if (!m.lede || !near(m.btn.left, m.lede.left)) failures.push(`${at}: button left ${Math.round(m.btn.left)}px, lede left ${m.lede ? Math.round(m.lede.left) : '-'}px (R1)`);
          if (!near(m.btn.w, m.btn.natural)) failures.push(`${at}: button ${Math.round(m.btn.w)}px wide, its natural width is ${Math.round(m.btn.natural)}px (R1)`);
          if (m.h1 && m.btn.w >= m.h1.w - 1) failures.push(`${at}: button ${Math.round(m.btn.w)}px spans the h1 column (${Math.round(m.h1.w)}px) (R1)`);
          if (Math.abs(m.btn.h - 50) > 0.5) failures.push(`${at}: button ${m.btn.h}px tall, want 50 (R1)`);
        }

        // R2
        const want = kind === 'cancelled' ? G.cancelledTitle : G.notFound.title;
        if (!html.includes(`<title>${want}</title>`)) failures.push(`${at}: the server HTML has no <title>${want}</title> (R2)`);
        if (m.title !== want) failures.push(`${at}: document.title ${JSON.stringify(m.title)}, want ${JSON.stringify(want)} (R2)`);

        if (kind === 'notFound') {
          // R3
          if (m.h1s.length !== 1 || m.h1s[0] !== G.notFound.h1) failures.push(`${at}: h1 ${JSON.stringify(m.h1s)}, want one "${G.notFound.h1}" (R3)`);
          const sentences = [b.notFoundMessage, G.notFound.cmsMessage].filter(Boolean);
          if (!sentences.includes(m.ledeText)) failures.push(`${at}: lede ${JSON.stringify(m.ledeText)}, want an existing not-found sentence ${JSON.stringify(sentences)} (R3)`);
          if (m.notFoundCarriers.length !== 1 || m.notFoundCarriers[0] !== 'h1') failures.push(`${at}: "Booking not found" is carried by ${JSON.stringify(m.notFoundCarriers)}, want only the h1 (R3)`);
          if (m.textLinks) failures.push(`${at}: a "Back to tickets" text link (not the nk-btn) remains (R3)`);
          if (m.confirming) failures.push(`${at}: the poller's "Confirming your payment" state is on the page (R3)`);
        } else {
          // R4
          if (JSON.stringify(m.h1s) !== JSON.stringify(b.h1s)) failures.push(`${at}: h1 ${JSON.stringify(m.h1s)}, BASE ${JSON.stringify(b.h1s)} (R4)`);
          if (m.ledeText !== b.ledeText) failures.push(`${at}: lede ${JSON.stringify(m.ledeText)}, BASE ${JSON.stringify(b.ledeText)} (R4)`);
          for (const k of ['h1', 'lede']) if (!m[k] || !near(m[k].left, b[k].left) || !near(m[k].w, b[k].w) || !near(m[k].h, b[k].h)) failures.push(`${at}: ${k} box ${JSON.stringify(m[k])}, BASE ${JSON.stringify(b[k])} (R4)`);
          if (ref && (!m.ref || !m.h1 || !near(m.ref.left, m.h1.left))) failures.push(`${at}: the "Booking ref" line does not start on the h1 edge (R4)`);
        }

        // R5
        if (m.overflow > 0) failures.push(`${at}: scrolls horizontally by ${m.overflow}px (R5)`);
      }
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (CAPTURE) {
  if (failures.length) finish(NAME, failures);
  process.stdout.write(`${JSON.stringify({ recorded: `${MODES.join(' and ')} builds of BASE ${BASE}: cancelled h1/lede text and boxes; the client-rendered not-found sentence`, got })}\n`);
  process.exit(0);
}
finish(NAME, failures, `${checks} state-page captures (${MODES.join('/')}, ${WIDTHS.join('/')}): "Back to tickets" is the natural-width 50px NOS button on the hero edge, titles are right in the server HTML, not-found is one server-rendered h1 with an existing sentence as lede.`);
