#!/usr/bin/env node
// RETIRED by launch-weekend F18 (goldens/f18/supersession.json): replaced by the v13 keepsake ticket checks; no gate runs this file.
// A6: typographic ticket cards (R53 #2). The shared TicketTypeCard has no photograph on /national-show/conferences and /workshops (open sales
// render the cards) and /tickets/<slug>; names are the R35 card-title role (Fraunces 400, 22px), the price figure is the hub price clamp,
// descriptions 16px (R65). /tickets/<slug> is an SAOC-chrome page (R62, out of scope): its hero photo stays, only the card is judged there. Statically: no next/image, no lib/tickets-orchid-image, the orphaned map is deleted, and the F3 imagery golden
// no longer exempts ticket-card photos (ticketCardPhotos.exempt === false) - check-f3-imagery.mjs (A12) then enforces it.
// Usage: node --import tsx/esm contracts/checks/launch-weekend/f16/check-f-cards.mjs
import { existsSync, readFileSync } from 'node:fs';
import { VIEWPORTS, launch, newPage, openPath, loadGolden, readCms, report } from './_lib.mjs';

const T = loadGolden('tokens.json').card;
const problems = [];
const card = readFileSync('components/tickets/TicketTypeCard.tsx', 'utf8').replace(/\/\/.*$/gm, '');
if (/next\/image|<Image\b/.test(card)) problems.push('TicketTypeCard still renders next/image');
if (/tickets-orchid-image|getOrchidImageForTicketType/.test(card)) problems.push('TicketTypeCard still reads the orchid photo map');
if (existsSync('lib/tickets-orchid-image.ts')) problems.push('lib/tickets-orchid-image.ts is orphaned and must be deleted');
const map = JSON.parse(readFileSync('.agent/memory/project/specs/nos-own-brand-chrome/goldens/f3/hero-photo-map.json', 'utf8'));
if (map.ticketCardPhotos?.exempt !== false) problems.push('hero-photo-map.json ticketCardPhotos.exempt must be false');

const cms = await readCms();
const browser = await launch();
if (cms.salesOpen) {
  for (const route of ['/national-show/conferences', '/national-show/workshops', '/tickets/day-visitor']) {
    for (const vp of [VIEWPORTS[1], VIEWPORTS[0]]) {
      const { ctx, page } = await newPage(browser, vp);
      await openPath(page, route);
      const tag = `${route} @${vp.name}`;
      const nos = route.startsWith('/national-show');
      const m = await page.evaluate((nos) => {
        const form = document.querySelector('[data-nos-ticket-form]');
        if (!form) return null;
        const imgs = form.querySelectorAll('img, picture, svg[role="img"]').length + (nos ? document.querySelectorAll('main img').length : 0);
        const c = form.querySelector('fieldset > div');
        const p = c && [...c.querySelectorAll('p')];
        const fs = (e) => e && getComputedStyle(e);
        return { imgs, h: c?.getBoundingClientRect().height, nameFam: fs(p?.[0])?.fontFamily, nameSize: parseFloat(fs(p?.[0])?.fontSize), nameWeight: Number(fs(p?.[0])?.fontWeight), priceSize: parseFloat(fs(p?.[1])?.fontSize), descSize: parseFloat(fs(p?.[2])?.fontSize) };
      }, nos);
      if (!m) { problems.push(`${tag}: no purchase form while sales are open`); await ctx.close(); continue; }
      if (m.imgs) problems.push(`${tag}: ${m.imgs} image(s) on the ticket cards`);
      if ((nos && !/fraunces/i.test(m.nameFam)) || m.nameWeight !== 400 || Math.abs(m.nameSize - T.nameSizePx) > 0.6) problems.push(`${tag}: card name is ${m.nameWeight} ${m.nameSize}px ${m.nameFam}, want ${nos ? 'Fraunces ' : ''}400 ${T.nameSizePx}px (the /tickets/<slug> page keeps its SAOC serif)`);
      if (m.priceSize < T.priceMinPx - 0.5) problems.push(`${tag}: card price is ${m.priceSize}px, want >=${T.priceMinPx}`);
      if (Math.abs(m.descSize - T.descPx) > 0.5) problems.push(`${tag}: description is ${m.descSize}px, want ${T.descPx} (R65)`);
      if (vp.name === '1280' && m.h > T.maxFirstCardHeight1280) problems.push(`${tag}: first card is ${m.h.toFixed(0)}px tall, want <=${T.maxFirstCardHeight1280} (no photo band)`);
      await ctx.close();
    }
  }
}
await browser.close();
report(problems, `no photograph on any ticket card, card type roles met, photo exemption flipped${cms.salesOpen ? '' : ' (sales closed: runtime card branch skipped, static proof only)'}`);
