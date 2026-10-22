// nos-ticket-day-stub (r45b) F2 rendered (fresh PUBLIC and PREVIEW production builds on live Sanity, next start 3010-3019 minus 3002,
// 3013 and 3016). QA input, hash-locked. Golden: goldens/f2-edits.json. Both modes, 1280 and 390. The Day Pass and Weekend Pass slugs
// are read from the hub's own cards (live data), never hard-coded. POST /api/tickets/checkout is aborted for the whole context and any
// attempt fails the check: no reservation is ever made, and no test step submits with a day chosen.
//   C1  /tickets/<day slug>?quantity=1 (no ?day): 200; no day radio checked; the summary stub is the product's own '' / '' and its when
//       line is TICKET_PRODUCTS.day.when "Friday, Saturday or Sunday"; no alert; the fieldset is not aria-invalid; "Continue to payment"
//       is not disabled.
//   C2  "Continue to payment" with no day (click, then again by keyboard Enter after a reload): the page stays, no checkout request is
//       sent; the fieldset is aria-invalid="true" and holds exactly one role="alert" <p> reading the "Choose a day" legend with the r45
//       class (goldens/f1-edits.json errorClass), 6px below the day row; focus is on the first enabled day radio, unchecked; the button
//       is still not disabled; axe finds no violation in the form.
//   C3  choosing the second day clears the alert and aria-invalid ("false") and the summary stub follows it (CHECKOUT_DAY_EVENT).
//   C4  /tickets/<day slug>?quantity=1&day=<iso>: that day is pre-selected and the summary stub is that day (as before).
//   C5  /tickets/<weekend slug>?quantity=1: no day picker and no alert; its summary keeps the fixed Weekend stub.
//   C6  no horizontal overflow. Element screenshots (f2-<mode>-<width>-<state>.png) land in <checkout>/.tmp/tds-shots/.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { MODES, authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f2-rendered.mjs';
const G = goldenJson('f2-edits.json');
const G1 = goldenJson('f1-edits.json');
const WIDTHS = [1280, 390];
const ERROR_GAP = 6;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHOTS = path.join(repoRoot, '.tmp', 'tds-shots');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let checks = 0;

const stubOf = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return [String(d.getUTCDate()), WEEKDAYS[d.getUTCDay()]]; };
const near = (a, b) => Math.abs(a - b) <= 1;

