#!/usr/bin/env node
// F18-A29 (F18b, v13 live): /national-show/tickets on a public build at 390, 701, 960, 1280 and 1920 against goldens/f18b/v13-tokens.json, v13-copy.json and v13-photo-map.json.
//   fan        -> [data-nos-ticket-fan] holds the 4 hero tickets as [data-fan-link] anchors to existing #ticket-<id> cards; from 701 up they sit on one arc inside the viewport; below 700 a 2-column deck whose cells keep
//                 their reserved height between first paint and full load (CLS); clicking a fan link scrolls to the card and focuses its name
//   sections   -> #thursday, #passes, #programme in that order with the v13 h2 texts (a section whose products are absent from the CMS is skipped and said so); "Before you visit" nav with the 4 links; the
//                 existing #exhibit and #trade option groups still render
//   cards      -> per card: id ticket-<id>, stub 168px (150 on session cards) with a 50px band when stacked, stub moved to the right and >=300px wide when the card is >=470px; numeral Fraunces 300 58px, name 29px,
//                 price 46px; CTA 50px, stepper buttons >=44px, day cells >=58px; the CTA reads "Buy ticket" (Workshops product card: "Choose a session"); never Register / Add to booking / waitlist / Proposed
//   pool       -> banner [data-pool-banner] only when real; its bracket shows from 960 up and not below
//   R7         -> none of the v13 sample numbers or sample notes appear in the HTML or the DOM
//   photos     -> images inside [data-ticket-stub] are only the product's file from v13-photo-map.json, alt empty; Symposium and WOSA stubs carry no photo
//   buy        -> choosing quantity 2 and pressing the CTA of the first buyable card goes to /tickets/<slug>?quantity=2 (&day=<iso> for the Day Pass)
// Usage: NOS_REUSE_SERVER=1 NOS_BASE=http://localhost:3672 node --import tsx/esm contracts/checks/launch-weekend/f18/check-t-hub-live.mjs
import { readFileSync } from 'node:fs';
import { main, openPage, withBrowser, T as _T, fetchHtml, readGolden } from './_lib.mjs';

const D = '.agent/memory/project/specs/launch-weekend/goldens/f18b';
const K = JSON.parse(readFileSync(`${D}/v13-tokens.json`, 'utf8'));
const C = JSON.parse(readFileSync(`${D}/v13-copy.json`, 'utf8'));
const P = JSON.parse(readFileSync(`${D}/v13-photo-map.json`, 'utf8'));
const H = K.hooks;
const ROUTE = '/national-show/tickets';
void _T; void readGolden;

function measure(a) {
  const q = (s, r = document) => r.querySelector(s);
  const rc = (e) => { const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top + scrollY, bottom: b.bottom + scrollY, width: b.width, height: b.height }; };
  const fan = q(a.fan);
  const links = fan ? [...fan.querySelectorAll(a.fanLink)] : [];
  const cards = [...document.querySelectorAll(a.card)].map((c) => {
    const stub = q(a.stub, c); const body = q(a.body, c);
    const num = q(a.numeral, c); const name = q(a.name, c); const price = q(a.price, c); const cta = q(a.cta, c);
    const cs = (e) => (e ? getComputedStyle(e) : null);
    return {
      id: c.id, session: c.hasAttribute('data-ticket-session'), width: rc(c).width,
      stub: stub ? rc(stub) : null, body: body ? rc(body) : null,
      band: stub ? [...stub.children].map((x) => rc(x).height) : [],
      numeral: num ? { px: parseFloat(cs(num).fontSize), w: cs(num).fontWeight, fam: cs(num).fontFamily } : null,
      name: name ? { px: parseFloat(cs(name).fontSize), w: cs(name).fontWeight } : null,
      price: price ? { px: parseFloat(cs(price).fontSize) } : null,
      cta: cta ? { h: rc(cta).height, text: (cta.textContent ?? '').replace(/\s+/g, ' ').trim() } : null,
      steppers: [...c.querySelectorAll(`${a.stepper} button`)].map((b) => rc(b)),
      days: [...c.querySelectorAll(a.dayCell)].map((x) => rc(x).height),
      stubImgs: stub ? [...stub.querySelectorAll('img')].map((i) => ({ src: i.currentSrc || i.getAttribute('src') || '', alt: i.getAttribute('alt') })).filter((i) => !/disa|emblem/i.test(i.src)) : [],
    };
  });
  const pool = q(a.poolBanner);
  const bracket = q(a.poolBracket);
  const sections = ['thursday', 'passes', 'programme'].map((id) => { const s = document.getElementById(id); return s ? { id, top: rc(s).top, h2: (q('h2', s)?.textContent ?? '').replace(/\s+/g, ' ').trim() } : null; });
  const visit = [...document.querySelectorAll('nav')].find((n) => (n.getAttribute('aria-label') ?? '') === 'Before you visit' || (document.getElementById(n.getAttribute('aria-labelledby') ?? '')?.textContent ?? '').trim() === 'Before you visit');
  return {
    vw: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: (q('main h1')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    fan: fan ? { grid: getComputedStyle(fan).display, cols: getComputedStyle(fan).gridTemplateColumns.split(' ').length, links: links.map((l) => ({ href: l.getAttribute('href'), rect: rc(l), label: l.getAttribute('aria-label') })) } : null,
    cards, sections,
    pool: pool ? { h: rc(pool).height, num: parseFloat(getComputedStyle(q('[aria-hidden="true"]', pool) ?? pool).fontSize) } : null,
    bracket: bracket ? { shown: getComputedStyle(bracket).display !== 'none' && rc(bracket).height > 0 } : null,
    visit: visit ? [...visit.querySelectorAll('a')].map((x) => x.getAttribute('href')) : null,
    groups: K.keptGroups.map((g) => !!document.getElementById(g)),
    text: document.body.innerText,
  };
}

