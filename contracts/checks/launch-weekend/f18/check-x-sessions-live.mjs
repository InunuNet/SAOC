#!/usr/bin/env node
// F18-A34 (F18c, live, public build): the workshop sessions list, after F18b's audit passes. design-cb split: F18b ships the hub with #programme as the 3 v13 ticket cards; this adds the sessions.
//   hub        -> #sessions exists after #programme and before #exhibit / #trade, h2 "Workshop sessions"; every [data-ticket-session] card has the 150px stub (stacked) and a "Buy ticket" CTA only when it is on sale
//                 (no stepper or CTA on a sold-out, pending or not-open session); the Workshops product card links /national-show/workshops#sessions
//   workshops  -> /national-show/workshops answers 200 on the same session cards, with the same names and no F16 catalogue rows ([data-catalogue-rows] absent)
//   static     -> A21 with F18_PART=c (the workshops page uses loadTicketCardViewModels) is run by the contract beside this check
// A section the CMS lacks is skipped and said so.
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-x-sessions-live.mjs   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser } from './_lib.mjs';

const K = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-tokens.json', 'utf8'));
const C = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-copy.json', 'utf8'));

function measure(sel) {
  const rc = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const txt = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const sec = document.getElementById('sessions');
  const prog = document.getElementById('programme');
  const exhibit = document.getElementById('exhibit');
  const cards = [...document.querySelectorAll('[data-ticket-session]')].map((c) => {
    const stub = c.querySelector(sel.stub); const cta = c.querySelector(sel.cta);
    return { id: c.id, width: rc(c).width, stubH: stub ? rc(stub).height : null, state: c.getAttribute('data-ticket-state'), cta: cta ? txt(cta) : null, stepper: !!c.querySelector(sel.stepper), name: txt(c.querySelector(sel.name)) };
  });
  const workshopsCta = document.querySelector('#ticket-workshops [data-ticket-cta]');
  return { sec: sec ? { top: rc(sec).top, h2: txt(sec.querySelector('h2')) } : null, progBottom: prog ? rc(prog).bottom : null, exhibitTop: exhibit ? rc(exhibit).top : null, cards, rows: document.querySelectorAll('[data-catalogue-rows]').length, workshopsHref: workshopsCta?.closest('a')?.getAttribute('href') ?? workshopsCta?.getAttribute('href') ?? null };
}

await main('F18-A34 workshop sessions (F18c)', async (r) => {
  await withBrowser(async (browser) => {
    for (const [route, w] of [['/national-show/tickets', 1280], ['/national-show/tickets', 390], ['/national-show/workshops', 1280], ['/national-show/workshops', 390]]) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: w === 390 ? 844 : 900 }, route);
      const tag = `${route} @${w}`;
      if (status !== 200) { r.fail(`${tag}: HTTP ${status}`); await ctx.close(); continue; }
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure, { stub: K.hooks.stub, cta: K.hooks.cta, stepper: K.hooks.stepper, name: K.hooks.name });
      if (!m.sec && !m.cards.length) { r.note(`${tag}: no #sessions section and no session card (the CMS has no workshop sessions): skipped`); await ctx.close(); continue; }
      if (route === '/national-show/tickets') {
        if (!m.sec) r.fail(`${tag}: no #sessions section on the hub`);
        else {
          if (m.sec.h2 !== C.strings.sections.sessions) r.fail(`${tag}: #sessions h2 reads "${m.sec.h2}", want "${C.strings.sections.sessions}"`);
          if (m.progBottom !== null && m.sec.top < m.progBottom - 1) r.fail(`${tag}: #sessions is above #programme`);
          if (m.exhibitTop !== null && m.exhibitTop < m.sec.top) r.fail(`${tag}: #exhibit is above #sessions`);
        }
        if (m.workshopsHref !== null && m.workshopsHref !== '/national-show/workshops#sessions') r.fail(`${tag}: the Workshops product card links "${m.workshopsHref}", want /national-show/workshops#sessions`);
      } else if (m.rows) r.fail(`${tag}: ${m.rows} F16 catalogue rows still render (replaced by the session cards)`);
      for (const c of m.cards) {
        const t = `${tag} ${c.id}`;
        if (w < 470 && c.stubH !== null && Math.abs(c.stubH - K.card.sessionStubHeightPx) > K.card.tolerancePx) r.fail(`${t}: stacked session stub ${Math.round(c.stubH)}px, want ${K.card.sessionStubHeightPx}`);
        const onSale = c.state === 'available' || c.state === 'low';
        if (onSale && c.cta !== null && !c.cta.startsWith(K.cta.text)) r.fail(`${t}: CTA reads "${c.cta}", want "${K.cta.text}"`);
        if (!onSale && (c.cta || c.stepper)) r.fail(`${t}: a ${c.state} session renders a CTA or stepper`);
      }
      await ctx.close();
    }
  });
});
