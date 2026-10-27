// events-redesign rendered checks: fresh PUBLIC and PREVIEW production builds (next start 3020-3029), /events at 1280/768/390 plus the home strip.
// QA input, hash-locked. Golden: goldens/rendered.json. Hooks the dev must emit: data-events-list (the list section, absent when nothing is
// listed), data-event-row (one per row), data-events-controls (chips + month select wrapper), data-events-about (write-up + actions section).
//   E1  hero h1 "Events" first; the ShowBand (3 data-show-band-cta) sits before the list and the about section; its "Show details" goes to /events/<showSlug>
//   E2  the National Show is not repeated as a list row (no [data-event-row] link to /events/<showSlug>)
//   E3  PUBLIC has no placeholder marker or placeholder text anywhere on /events; PREVIEW rows carry the marker and are not links
//   E4  zero listed rows => no [data-events-list] and no controls and no "No upcoming events" sentence; rows > 0 => a real h2 per month group
//   E5  [data-events-controls] renders iff listed rows >= 6
//   E6  no calendar-subscribe button (COPY GAP): no a[href="/api/events.ics"], no text "Subscribe" in main
//   E7  about: "Find your society" -> /societies; PUBLIC shows no awaiting-copy marker; PREVIEW (intro empty) shows one
//   E8  every list row, chip, select and about action is >= 44px tall; no horizontal overflow; heading outline h1 then h2 only (printed)
//   E9  home: no placeholder text (public); the "What's on" strip lists the National Show and not the zero-events sentence
import { finish, goldenJson } from './_lib.mjs';
import { MODES, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const G = goldenJson('rendered.json');
const failures = [];
let checks = 0;
const fail = (m) => failures.push(m);

for (const mode of (process.env.EV_MODES ? process.env.EV_MODES.split(",") : MODES)) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of G.widths) {
      const at = (r) => `${mode} ${r} @${width}`;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
      const page = await ctx.newPage();
      const res = await page.goto(`${srv.origin}/events`, { waitUntil: 'networkidle' });
      checks += 1;
      if (!res || res.status() !== 200) { fail(`${at('/events')}: not 200`); await ctx.close(); continue; }
      const f = await page.evaluate((g) => {
        const q = (s) => Array.from(document.querySelectorAll(s));
        const main = document.querySelector('main') ?? document.body;
        const rows = q(g.hooks.row);
        const list = document.querySelector(g.hooks.list);
        const about = document.querySelector(g.hooks.about);
        const band = document.querySelector(g.hooks.band);
        const hrefs = (root) => Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
        const before = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
        const tall = (els) => els.map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 40), h: Math.round(e.getBoundingClientRect().height) }));
        const controls = document.querySelector(g.hooks.controls);
        return {
          h1: q('h1').map((e) => e.textContent.trim()),
          outline: q('h1,h2,h3,h4').map((e) => `${e.tagName.toLowerCase()}: ${e.textContent.trim().slice(0, 60)}`),
          bandCtas: q(g.hooks.band).map((e) => ({ k: e.getAttribute('data-show-band-cta'), href: e.getAttribute('href') })),
          bandBeforeList: list ? before(band, list) : true,
          bandBeforeAbout: about ? before(band, about) : true,
          rowCount: rows.length,
          rowLinksToShow: rows.filter((r) => (r.matches('a') ? [r.getAttribute('href')] : hrefs(r)).some((h) => h.includes(g.showSlug))).length,
          placeholderMarkers: g.placeholderMarkers.reduce((n, s) => n + q(s).length, 0),
          placeholderRowsAsLinks: rows.filter((r) => r.querySelector('[data-placeholder-marker]') && (r.matches('a') || r.querySelector('a'))).length,
          bodyText: document.body.innerText,
          mainText: main.innerText,
          hasList: !!list,
          hasControls: !!controls,
          monthH2: list ? Array.from(list.querySelectorAll('h2')).map((e) => e.textContent.trim()) : [],
          icsLinks: q('a[href="/api/events.ics"]').length,
          aboutPresent: !!about,
          societies: about ? hrefs(about).filter((h) => h === '/societies' || h.endsWith('/societies')).length : 0,
          aboutBadge: about ? !!about.querySelector('[data-confirmation-badge]') : false,
          targets: tall([...(list ? Array.from(list.querySelectorAll('a')) : []), ...(controls ? Array.from(controls.querySelectorAll('button, select')) : []), ...(about ? Array.from(about.querySelectorAll('a, button')) : [])]),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, G);
      checks += 1;
      // E1
      if (f.h1.length !== 1 || f.h1[0] !== 'Events') fail(`${at('/events')}: want one h1 "Events", got ${JSON.stringify(f.h1)} (E1)`);
      if (f.bandCtas.length !== 3) fail(`${at('/events')}: ShowBand has ${f.bandCtas.length} CTAs, want 3 (E1)`);
      else if (!f.bandCtas.find((c) => c.k === 'secondary')?.href?.endsWith(`/events/${G.showSlug}`)) fail(`${at('/events')}: band "Show details" must go to /events/${G.showSlug}, got ${f.bandCtas.find((c) => c.k === 'secondary')?.href} (E1)`);
      if (!f.bandBeforeList || !f.bandBeforeAbout) fail(`${at('/events')}: the ShowBand must come before the list and the about section (E1)`);
      // E2
      if (f.rowLinksToShow !== 0) fail(`${at('/events')}: the National Show is repeated as a list row (E2)`);
      // E3
      if (mode === 'public') {
        if (f.placeholderMarkers !== 0) fail(`${at('/events')}: ${f.placeholderMarkers} placeholder marker(s) in the public build (E3)`);
        for (const t of G.placeholderText) if (f.bodyText.includes(t)) fail(`${at('/events')}: public page contains ${JSON.stringify(t)} (E3)`);
      } else {
        if (f.placeholderRowsAsLinks !== 0) fail(`${at('/events')}: ${f.placeholderRowsAsLinks} placeholder row(s) are links (E3)`);
      }
      // E4 / E5
      if (f.rowCount === 0) {
        if (f.hasList) fail(`${at('/events')}: zero rows but [data-events-list] is rendered (E4)`);
        if (f.hasControls) fail(`${at('/events')}: zero rows but controls are rendered (E4/E5)`);
      } else {
        if (!f.hasList) fail(`${at('/events')}: ${f.rowCount} rows without [data-events-list] (E4)`);
        if (f.monthH2.length === 0) fail(`${at('/events')}: rows without a month h2 (E4)`);
      }
      if (f.bodyText.includes('No upcoming events')) fail(`${at('/events')}: the "No upcoming events" sentence is rendered (E4)`);
      if (f.hasControls !== f.rowCount >= 6) fail(`${at('/events')}: ${f.rowCount} rows, controls rendered=${f.hasControls}; want controls iff >= 6 (E5)`);
      // E6
      if (f.icsLinks !== 0) fail(`${at('/events')}: a calendar-subscribe link is rendered while the label is a COPY GAP (E6)`);
      if (/subscribe/i.test(f.mainText)) fail(`${at('/events')}: the word "Subscribe" appears in main (E6)`);
      // E7
      if (!f.aboutPresent) fail(`${at('/events')}: no [data-events-about] section (E7)`);
      else {
        if (f.societies < 1) fail(`${at('/events')}: no "Find your society" link to /societies in the about section (E7)`);
        if (mode === 'public' && f.aboutBadge) fail(`${at('/events')}: an awaiting-copy marker reached the public build (E7)`);
        if (mode === 'preview' && !f.aboutBadge) fail(`${at('/events')}: preview shows no awaiting-copy marker while eventsPage.intro is empty (E7)`);
      }
      // E8
      for (const t of f.targets) if (t.h < G.minTarget) fail(`${at('/events')}: target "${t.t}" is ${t.h}px tall, want >= ${G.minTarget} (E8)`);
      if (f.overflow > 0) fail(`${at('/events')}: horizontal overflow ${f.overflow}px (E8)`);
      if (f.outline.some((o) => /^h[34]:/.test(o))) fail(`${at('/events')}: heading outline has h3/h4 (E8): ${f.outline.join(' | ')}`);
      if (width === G.widths[0]) console.log(`${mode} heading list: ${f.outline.join(' | ')}`);
      await ctx.close();
    }
    // E9 home (once per mode, desktop)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: srv.headers ?? {} });
    const page = await ctx.newPage();
    const res = await page.goto(`${srv.origin}/`, { waitUntil: 'networkidle' });
    checks += 1;
    if (!res || res.status() !== 200) fail(`${mode} /: not 200 (E9)`);
    else {
      const h = await page.evaluate((g) => ({ body: document.body.innerText, strip: document.querySelector(g.homeStrip)?.innerText ?? null }), G);
      if (h.strip === null) fail(`${mode} /: no ${G.homeStrip} (E9)`);
      else {
        if (!h.strip.includes(G.showTitle)) fail(`${mode} /: the "What's on" strip does not list ${G.showTitle} (E9)`);
        if (h.strip.includes(G.homeZeroText)) fail(`${mode} /: the strip says "${G.homeZeroText}" (E9)`);
      }
      if (mode === 'public') for (const t of G.placeholderText) if (h.body.includes(t)) fail(`public /: contains ${JSON.stringify(t)} (E9)`);
    }
    await ctx.close();
  } finally {
    await browser.close();
    await srv.stop();
  }
}
finish('rendered.mjs', failures, `rendered checks green (${checks} page measurements, public + preview, ${G.widths.join('/')}).`);