await main('F18-A29 v13 tickets hub', async (r) => {
  const { status, html } = await fetchHtml(ROUTE);
  if (status !== 200) { r.fail(`${ROUTE}: HTTP ${status}`); return; }
  for (const s of K.sampleNumbersBanned) if (html.includes(s)) r.fail(`R7: the sample string "${s}" is in the HTML`);
  const stubFiles = new Set(Object.values(P.stubPhotos).filter(Boolean).map((f) => f.split('/').pop().replace('.jpg', '')));
  await withBrowser(async (browser) => {
    for (const w of K.viewports) {
      const h = w <= 700 ? 844 : 900;
      const { ctx, page, status: st } = await openPage(browser, { width: w, height: h }, ROUTE, { waitUntil: 'domcontentloaded' });
      if (st !== 200) { r.fail(`${ROUTE} @${w}: HTTP ${st}`); await ctx.close(); continue; }
      const early = await page.evaluate(() => [...document.querySelectorAll('[data-nos-ticket-fan] [data-fan-link]')].map((l) => l.getBoundingClientRect().height));
      await page.waitForLoadState('networkidle');
      const m = await page.evaluate(measure, H);
      const tag = `${ROUTE} @${w}`;
      if (m.overflow > 1) r.fail(`${tag}: horizontal overflow ${m.overflow}px`);
      if (m.h1 !== 'Tickets') r.fail(`${tag}: h1 is "${m.h1}", want "Tickets"`);
      if (!m.fan) r.fail(`${tag}: no ${H.fan}`);
      else {
        if (m.fan.links.length < 1 || m.fan.links.length > K.fan.count) r.fail(`${tag}: ${m.fan.links.length} fan links, want 1-${K.fan.count}`);
        for (const l of m.fan.links) {
          const id = (l.href ?? '').slice(1);
          if (!K.anchors.includes(id) || !m.cards.some((c) => c.id === id)) r.fail(`${tag}: fan link ${l.href} has no matching card id`);
          if (l.rect.left < -1 || l.rect.right > m.vw + 1) r.fail(`${tag}: fan link ${l.href} leaves the viewport (${Math.round(l.rect.left)}..${Math.round(l.rect.right)} of ${m.vw})`);
          if (!l.label || !/, (R\d+|price to follow|sold out)$/.test(l.label)) r.fail(`${tag}: fan link label "${l.label}" is not "<name>, R<price> | price to follow | sold out"`);
        }
        if (w < K.fan.deckBelowPx + 1 && w <= 700) {
          if (m.fan.cols !== K.fan.deckColumns) r.fail(`${tag}: the fan deck has ${m.fan.cols} columns, want ${K.fan.deckColumns}`);
          const need = w <= 419 ? K.fan.reservedCellMinPx['419'] : w <= 560 ? K.fan.reservedCellMinPx['560'] : K.fan.reservedCellMinPx['700'];
          for (const hh of early) if (hh < need - 1) r.fail(`${tag}: a fan cell is ${Math.round(hh)}px before images load, want the reserved ${need}px (CLS)`);
          const late = m.fan.links.map((l) => l.rect.height);
          early.forEach((hh, i) => { if (late[i] !== undefined && Math.abs(late[i] - hh) > 1) r.fail(`${tag}: fan cell ${i + 1} changes height after load (${Math.round(hh)} -> ${Math.round(late[i])}): layout shift`); });
        }
      }
      const tops = m.sections.filter(Boolean);
      for (let i = 1; i < tops.length; i += 1) if (tops[i].top < tops[i - 1].top) r.fail(`${tag}: section ${tops[i].id} is above ${tops[i - 1].id}`);
      for (const s of tops) { const want = C.strings.sections[s.id]; if (s.h2 !== want) r.fail(`${tag}: #${s.id} h2 reads "${s.h2}", want "${want}"`); }
      if (w === K.viewports[0] && m.sections.some((s) => !s)) r.note(`${tag}: a section is absent (its products are not in the CMS): ${m.sections.map((s, i) => (s ? '' : ['thursday', 'passes', 'programme'][i])).filter(Boolean).join(', ')}`);
      if (!m.visit || K.beforeYouVisit.hrefs.some((x) => !m.visit.includes(x))) r.fail(`${tag}: the "Before you visit" nav is missing or lacks ${K.beforeYouVisit.hrefs.join(', ')}`);
      if (m.groups.some((x) => !x)) r.fail(`${tag}: the existing #exhibit / #trade option groups are gone`);
      for (const c of m.cards) {
        const t = `${tag} ${c.id}`;
        if (!K.anchors.includes(c.id) && !c.session) r.fail(`${t}: unexpected card id`);
        const stubH = c.session ? K.card.sessionStubHeightPx : K.card.stubHeightPx;
        const horizontal = c.width >= K.card.horizontalFromContainerPx;
        if (!c.stub || !c.body) { r.fail(`${t}: no stub or body`); continue; }
        if (horizontal) {
          if (!(c.stub.left > c.body.left)) r.fail(`${t}: container ${Math.round(c.width)}px >= ${K.card.horizontalFromContainerPx}: the stub is not on the right`);
          if (c.stub.width < K.card.horizontalStubMinPx - 1) r.fail(`${t}: horizontal stub ${Math.round(c.stub.width)}px, want >= ${K.card.horizontalStubMinPx}`);
        } else {
          if (Math.abs(c.stub.height - stubH) > K.card.tolerancePx) r.fail(`${t}: stacked stub is ${Math.round(c.stub.height)}px, want ${stubH}`);
          if (c.band.length && Math.abs(c.band[c.band.length - 1] - K.card.bandHeightPx) > K.card.tolerancePx) r.fail(`${t}: stub band is ${Math.round(c.band[c.band.length - 1])}px, want ${K.card.bandHeightPx}`);
        }
        if (c.numeral && !c.session) {
          if (Math.abs(c.numeral.px - K.card.numeral.px) > 1 && c.numeral.px) r.fail(`${t}: numeral ${c.numeral.px}px, want ${K.card.numeral.px}`);
          if (String(c.numeral.w) !== String(K.card.numeral.weight) || !/fraunces/i.test(c.numeral.fam)) r.fail(`${t}: numeral is ${c.numeral.w} ${c.numeral.fam}, want Fraunces ${K.card.numeral.weight}`);
        }
        if (c.name && !c.session && Math.abs(c.name.px - K.card.name.px) > 1) r.fail(`${t}: name ${c.name.px}px, want ${K.card.name.px}`);
        if (c.price && Math.abs(c.price.px - K.card.price.px) > 1) r.fail(`${t}: price ${c.price.px}px, want ${K.card.price.px}`);
        if (c.cta) {
          if (Math.abs(c.cta.h - K.card.ctaHeightPx) > 1) r.fail(`${t}: CTA ${Math.round(c.cta.h)}px high, want ${K.card.ctaHeightPx}`);
          const want = c.id === 'ticket-workshops' ? K.cta.workshopsProductCard : K.cta.text;
          if (!c.cta.text.startsWith(want)) r.fail(`${t}: CTA reads "${c.cta.text}", want "${want}"`);
        }
        for (const s of c.steppers) if (s.height < K.card.stepperButtonPx - 1 || s.width < K.card.stepperButtonPx - 1) r.fail(`${t}: stepper button ${Math.round(s.width)}x${Math.round(s.height)}, want >= ${K.card.stepperButtonPx}`);
        for (const d of c.days) if (d < K.card.dayCellMinPx - 1) r.fail(`${t}: day cell ${Math.round(d)}px high, want >= ${K.card.dayCellMinPx}`);
        const own = P.stubPhotos[c.id.replace('ticket-', '')];
        for (const i of c.stubImgs) {
          const file = decodeURIComponent(i.src).match(/orchid-(dark|pink|purple|violet|yellow)/)?.[0];
          if (i.alt !== '') r.fail(`${t}: a stub image has alt "${i.alt}", want ""`);
          if (!file || !stubFiles.has(file)) r.fail(`${t}: stub image ${i.src.slice(-50)} is not one of the approved production photos`);
          else if (!own || !own.includes(file)) r.fail(`${t}: stub photo ${file} is not this product's photo (${own ?? 'none: field colour'})`);
        }
      }
      for (const b of [...K.cta.bannedOnPaid, 'Join the waitlist', 'Proposed']) if (m.text.includes(b)) r.fail(`${tag}: banned wording "${b}" on the page`);
      for (const s of K.sampleNumbersBanned) if (m.text.includes(s)) r.fail(`${tag}: the sample string "${s}" is rendered`);
      if (m.pool) {
        if (w >= K.pool.bracketFromPx && !(m.bracket?.shown)) r.fail(`${tag}: the pool bracket is not shown from ${K.pool.bracketFromPx}px up`);
        if (w < K.pool.bracketFromPx && m.bracket?.shown) r.fail(`${tag}: the pool bracket shows below ${K.pool.bracketFromPx}px`);
      } else if (w === K.viewports[0]) r.note(`${tag}: no early-bird pool banner (no real pool value): R7`);
      if (w === 1280) {
        const link = page.locator(`${H.fan} ${H.fanLink}`).first();
        if (await link.count()) {
          const href = await link.getAttribute('href');
          await link.click();
          await page.waitForTimeout(400);
          const f = await page.evaluate((id) => { const t = document.getElementById(id); return { hash: location.hash, focusInside: !!t && t.contains(document.activeElement), top: t ? t.getBoundingClientRect().top : null }; }, (href ?? '').slice(1));
          if (f.hash !== href) r.fail(`${tag}: the fan link did not set the hash ${href}`);
          if (!f.focusInside) r.fail(`${tag}: focus did not move into the target card's name`);
          if (f.top !== null && (f.top < 0 || f.top > 400)) r.fail(`${tag}: the target card is at y=${Math.round(f.top)} after the jump, want it in view under the header`);
        }
        const cta = page.locator(`${H.card}:not([data-ticket-state="soldOut"]):not([data-ticket-state="pricePending"]):not([data-ticket-state="earlyBirdSoldOut"]) ${H.cta}`).filter({ hasText: K.cta.text }).first();
        if (await cta.count()) {
          const card = cta.locator('xpath=ancestor::*[@data-ticket-card][1]');
          const more = card.locator('button[aria-label="One more"]');
          if (await more.count()) await more.click();
          const dayChecked = await card.locator('input[type="radio"]:checked').getAttribute('value').catch(() => null);
          await Promise.all([page.waitForURL(/\/tickets\//, { timeout: 8000 }).catch(() => null), cta.click()]);
          const u = new URL(page.url());
          if (!u.pathname.startsWith('/tickets/')) r.fail(`${tag}: the Buy ticket CTA did not go to /tickets/<slug> (went to ${u.pathname})`);
          else if (u.searchParams.get('quantity') !== '2' && dayChecked === null) r.fail(`${tag}: CTA url ${u.pathname}${u.search} does not carry quantity=2`);
          else if (dayChecked !== null && !(u.searchParams.get('day') ?? '').match(/^\d{4}-\d{2}-\d{2}$/)) r.fail(`${tag}: the Day Pass CTA url carries no day=<iso> (${u.search})`);
        } else r.note(`${tag}: no buyable card with a Buy ticket CTA in this environment: CTA navigation skipped`);
      }
      await ctx.close();
    }
  });
});
