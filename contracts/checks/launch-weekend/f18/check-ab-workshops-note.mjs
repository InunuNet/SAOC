#!/usr/bin/env node
// F18-A38 (F18b, lead ruling 2026-10-17): /national-show/workshops keeps its sessions disclosure until F18c ships #sessions.
//  while no #sessions section exists: the existing SESSIONS_NOTE string (goldens/f18b/v13-copy.json strings.workshopsNote, from main 3f45db11) renders exactly once in a role="note" element,
//     after the hero and before the first ticket card; the page offers no per-session purchase (no card with a session slot and a Buy ticket CTA)
//  once #sessions exists (F18c): the note is gone
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-ab-workshops-note.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, flat } from './_lib.mjs';

const NOTE = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-copy.json', 'utf8')).strings.workshopsNote;
const ROUTE = '/national-show/workshops';

function measure(note) {
  const t = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const hits = [...document.querySelectorAll('main [role="note"]')].filter((e) => t(e).replace(/[\u2018\u2019]/g, "'") === note || t(e).includes(note.slice(0, 40)));
  const hero = document.querySelector('[data-nos-hero]');
  const firstCard = document.querySelector('[data-ticket-card]');
  const follows = (x, y) => !!(x && y && (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING));
  return {
    sessions: !!document.getElementById('sessions'),
    notes: hits.map(t),
    afterHero: hits[0] ? follows(hero, hits[0]) : null,
    beforeCard: hits[0] && firstCard ? follows(hits[0], firstCard) : null,
    sessionBuy: [...document.querySelectorAll('[data-ticket-card][data-session], [data-session-card]')].filter((c) => c.querySelector('[data-ticket-cta]')).length,
  };
}

await main('F18-A38 workshops sessions note', async (r) => {
  await withBrowser(async (browser) => {
    for (const [name, w, h] of [['1280', 1280, 900], ['390', 390, 844]]) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: h }, ROUTE, { waitUntil: 'domcontentloaded' });
      const tag = `${ROUTE} @${name}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure, NOTE);
      if (m.sessions) {
        if (m.notes.length) r.fail(`${tag}: #sessions exists (F18c) but the "sessions are not yet bookable" note still renders`);
      } else {
        if (m.notes.length !== 1) r.fail(`${tag}: ${m.notes.length} sessions note(s), want exactly 1 until #sessions ships`);
        else {
          if (flat(m.notes[0]) !== flat(NOTE)) r.fail(`${tag}: the note reads "${m.notes[0].slice(0, 60)}...", want the existing SESSIONS_NOTE verbatim`);
          if (!m.afterHero) r.fail(`${tag}: the note is not after the hero`);
          if (m.beforeCard === false) r.fail(`${tag}: the note is after the first ticket card, want it before`);
        }
        if (m.sessionBuy) r.fail(`${tag}: ${m.sessionBuy} session card(s) offer a Buy ticket CTA before per-session bookings exist`);
      }
      await ctx.close();
    }
  });
});
