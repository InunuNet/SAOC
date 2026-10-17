#!/usr/bin/env node
// F18-A31 (F18b, R30, R54, R59, live, public build): the links and the two R30 hub items that read the same ticket data.
//   R30 (1)   hub hero: [data-day-pass-from] sits AFTER the hero CTA row, reads "<the Day card's CMS name, trailing parenthetical dropped> from R<amount>" (zero-cent form; one name per product, design-cb P2-1; was the literal "Day Pass from"), and its amount equals the price on the #ticket-day card (the effective price:
//             the early-bird SKU while the pool lasts, never an expired early bird); it is ABSENT when the Day Pass card has no price (pricePending) or does not exist (R7).
//   R30 (2)   RETIRED (design-cb final ruling): the hub has NO closing band, [data-nos-ticket-close] must be absent and nothing but the Explore index follows the last ticket section. Former text: [data-nos-ticket-close] is the last band before the footer (the #exhibit / #trade option groups may precede it), holds a Tickets link to #passes whose label is the nav-config
//             "Tickets" label, and adds no new sentence beyond existing labels.
//   R54       /national-show/conferences: each of the symposium and WOSA ticket cards carries a link to /national-show/symposium and /national-show/wosa-conference; the "SAOC/WOSA Joint" clause is gone, or the
//             original lede sentence stays verbatim (it is on Lee-Ann's list).
//   R59       /national-show/wosa-conference: a link with the text "Buy ticket" to /national-show/tickets#ticket-wosa or /national-show/conferences#ticket-wosa, on the page whether it holds or not; the anchor
//             MUST exist on the destination (id="ticket-wosa"): a dead anchor fails (design-cb, F18b A29 asserts the same id on the hub).
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-v-links-from.mjs   (cwd = implementation worktree)
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, fetchHtml, norm } from './_lib.mjs';

const K = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-tokens.json', 'utf8'));
const C = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f18b/v13-copy.json', 'utf8'));
const L = K.links;
const PRICE = /^R\d+(\.\d{2})?$/;
const CONF_LEDE = C.strings.conferencesLede;

