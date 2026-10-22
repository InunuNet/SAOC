// nos-ticket-day-stub (r45) F1 rendered (fresh PUBLIC and PREVIEW production builds on live Sanity, next start 3010-3019 minus 3002, 3013
// and 3016). QA input, hash-locked. Golden: goldens/f1-edits.json. Both modes, 1280 and 390, /national-show/tickets and the Day Pass
// checkout it links to. Expected day stubs are computed from each radio's own ISO value (day of month, long weekday), never hard-coded.
//   R1  the fan: the Day Pass mini's stub is the product's own '' / '' (BASE drew "24 / Friday"); VIP, Sunset and Weekend keep theirs.
//   R2  unchosen: the Day Pass card's stub is '' / '', no day radio is checked, the fieldset is not aria-invalid, there is no alert, and
//       Buy is a live link (href, not disabled or aria-disabled) whose href names no day.
//   R3  error (Buy clicked, and again Buy by keyboard Enter, with no day): the page does not navigate; the fieldset is aria-invalid="true";
//       it holds exactly one role="alert" <p> reading the picker's own legend "Choose a day" with the golden class (TicketFormField's
//       pattern), 6px below the day row; focus is on the first enabled day radio, unchecked; the stub is still '' / ''; axe finds no
//       violation in the card.
//   R4  chosen (the second enabled day clicked): the stub shows that day's numeral and weekday, the alert is gone, aria-invalid is
//       "false", Buy's href carries day=<iso>; following it lands on /tickets/<slug>?quantity=1&day=<iso> (200) where the summary stub and
//       the form's checked radio are that day.
//   R5  the single-day and Weekend cards keep their fixed stubs, and the Weekend Pass Buy still navigates to its own checkout.
//   R6  no horizontal overflow. Element screenshots of the unchosen, error and chosen states land in <checkout>/.tmp/tds-shots/.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { MODES, authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f1-rendered.mjs';
const G = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const HUB = G.routes.hub;
const ERROR_GAP = 6;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOTS = path.join(repoRoot, '.tmp', 'tds-shots');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let checks = 0;

const stubOf = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return [String(d.getUTCDate()), WEEKDAYS[d.getUTCDay()]]; };
const near = (a, b) => Math.abs(a - b) <= 1;

