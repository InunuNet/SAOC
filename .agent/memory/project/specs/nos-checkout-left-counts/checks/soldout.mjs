// nos-checkout-left-counts amendment 1 (Codi: sold-out days are disabled on the checkout, as on the hub). Rendered, fresh PUBLIC production
// build on live Sanity, next start 3010-3019 minus 3002, 3013 and 3016. QA input, hash-locked. Golden: goldens/edits.json "soldOut".
// Live data has no sold-out day, so the harness FORCES one: the document response of the hub and of the checkout is rewritten in flight
// (page.route + route.fetch) so that the RSC payload's day object {"day":D,"state":S,"remaining":N,...} reads state "soldOut", remaining 0.
// Both pages get the same rewrite, so the hub's own day cell is the oracle (no hard-coded style). The server render still shows the old cell,
// so React recovers by client-rendering from the rewritten payload (a hydration warning is expected and ignored); every check waits for the
// forced state to appear. POST /api/tickets/checkout is fulfilled by a mock (409 {error}) and counted; it is never allowed through.
// D is the checkout's FIRST day, so "focus the first enabled day" has to skip a disabled first option.
//   D1  forced D, hub and checkout: the option is a native disabled radio (no aria-disabled), unchecked, label class is-out, its line reads
//       "Sold out" (TICKET_COPY.soldOutStamp); every other option is enabled and not is-out; the checkout cell markup equals the hub's.
//   D2  the muted style is the hub's: label opacity and cursor and the day name's text-decoration are equal on both pages and are the rule's
//       values (0.62, not-allowed, line-through).
//   D3  D cannot be chosen: a click on its label (forced), ArrowLeft/ArrowRight from another option and 14 Tab presses never check it, focus it
//       or send a request.
//   D4  r45 holds with D closed: submit with no day sends nothing, shows one "Choose a day" alert, aria-invalid="true", focus on the first
//       ENABLED radio (not D), unchecked.
//   D5  the existing server error still renders: an enabled day chosen (?day=E), submit, the mock replies 409 {"error":"Sold out."}: one POST
//       whose body names E, one role="alert" in the form reading "Sold out.", E still checked, the button enabled; and with D closed AND linked
//       (?day=D) submit sends one POST naming D and the same alert renders (the form does not hide the server's verdict). The attendee name and
//       email are filled first with fixed test values (otherwise cartValidation stops the submit). The linked day stays checked while disabled
//       (goldens/spec.md): the selection is the buyer's, the server's verdict is the check.
//   D6  axe (WCAG 2.2 AA) clean on the form in the forced state, no horizontal overflow.
// Screenshots: <checkout>/.tmp/lc-shots/lc-soldout-<width>-*.png.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'soldout.mjs';
const G = goldenJson('edits.json');
const S = G.soldOut;
const WIDTHS = [1280, 390];
const MODE = 'public';
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let runs = 0;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const FORM = 'form[data-nos-ticket-form]';

const forceRe = (day) => new RegExp(`(\\\\?"day\\\\?":\\\\?"${day}\\\\?",\\\\?"state\\\\?":\\\\?")[A-Za-z]+(\\\\?",\\\\?"remaining\\\\?":)\\d+`, 'g');

// Runs in the page: facts about one option of a day picker.
function readOption({ root, day }) {
  const fs = document.querySelector(root);
  if (!fs) return null;
  const labels = [...fs.querySelectorAll('label.nk-day')];
  const shown = (el) => el.getBoundingClientRect().width > 0;
  return {
    alerts: [...fs.querySelectorAll('[role="alert"]')].length,
    invalid: fs.getAttribute('aria-invalid'),
    days: labels.map((label) => {
      const input = label.querySelector('input');
      const clone = label.cloneNode(true);
      clone.querySelector('input')?.remove();
      clone.querySelector('b')?.remove();
      const ls = getComputedStyle(label);
      const b = label.querySelector('b');
      return {
        day: input.value, checked: input.checked, disabled: input.disabled, ariaDisabled: input.getAttribute('aria-disabled'),
        out: label.classList.contains('is-out'),
        html: clone.innerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\sid="[^"]*"/g, '').trim(),
        line: [...label.querySelectorAll('span')].filter(shown).map((s) => s.textContent).join(' | '),
        style: { opacity: ls.opacity, cursor: ls.cursor, nameDecoration: b ? getComputedStyle(b).textDecorationLine : null },
      };
    }),
    target: day,
  };
}