await main('F18-A31 R30, R54, R59 links and hub items', async (r) => {
  await withBrowser(async (browser) => {
    for (const w of [1280, 390]) {
      const { ctx, page, status } = await openPage(browser, { width: w, height: w === 390 ? 844 : 800 }, '/national-show/tickets');
      if (status !== 200) { r.fail(`hub @${w}: HTTP ${status}`); await ctx.close(); continue; }
      const m = await page.evaluate((a) => {
        const txt = (e) => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
        const hero = document.querySelector('[data-nos-hero]');
        const from = document.querySelector(a.from);
        const heroCta = hero ? [...hero.querySelectorAll('a')].filter((x) => /ticket/i.test(txt(x))) : [];
        const lastCta = heroCta[heroCta.length - 1];
        const dayCard = document.querySelector('#ticket-day');
        const dayPrice = dayCard?.querySelector('[data-ticket-price]');
        const dayName = dayCard?.querySelector('[data-ticket-name]');
        const close = document.querySelector(a.close);
        // design-cb final ruling: v13 has no closing band on /national-show/tickets (masthead, thursday, passes, programme, sessions), and a band here would link the page to itself
        // the last of these ids IN DOM ORDER (not array order): the compact #exhibit / #trade row follows #programme and must stay a <section> (F3-C2 rhythm)
        const lastContent = ['exhibit', 'trade', 'sessions', 'programme'].map((id) => document.getElementById(id)).filter(Boolean).sort((x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).pop();
        const bands = [...document.querySelectorAll('main section, main > div > section')];
        const bandAfter = lastContent ? bands.filter((s) => !s.contains(lastContent) && s !== lastContent && (lastContent.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)).map((s) => s.id || s.className.toString().slice(0, 40)) : [];
        return {
          from: from ? { text: txt(from), afterCta: lastCta ? !!(lastCta.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) : null, inHero: !!hero?.contains(from) || !!from.closest('[data-nos-masthead]') } : null,
          dayName: dayName ? txt(dayName) : null, dayState: dayCard?.getAttribute('data-ticket-state') ?? null, dayPrice: dayPrice ? txt(dayPrice) : null,
          close: !!close, bandAfter,
        };
      }, { from: L.dayPassFrom.selector, close: L.closeBand.selector });
      const tag = `hub @${w}`;
      const wantNone = !m.dayPrice || m.dayState === 'pricePending';
      if (wantNone && m.from) r.fail(`${tag}: "Day Pass from" renders though the Day Pass has no price (R7)`);
      if (!wantNone) {
        if (!m.from) r.fail(`${tag}: no ${L.dayPassFrom.selector} line under the hub CTAs though the Day Pass costs ${m.dayPrice}`);
        else {
          // design-cb P2-1 (one name per product): the line reads the SAME CMS name field as the Day card, with the fan's faceName rule (trailing parenthetical dropped)
          const faceName = (n) => (n ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
          if (!m.dayName) r.fail(`${tag}: the #ticket-day card has no [data-ticket-name]`);
          const want = `${faceName(m.dayName)} ${C.strings.dayPassFrom} ${m.dayPrice}`;
          if (norm(m.from.text) !== norm(want)) r.fail(`${tag}: line reads "${m.from.text}", want "${want}" (the Day card's CMS name, then from, then the effective price on the #ticket-day card)`);
          if (!PRICE.test(m.dayPrice)) r.fail(`${tag}: Day Pass price "${m.dayPrice}" is not in zero-cent R form`);
          if (m.from.afterCta === false) r.fail(`${tag}: the line sits before the hero Tickets CTA, it must sit under it`);
          if (!m.from.inHero) r.fail(`${tag}: the line is not inside the hub hero`);
        }
      }
      if (m.close) r.fail(`${tag}: a ${L.closeBand.selector} closing band renders; v13 has none on /national-show/tickets and it would link the page to itself (design-cb final ruling)`);
      if (m.bandAfter.length) r.fail(`${tag}: band(s) after the last ticket section: ${m.bandAfter.join(', ')} (the Explore index nav is the only block after it)`);
      await ctx.close();
    }
  });

  const conf = await fetchHtml('/national-show/conferences');
  if (conf.status !== 200) r.fail(`/national-show/conferences: HTTP ${conf.status}`);
  else {
    for (const [slug, href] of Object.entries(L.conferenceLinks)) {
      const card = new RegExp(`id="ticket-${slug}"[\\s\\S]*?</article>`).exec(conf.html);
      if (!card) { r.note(`/national-show/conferences: no #ticket-${slug} card in the CMS, link not probed`); continue; }
      if (!card[0].includes(`href="${href}"`)) r.fail(`/national-show/conferences: the ${slug} card has no link to ${href} (R54)`);
    }
    const flat = norm(conf.html.replace(/<[^>]+>/g, ' '));
    if (/Joint/.test(flat)) r.fail('/national-show/conferences: a "Joint" track fragment renders but no combined track exists (design-cb rotation ruling 1; F18-A37 owns the lede)');
    if (!flat.includes(norm(CONF_LEDE))) r.fail(`/national-show/conferences: the lede "${CONF_LEDE}" is missing`);
  }

  const wosa = await fetchHtml('/national-show/wosa-conference');
  if (wosa.status !== 200) r.fail(`/national-show/wosa-conference: HTTP ${wosa.status}`);
  else {
    const links = [...wosa.html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: norm(m[2].replace(/<[^>]+>/g, ' ')) }));
    const buy = links.find((l) => l.text === C.strings.buy && L.wosaBuy.hrefs.includes(l.href));
    if (!buy) r.fail(`/national-show/wosa-conference: no "${C.strings.buy}" link to ${L.wosaBuy.hrefs.join(' or ')} (R59)`);
    else {
      const dest = await fetchHtml(buy.href.split('#')[0]);
      if (buy.href.includes('#ticket-wosa') && (dest.status !== 200 || /id="ticket-wosa"/.test(dest.html) === false)) r.fail(`${buy.href}: the Buy ticket link points at a dead anchor (destination HTTP ${dest.status} renders no id="ticket-wosa")`);
    }
  }
});