const state = (page) => page.evaluate((label) => {
  const sum = document.querySelector('article[data-ticket-variant="summary"]');
  const form = document.querySelector('form[data-nos-ticket-form]');
  const fs = form?.querySelector('fieldset.nk-days') ?? null;
  const row = fs?.querySelector('.nk-days-row') ?? null;
  const alerts = fs ? [...fs.querySelectorAll('[role="alert"]')] : [];
  const a = alerts[0] ?? null;
  const btn = form ? [...form.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes(label)) ?? null : null;
  const radios = fs ? [...fs.querySelectorAll('input[type="radio"]')] : [];
  const active = document.activeElement;
  return {
    summary: sum ? { stub: [sum.querySelector('[data-ticket-numeral]')?.textContent ?? null, sum.querySelector('.nk-numlab')?.textContent ?? null], when: sum.querySelector('.nk-when')?.textContent ?? null } : null,
    hasForm: Boolean(form),
    fieldset: Boolean(fs),
    legend: fs?.querySelector('legend')?.textContent ?? null,
    invalid: fs ? fs.getAttribute('aria-invalid') : null,
    radios: radios.map((r) => ({ value: r.value, checked: r.checked, disabled: r.disabled })),
    alerts: alerts.map((x) => ({ text: x.textContent, tag: x.tagName, cls: x.getAttribute('class') })),
    alertGap: a && row ? a.getBoundingClientRect().top - row.getBoundingClientRect().bottom : null,
    button: btn ? { disabled: btn.disabled, ariaDisabled: btn.getAttribute('aria-disabled') } : null,
    focus: active && fs && fs.contains(active) && active.matches('input[type="radio"]') ? { value: active.value, checked: active.checked, disabled: active.disabled } : null,
    focusTag: active ? `${active.tagName}${active.id ? `#${active.id}` : ''}` : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
}, G.submitLabel);

async function open(page, url, at) {
  const r = await page.goto(url, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return null; }
  await page.evaluate(async () => { await document.fonts.ready; });
  const s = await state(page);
  if (!s.hasForm) { failures.push(`${at}: no checkout form (INFRA: is the product on sale?)`); return null; }
  return s;
}

function expectError(s, at, how) {
  if (s.invalid !== 'true') failures.push(`${at}: after ${how} with no day the fieldset aria-invalid is ${JSON.stringify(s.invalid)}, want "true" (C2)`);
  if (s.alerts.length !== 1) failures.push(`${at}: after ${how} with no day ${s.alerts.length} alerts in the picker, want 1 (C2)`);
  else {
    const a = s.alerts[0];
    if (a.text !== G1.copy.chooseDay || a.tag !== 'P' || a.cls !== G1.errorClass) failures.push(`${at}: the alert is <${a.tag} class="${a.cls}">${a.text}, want <P class="${G1.errorClass}">${G1.copy.chooseDay} (C2)`);
    if (s.alertGap === null || !near(s.alertGap, ERROR_GAP)) failures.push(`${at}: the alert sits ${s.alertGap}px below the day row, want ${ERROR_GAP} (C2)`);
  }
  if (s.legend !== G1.copy.chooseDay) failures.push(`${at}: the legend reads ${JSON.stringify(s.legend)}, want "${G1.copy.chooseDay}" (C2)`);
  const first = s.radios.find((r) => !r.disabled);
  if (!s.focus || !first || s.focus.value !== first.value || s.focus.checked) failures.push(`${at}: after ${how} focus is on ${s.focus ? `radio ${s.focus.value} checked=${s.focus.checked}` : s.focusTag}, want the first enabled day radio ${first ? first.value : '?'}, unchecked (C2)`);
  if (s.radios.some((r) => r.checked)) failures.push(`${at}: after ${how} a day is checked (C2)`);
  if (!s.button || s.button.disabled || s.button.ariaDisabled === 'true') failures.push(`${at}: after ${how} "${G.submitLabel}" is disabled or missing (C2)`);
}

for (const mode of MODES) {
  const srv = await serve(mode);
  if (srv.failures) { failures.push(...srv.failures.map((f) => `${mode}: ${f}`)); continue; }
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const posts = [];
      await ctx.route('**/api/tickets/checkout**', (route) => { posts.push(route.request().method()); return route.abort(); });
      const page = await ctx.newPage();
      const tag = `${mode} @${width}`;
      checks += 1;
      const hub = await page.goto(`${srv.origin}${G1.routes.hub}`, { waitUntil: 'networkidle' });
      const slugs = hub && hub.status() === 200 ? await page.evaluate(() => ({ day: document.querySelector('article#ticket-day')?.dataset.ticketSlug ?? null, weekend: document.querySelector('article#ticket-weekend')?.dataset.ticketSlug ?? null })) : {};
      if (!slugs.day) { failures.push(`${tag}: no Day Pass slug on the hub (INFRA)`); await ctx.close(); continue; }
      const bare = `${srv.origin}/tickets/${slugs.day}?quantity=1`;
      const at = `${mode} /tickets/${slugs.day}?quantity=1 @${width}`;
      const shot = async (name) => { await page.mouse.move(0, 0); await page.locator('main').screenshot({ path: path.join(SHOTS, `f2-${mode}-${width}-${name}.png`), animations: 'disabled' }); };
      const submit = () => page.locator('form[data-nos-ticket-form] button[type="submit"]');

      // C1
      let s = await open(page, bare, at);
      if (s) {
        if (!s.fieldset) failures.push(`${at}: no day picker (INFRA)`);
        if (s.radios.some((r) => r.checked)) failures.push(`${at}: a day is pre-selected: ${s.radios.filter((r) => r.checked).map((r) => r.value).join(', ')} (C1)`);
        if (!s.summary || s.summary.stub[0] !== '' || s.summary.stub[1] !== '') failures.push(`${at}: summary stub ${JSON.stringify(s.summary && s.summary.stub)}, want ["",""] (C1)`);
        if (!s.summary || s.summary.when !== G.dayWhen) failures.push(`${at}: summary when ${JSON.stringify(s.summary && s.summary.when)}, want "${G.dayWhen}" (C1)`);
        if (s.alerts.length || s.invalid === 'true') failures.push(`${at}: the picker shows an error before submit (C1)`);
        if (!s.button || s.button.disabled || s.button.ariaDisabled === 'true') failures.push(`${at}: "${G.submitLabel}" is disabled or missing (C1)`);
        if (s.overflow > 0) failures.push(`${at}: scrolls horizontally by ${s.overflow}px (C6)`);
        await shot('unchosen');

        // C2 (click)
        await submit().click();
        await page.waitForTimeout(400);
        if (page.url() !== bare) failures.push(`${at}: submit with no day moved to ${page.url()} (C2)`);
        s = await state(page);
        expectError(s, at, 'a click on submit');
        await page.addScriptTag({ path: axeSource() });
        const v = await page.evaluate(async () => (await window.axe.run('form[data-nos-ticket-form]', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`));
        if (v.length) failures.push(`${at}: axe in the error state: ${v.join('; ')} (C2)`);
        await shot('error');
      }

      // C2 (keyboard), C3
      s = await open(page, bare, at);
      if (s) {
        await submit().focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        expectError(await state(page), at, 'Enter on submit');
        s = await state(page);
        const openDays = s.radios.filter((r) => !r.disabled);
        const pick = openDays[1] ?? openDays[0];
        if (!pick) failures.push(`${at}: no enabled day to choose (INFRA)`);
        else {
          await page.locator(`form[data-nos-ticket-form] label:has(input[value="${pick.value}"])`).click();
          await page.waitForTimeout(200);
          s = await state(page);
          const want = stubOf(pick.value);
          if (!s.radios.find((r) => r.value === pick.value)?.checked) failures.push(`${at}: ${pick.value} not checked after choosing it (C3)`);
          if (s.alerts.length || s.invalid !== 'false') failures.push(`${at}: after choosing a day alerts=${s.alerts.length} aria-invalid=${s.invalid}, want 0 / "false" (C3)`);
          if (!s.summary || s.summary.stub[0] !== want[0] || s.summary.stub[1] !== want[1]) failures.push(`${at}: summary stub ${JSON.stringify(s.summary && s.summary.stub)} after choosing ${pick.value}, want ${JSON.stringify(want)} (C3)`);
          await shot('chosen');

          // C4
          const atDay = `${mode} /tickets/${slugs.day}?quantity=1&day=${pick.value} @${width}`;
          s = await open(page, `${bare}&day=${pick.value}`, atDay);
          if (s) {
            const checked = s.radios.filter((r) => r.checked).map((r) => r.value);
            if (checked.length !== 1 || checked[0] !== pick.value) failures.push(`${atDay}: checked ${JSON.stringify(checked)}, want ["${pick.value}"] (C4)`);
            if (!s.summary || s.summary.stub[0] !== want[0] || s.summary.stub[1] !== want[1]) failures.push(`${atDay}: summary stub ${JSON.stringify(s.summary && s.summary.stub)}, want ${JSON.stringify(want)} (C4)`);
            if (s.alerts.length || s.invalid === 'true') failures.push(`${atDay}: an error shows with the day pre-selected (C4)`);
          }
        }
      }

      // C5
      if (!slugs.weekend) failures.push(`${tag}: no Weekend Pass slug on the hub (C5)`);
      else {
        const atWk = `${mode} /tickets/${slugs.weekend}?quantity=1 @${width}`;
        s = await open(page, `${srv.origin}/tickets/${slugs.weekend}?quantity=1`, atWk);
        if (s) {
          if (s.fieldset || s.alerts.length) failures.push(`${atWk}: a day picker or alert on the Weekend Pass checkout (C5)`);
          const wk = G1.fanStubs.weekend;
          if (!s.summary || s.summary.stub[0] !== wk[0] || s.summary.stub[1] !== wk[1]) failures.push(`${atWk}: summary stub ${JSON.stringify(s.summary && s.summary.stub)}, want ${JSON.stringify(wk)} (C5)`);
        }
      }

      if (posts.length) failures.push(`${tag}: ${posts.length} request(s) to /api/tickets/checkout were attempted (aborted): submit with no day must send nothing (C2)`);
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${checks} checkout runs (${MODES.join('/')}, ${WIDTHS.join('/')}): without ?day no day is checked and the summary shows the product's own stub and "${G.dayWhen}"; ${G.submitLabel} with no day stays enabled, sends nothing, shows "Choose a day" in the r45 pattern with aria-invalid and focus on the picker; a chosen or linked day drives the summary; the Weekend Pass checkout is unchanged.`);