async function axeIn(page, at, label) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: axeSource() });
  const v = await page.evaluate(async (tags) => (await window.axe.run('form[data-nos-ticket-form]', { runOnly: { type: 'tag', values: tags } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`), AXE_TAGS);
  if (v.length) failures.push(`${at}: axe in the ${label} state: ${v.join('; ')} (D6)`);
}

const srv = await serve(MODE);
if (srv.failures) { failures.push(...srv.failures.map((f) => `${MODE}: ${f}`)); }
else {
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const posts = [];
      let forceDay = null;
      let forced = [];
      await ctx.route('**/api/tickets/checkout**', (route) => { posts.push(route.request().postData() ?? ''); return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: S.serverError }) }); });
      await ctx.route((u) => u.origin === srv.origin && !u.pathname.startsWith('/_next') && !u.pathname.startsWith('/api'), async (route) => {
        if (!forceDay || route.request().resourceType() !== 'document') return route.fallback();
        const resp = await route.fetch();
        let body = await resp.text();
        let n = 0;
        body = body.replace(forceRe(forceDay), (_m, a, b) => { n += 1; return `${a}soldOut${b}0`; });
        forced.push([new URL(route.request().url()).pathname, n]);
        const headers = { ...resp.headers(), 'content-length': String(Buffer.byteLength(body)) };
        delete headers['content-encoding'];
        return route.fulfill({ status: resp.status(), headers, body });
      });
      const page = await ctx.newPage();
      const tag = `${MODE} @${width}`;
      runs += 1;

      const hubPath = G.hub;
      const hubRes = await page.goto(`${srv.origin}${hubPath}`, { waitUntil: 'networkidle' });
      if (!hubRes || hubRes.status() !== 200) { failures.push(`${tag}: hub HTTP ${hubRes ? hubRes.status() : 0} (INFRA)`); await ctx.close(); continue; }
      const slug = await page.evaluate(() => document.querySelector('article#ticket-day')?.dataset.ticketSlug ?? null);
      if (!slug) { failures.push(`${tag}: no Day Pass slug on the hub (INFRA)`); await ctx.close(); continue; }
      const url = `${srv.origin}/tickets/${slug}?quantity=1`;
      const at = `${tag} /tickets/${slug}`;
      const open = async (u, root, d, want) => {
        const r = await page.goto(u, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return null; }
        await page.evaluate(async () => { await document.fonts.ready; });
        if (want) {
          try {
            await page.waitForFunction(({ r0, d0 }) => document.querySelector(`${r0} label.nk-day:has(input[value="${d0}"])`)?.classList.contains('is-out'), { r0: root, d0: d }, { timeout: 8000 });
          } catch { /* reported by the caller from the state read */ }
        }
        return page.evaluate(readOption, { root, day: d });
      };

      // First checkout day, unforced.
      const base = await open(url, `${FORM} fieldset.nk-days`, '', false);
      if (!base || base.days.length < 2) { failures.push(`${at}: need a checkout picker with at least two days (INFRA)`); await ctx.close(); continue; }
      const D = base.days[0].day;
      const E = base.days[1].day;
      forceDay = D;

      // D1, D2
      forced = [];
      const hub = await open(`${srv.origin}${hubPath}`, 'article#ticket-day fieldset.nk-days', D, true);
      const hubForced = forced.find(([p]) => p === hubPath);
      if (!hub || !hubForced || hubForced[1] === 0) { failures.push(`${tag}: the harness could not force ${D} sold out on the hub payload (INFRA)`); await ctx.close(); continue; }
      forced = [];
      const co = await open(url, `${FORM} fieldset.nk-days`, D, true);
      const coForced = forced.find(([p]) => p === `/tickets/${slug}`);
      if (!co || !coForced || coForced[1] === 0) { failures.push(`${at}: the checkout payload carries no day object for ${D} to force: the counts are not passed through unchanged (D1)`); await ctx.close(); continue; }
      const hD = hub.days.find((d) => d.day === D);
      const cD = co.days.find((d) => d.day === D);
      if (!hD || !hD.disabled || !hD.out) failures.push(`${tag}: the hub did not take the forced state for ${D}: ${JSON.stringify(hD)} (INFRA)`);
      if (!cD) failures.push(`${at}: no option for ${D} (D1)`);
      else {
        if (!cD.disabled) failures.push(`${at}: sold-out ${D} is not a native disabled radio (D1)`);
        if (cD.ariaDisabled !== null) failures.push(`${at}: sold-out ${D} uses aria-disabled=${cD.ariaDisabled}: native disabled only (D1)`);
        if (cD.checked) failures.push(`${at}: sold-out ${D} is checked (D1)`);
        if (!cD.out) failures.push(`${at}: sold-out ${D} label lacks is-out (D1)`);
        if (cD.line !== S.soldOutLine) failures.push(`${at}: sold-out ${D} line reads ${JSON.stringify(cD.line)}, want ${JSON.stringify(S.soldOutLine)} (D1)`);
        if (hD && cD.html !== hD.html) failures.push(`${at}: sold-out ${D} cell is ${JSON.stringify(cD.html)}, the hub's is ${JSON.stringify(hD.html)} (D1)`);
        if (hD && JSON.stringify(cD.style) !== JSON.stringify(hD.style)) failures.push(`${at}: sold-out ${D} style ${JSON.stringify(cD.style)} differs from the hub's ${JSON.stringify(hD.style)} (D2)`);
        if (JSON.stringify(cD.style) !== JSON.stringify(S.style)) failures.push(`${at}: sold-out ${D} style ${JSON.stringify(cD.style)}, want ${JSON.stringify(S.style)} (D2)`);
      }
      for (const d of co.days.filter((x) => x.day !== D)) if (d.disabled || d.out) failures.push(`${at}: ${d.day} is disabled=${d.disabled} is-out=${d.out} but only ${D} sold out (D1)`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 0) failures.push(`${at}: scrolls horizontally by ${overflow}px (D6)`);
      await axeIn(page, at, 'forced sold-out');
      await page.mouse.move(0, 0);
      await page.locator(FORM).screenshot({ path: path.join(SHOTS, `lc-soldout-${width}-initial.png`), animations: 'disabled' });

      // D3
      const labelD = page.locator(`${FORM} label.nk-day:has(input[value="${D}"])`);
      await labelD.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(200);
      let st = await page.evaluate(readOption, { root: `${FORM} fieldset.nk-days`, day: D });
      if (st.days.some((d) => d.checked)) failures.push(`${at}: a click on sold-out ${D} checked ${st.days.filter((d) => d.checked).map((d) => d.day).join(', ')} (D3)`);
      if (st.alerts) failures.push(`${at}: a click on sold-out ${D} raised an alert (D3)`);
      await page.locator(`${FORM} label.nk-day:has(input[value="${E}"])`).click();
      const seen = [];
      const probe = async (how) => {
        const s = await page.evaluate((day) => { const a = document.activeElement; return { focusDay: a && a.matches('input[type="radio"]') ? a.value : null, checked: [...document.querySelectorAll('form[data-nos-ticket-form] input[type="radio"]')].filter((r) => r.checked).map((r) => r.value), target: day }; }, D);
        if (s.checked.includes(D) || s.focusDay === D) failures.push(`${at}: after ${how} sold-out ${D} is ${s.checked.includes(D) ? 'checked' : 'focused'} (D3)`);
        seen.push(s.focusDay);
      };
      for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowDown']) { await page.keyboard.press(key); await probe(key); }
      for (let i = 0; i < 14; i += 1) { await page.keyboard.press(i < 10 ? 'Tab' : 'Shift+Tab'); await probe(i < 10 ? 'Tab' : 'Shift+Tab'); }
      if (posts.length) failures.push(`${at}: ${posts.length} checkout request(s) while exercising a sold-out day (D3)`);

      // D4
      forced = [];
      await open(url, `${FORM} fieldset.nk-days`, D, true);
      await page.locator(`${FORM} button[type="submit"]`).click();
      await page.waitForTimeout(400);
      const er = await page.evaluate(() => {
        const fs = document.querySelector('form[data-nos-ticket-form] fieldset.nk-days');
        const a = document.activeElement;
        return { invalid: fs.getAttribute('aria-invalid'), alerts: [...fs.querySelectorAll('[role="alert"]')].map((x) => [...x.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('')), focus: a && a.matches('input[type="radio"]') ? { value: a.value, checked: a.checked } : null, checked: [...fs.querySelectorAll('input:checked')].length };
      });
      if (er.invalid !== 'true' || er.alerts.length !== 1 || er.alerts[0] !== G.chooseDay) failures.push(`${at}: submit with no day: aria-invalid=${er.invalid} alerts=${JSON.stringify(er.alerts)}, want "true" and one "${G.chooseDay}" (D4)`);
      if (!er.focus || er.focus.value !== E || er.focus.checked) failures.push(`${at}: submit with no day focus ${JSON.stringify(er.focus)}, want unchecked ${E} (the first enabled day, not sold-out ${D}) (D4)`);
      if (er.checked) failures.push(`${at}: a day is checked after submit with none chosen (D4)`);
      if (posts.length) failures.push(`${at}: submit with no day sent ${posts.length} request(s) (D4)`);

      // D5: an enabled day, then the server says Sold out. The attendee fields are filled first: client validation (cartValidation.ts) would
      // otherwise stop the submit before any request. Fixed test values, never a real person.
      const fillAttendee = async () => {
        await page.locator(`${FORM} input[autocomplete="name"]`).first().fill('Check Attendee');
        await page.locator(`${FORM} input[autocomplete="email"]`).first().fill('check@example.com');
      };
      const alertText = () => page.evaluate(() => [...document.querySelectorAll('form[data-nos-ticket-form] [role="alert"]')].map((x) => [...x.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('')));
      forceDay = null;
      let o = await open(`${url}&day=${E}`, `${FORM} fieldset.nk-days`, E, false);
      if (!o || !o.days.find((d) => d.day === E)?.checked) failures.push(`${at}&day=${E}: ${E} is not pre-selected (D5)`);
      const before = o ? o.days.map((d) => [d.day, d.html]) : null;
      await fillAttendee();
      await page.locator(`${FORM} button[type="submit"]`).click();
      await page.waitForTimeout(600);
      let texts = await alertText();
      if (posts.length !== 1 || !posts[0].includes(E)) failures.push(`${at}&day=${E}: ${posts.length} POST(s), body naming ${E}: ${posts.length ? posts[0].includes(E) : false}, want exactly one that does (D5)`);
      if (texts.length !== 1 || texts[0] !== S.serverError) failures.push(`${at}&day=${E}: alerts after the server error ${JSON.stringify(texts)}, want one "${S.serverError}" (D5)`);
      o = await page.evaluate(readOption, { root: `${FORM} fieldset.nk-days`, day: E });
      if (!o.days.find((d) => d.day === E)?.checked) failures.push(`${at}&day=${E}: ${E} lost its selection after the server error (D5)`);
      if (before && JSON.stringify(o.days.map((d) => [d.day, d.html])) !== JSON.stringify(before)) failures.push(`${at}&day=${E}: the count cells changed after the server error (D5)`);
      const btn = await page.evaluate(() => { const b = [...document.querySelectorAll('form[data-nos-ticket-form] button[type="submit"]')][0]; return b ? b.disabled : null; });
      if (btn !== false) failures.push(`${at}&day=${E}: the submit button is stuck (disabled=${btn}) after the server error (D5)`);

      // D5: sold out and linked.
      posts.length = 0;
      forceDay = D;
      forced = [];
      o = await open(`${url}&day=${D}`, `${FORM} fieldset.nk-days`, D, true);
      if (!o || !o.days.find((d) => d.day === D)?.disabled) failures.push(`${at}&day=${D}: ${D} is not disabled when linked (D5)`);
      await fillAttendee();
      await page.locator(`${FORM} button[type="submit"]`).click();
      await page.waitForTimeout(600);
      texts = await alertText();
      if (posts.length !== 1 || !posts[0].includes(D)) failures.push(`${at}&day=${D}: ${posts.length} POST(s) when submitting with the linked sold-out day, want one naming ${D} (the server decides) (D5)`);
      if (texts.length !== 1 || texts[0] !== S.serverError) failures.push(`${at}&day=${D}: alerts ${JSON.stringify(texts)}, want one "${S.serverError}" (D5)`);

      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${runs} runs (${MODE}, ${WIDTHS.join('/')}): a forced sold-out first day is a native disabled, unchecked, is-out option reading "${S.soldOutLine}" with the hub's own muted style; it cannot be chosen by click, arrow keys or Tab; r45's no-day alert focuses the first enabled day; the server's error still renders; axe clean; no overflow.`);