const state = (page) => page.evaluate(() => {
  const stub = (el) => (el ? [el.querySelector('[data-ticket-numeral]')?.textContent ?? null, el.querySelector('.nk-numlab')?.textContent ?? null] : null);
  const card = document.querySelector('article#ticket-day');
  const fs = card?.querySelector('fieldset.nk-days') ?? null;
  const row = fs?.querySelector('.nk-days-row') ?? null;
  const alerts = fs ? [...fs.querySelectorAll('[role="alert"]')] : [];
  const a = alerts[0] ?? null;
  const cta = card?.querySelector('[data-ticket-cta]') ?? null;
  const active = document.activeElement;
  const radios = fs ? [...fs.querySelectorAll('input[type="radio"]')] : [];
  return {
    minis: Object.fromEntries([...document.querySelectorAll('[data-fan-link]')].map((l) => [l.getAttribute('href').replace('#ticket-', ''), stub(l)])),
    cards: Object.fromEntries([...document.querySelectorAll('article[data-ticket-card]')].map((c) => [c.id.replace('ticket-', ''), { stub: stub(c), slug: c.dataset.ticketSlug, cta: c.querySelector('[data-ticket-cta]')?.getAttribute('href') ?? null }])),
    day: card ? {
      slug: card.dataset.ticketSlug,
      stub: stub(card),
      legend: fs?.querySelector('legend')?.textContent ?? null,
      invalid: fs ? fs.getAttribute('aria-invalid') : null,
      radios: radios.map((r) => ({ value: r.value, checked: r.checked, disabled: r.disabled })),
      alerts: alerts.map((x) => ({ text: x.textContent, tag: x.tagName, cls: x.getAttribute('class') })),
      alertGap: a && row ? a.getBoundingClientRect().top - row.getBoundingClientRect().bottom : null,
      alertStyle: a ? { bw: getComputedStyle(a).borderTopWidth, bs: getComputedStyle(a).borderTopStyle, fs: getComputedStyle(a).fontSize } : null,
      cta: cta ? { href: cta.getAttribute('href'), tag: cta.tagName, disabled: cta.hasAttribute('disabled'), ariaDisabled: cta.getAttribute('aria-disabled') } : null,
      focus: active && fs && fs.contains(active) && active.matches('input[type="radio"]') ? { value: active.value, checked: active.checked, disabled: active.disabled } : null,
      focusTag: active ? `${active.tagName}${active.id ? `#${active.id}` : ''}` : null,
    } : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

async function axeCard(page) {
  await page.addScriptTag({ path: axeSource() });
  return page.evaluate(async () => {
    const r = await window.axe.run('article#ticket-day', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
}

async function hub(page, srv, at) {
  const r = await page.goto(`${srv.origin}${HUB}`, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return null; }
  await page.evaluate(async () => { await document.fonts.ready; });
  const s = await state(page);
  if (!s.day || !s.day.radios.length) { failures.push(`${at}: no Day Pass card with a day picker (INFRA)`); return null; }
  if (!s.day.cta) { failures.push(`${at}: the Day Pass card has no Buy link, so the states cannot be exercised (INFRA: is it on sale?)`); return null; }
  return s;
}

function expectError(s, at, how) {
  const d = s.day;
  if (d.invalid !== 'true') failures.push(`${at}: after ${how} with no day the fieldset aria-invalid is ${JSON.stringify(d.invalid)}, want "true" (R3)`);
  if (d.alerts.length !== 1) failures.push(`${at}: after ${how} with no day ${d.alerts.length} alerts in the picker, want 1 (R3)`);
  else {
    const a = d.alerts[0];
    if (a.text !== G.copy.chooseDay || a.tag !== 'P' || a.cls !== G.errorClass) failures.push(`${at}: the alert is <${a.tag} class="${a.cls}">${a.text}, want <P class="${G.errorClass}">${G.copy.chooseDay} (R3)`);
    if (d.alertGap === null || !near(d.alertGap, ERROR_GAP)) failures.push(`${at}: the alert sits ${d.alertGap}px below the day row, want ${ERROR_GAP} (R3)`);
    if (!d.alertStyle || d.alertStyle.bw !== '1px' || d.alertStyle.bs !== 'solid' || d.alertStyle.fs !== '14px') failures.push(`${at}: the alert's computed border/font ${JSON.stringify(d.alertStyle)}, want 1px solid / 14px (R3)`);
  }
  if (d.legend !== G.copy.chooseDay) failures.push(`${at}: the picker legend reads ${JSON.stringify(d.legend)}, want "${G.copy.chooseDay}" (R3)`);
  const first = d.radios.find((r) => !r.disabled);
  if (!d.focus || !first || d.focus.value !== first.value || d.focus.checked) failures.push(`${at}: after ${how} focus is on ${d.focus ? `radio ${d.focus.value} checked=${d.focus.checked}` : d.focusTag}, want the first enabled day radio ${first ? first.value : '?'}, unchecked (R3)`);
  if (d.radios.some((r) => r.checked)) failures.push(`${at}: after ${how} a day is checked (R3)`);
  if (d.stub[0] !== '' || d.stub[1] !== '') failures.push(`${at}: after ${how} the stub reads ${JSON.stringify(d.stub)}, want ["",""] (R3)`);
}

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const page = await ctx.newPage();
      const at = `${mode} ${HUB} @${width}`;
      const shot = async (name) => { await page.mouse.move(0, 0); await page.locator('article#ticket-day').screenshot({ path: path.join(SHOTS, `${mode}-${width}-${name}.png`), animations: 'disabled' }); };
      checks += 1;
      let s = await hub(page, srv, at);
      if (!s) { await ctx.close(); continue; }

      // R1
      for (const [id, want] of Object.entries(G.fanStubs)) {
        const got = s.minis[id];
        if (!got) failures.push(`${at}: no fan mini for ${id} (R1)`);
        else if (got[0] !== want[0] || got[1] !== want[1]) failures.push(`${at}: fan mini ${id} stub ${JSON.stringify(got)}, want ${JSON.stringify(want)} (R1)`);
      }

      // R2
      const d0 = s.day;
      if (d0.stub[0] !== '' || d0.stub[1] !== '') failures.push(`${at}: unchosen Day Pass stub ${JSON.stringify(d0.stub)}, want ["",""] (R2)`);
      if (d0.radios.some((r) => r.checked)) failures.push(`${at}: a day is pre-selected: ${d0.radios.filter((r) => r.checked).map((r) => r.value).join(', ')} (R2)`);
      if (d0.invalid === 'true' || d0.alerts.length) failures.push(`${at}: the picker shows an error before Buy (R2)`);
      if (d0.cta.tag !== 'A' || !d0.cta.href || d0.cta.disabled || d0.cta.ariaDisabled === 'true') failures.push(`${at}: Buy is not a live link: ${JSON.stringify(d0.cta)} (R2)`);
      else if (/[?&]day=/.test(d0.cta.href)) failures.push(`${at}: Buy's href names a day with none chosen: ${d0.cta.href} (R2)`);
      await shot('unchosen');

      // R3 (click)
      await page.locator('article#ticket-day [data-ticket-cta]').click();
      await page.waitForTimeout(400);
      if (new URL(page.url()).pathname !== HUB) failures.push(`${at}: Buy with no day navigated to ${page.url()} (R3)`);
      else {
        s = await state(page);
        expectError(s, at, 'a Buy click');
        const v = await axeCard(page);
        if (v.length) failures.push(`${at}: axe in the error state: ${v.join('; ')} (R3)`);
        await shot('error');
      }

      // R3 (keyboard)
      s = await hub(page, srv, at);
      if (s) {
        await page.locator('article#ticket-day [data-ticket-cta]').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        if (new URL(page.url()).pathname !== HUB) failures.push(`${at}: Enter on Buy with no day navigated to ${page.url()} (R3)`);
        else expectError(await state(page), at, 'Enter on Buy');
      }

      // R4 (from a fresh hub)
      s = await hub(page, srv, at);
      if (s) {
        const open = s.day.radios.filter((r) => !r.disabled);
        const pick = open[1] ?? open[0];
        if (!pick) failures.push(`${at}: no enabled day to choose (INFRA)`);
        else {
          await page.locator(`article#ticket-day label[data-ticket-day]:has(input[value="${pick.value}"])`).click();
          await page.waitForTimeout(200);
          s = await state(page);
          const want = stubOf(pick.value);
          const d = s.day;
          if (d.stub[0] !== want[0] || d.stub[1] !== want[1]) failures.push(`${at}: chose ${pick.value}, stub ${JSON.stringify(d.stub)}, want ${JSON.stringify(want)} (R4)`);
          if (!d.radios.find((r) => r.value === pick.value)?.checked) failures.push(`${at}: ${pick.value} is not checked after choosing it (R4)`);
          if (d.alerts.length || d.invalid !== 'false') failures.push(`${at}: after choosing a day alerts=${d.alerts.length} aria-invalid=${d.invalid}, want 0 / "false" (R4)`);
          if (!d.cta || !d.cta.href.includes(`day=${pick.value}`)) failures.push(`${at}: Buy's href ${d.cta ? d.cta.href : null} does not carry day=${pick.value} (R4)`);
          await shot('chosen');
          await page.locator('article#ticket-day [data-ticket-cta]').click();
          await page.waitForURL((u) => u.pathname.startsWith('/tickets/'), { timeout: 20_000 }).catch(() => {});
          // The Link is a client navigation; a reload serves the checkout from the server with the URL's ?day.
          const resp = await page.reload({ waitUntil: 'networkidle' });
          const u = new URL(page.url());
          if (u.pathname !== `/tickets/${d.slug}` || u.searchParams.get('day') !== pick.value || u.searchParams.get('quantity') !== '1') failures.push(`${at}: Buy led to ${page.url()}, want /tickets/${d.slug}?quantity=1&day=${pick.value} (R4)`);
          else if (!resp || resp.status() !== 200) failures.push(`${at}: checkout HTTP ${resp ? resp.status() : 0} (R4)`);
          else {
            const c = await page.evaluate(() => {
              const sum = document.querySelector('article[data-ticket-variant="summary"]');
              return { stub: sum ? [sum.querySelector('[data-ticket-numeral]')?.textContent ?? null, sum.querySelector('.nk-numlab')?.textContent ?? null] : null, checked: [...document.querySelectorAll('form[data-nos-ticket-form] input[type="radio"]')].filter((r) => r.checked).map((r) => r.value) };
            });
            if (!c.stub || c.stub[0] !== want[0] || c.stub[1] !== want[1]) failures.push(`${at}: checkout summary stub ${JSON.stringify(c.stub)}, want ${JSON.stringify(want)} (R4)`);
            if (c.checked.length !== 1 || c.checked[0] !== pick.value) failures.push(`${at}: checkout form checked ${JSON.stringify(c.checked)}, want ["${pick.value}"] (R4)`);
          }
        }
      }

      // R5
      s = await hub(page, srv, at);
      if (s) {
        for (const id of Object.keys(G.fanStubs).filter((k) => k !== 'day')) {
          const c = s.cards[id];
          if (!c) failures.push(`${at}: no ${id} card (R5)`);
          else if (c.stub[0] !== G.fanStubs[id][0] || c.stub[1] !== G.fanStubs[id][1]) failures.push(`${at}: ${id} card stub ${JSON.stringify(c.stub)}, want ${JSON.stringify(G.fanStubs[id])} (R5)`);
        }
        const wk = s.cards.weekend;
        if (wk && wk.cta) {
          await page.locator('article#ticket-weekend [data-ticket-cta]').click();
          await page.waitForURL((u) => u.pathname.startsWith('/tickets/'), { timeout: 20_000 }).catch(() => {});
          if (new URL(page.url()).pathname !== `/tickets/${wk.slug}`) failures.push(`${at}: Weekend Pass Buy led to ${page.url()}, want /tickets/${wk.slug} (R5)`);
        } else failures.push(`${at}: the Weekend Pass has no Buy link (R5)`);
        if (s.overflow > 0) failures.push(`${at}: scrolls horizontally by ${s.overflow}px (R6)`);
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

finish(NAME, failures, `${checks} hub runs (${MODES.join('/')}, ${WIDTHS.join('/')}): the fan and the Day Pass card show no day until one is chosen, Buy with no day shows "Choose a day" in the required-field pattern with focus on the picker and aria-invalid, a chosen day drives the stub and the checkout, and the other cards keep their stubs.`);
