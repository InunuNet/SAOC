// nos-checkout-left-counts (rLC, r45 P3) rendered: fresh PUBLIC and PREVIEW production builds on live Sanity and the live sold counts
// (read-only aggregate: nothing here reads an order or a person), next start 3010-3019 minus 3002, 3013 and 3016. QA input, hash-locked.
// Golden: goldens/edits.json. Both modes, 1280 and 390. The Day Pass and Weekend Pass slugs are read from the hub's own cards. POST
// /api/tickets/checkout is aborted for the whole context and any attempt fails the check: no reservation is ever made.
// The comparison is hub vs checkout in the SAME build and viewport: the hub's Day Pass fieldset is the oracle, so the check needs no
// hard-coded number and holds whatever the live stock is (public withholds provisional counts on both pages, preview marks them on both).
//   C1  /tickets/<day slug>?quantity=1: for every day the hub and the picker share, the option's count cell is the hub's: identical cell
//       markup (the part after the day name, ids removed), the same ".nk-of" and ".nk-left" texts, and ".nk-left" reads exactly "<N> left"
//       (N the hub's remaining); the visible line equals the hub's visible line at that width (CSS shows "<N> left" below 420px and the
//       "<N> of <T>" line above, as on the hub); is-low and the "Few left" line match; the "Not yet confirmed" note matches (both or neither).
//       Where the hub shows no count the picker shows none.
//   C2  the radio's aria-describedby resolves to an element inside its own label that holds the count.
//   C3  r45 still holds: no day is checked, the fieldset is aria-invalid="false", no alert, the button is enabled; "Continue to payment"
//       with no day sends nothing, shows one "Choose a day" alert with aria-invalid="true", focuses the first enabled day radio
//       (unchecked) and leaves the count cells as they were; choosing a day clears the alert and aria-invalid, keeps the cells, and
//       ?day=<iso> opens with that day checked and the cells unchanged.
//   C4  axe (WCAG 2.2 AA) finds no violation in the form in the initial, error and chosen states.
//   C5  no horizontal overflow of the page, and no option's content leaves its box.
//   C6  the Weekend Pass (and VIP, when the hub lists it) checkout has no day picker and no count.
//   C7  the hub's own Day Pass cells are unchanged in shape: wrapper span with ".nk-of" "<N> of <T>" then ".nk-left" "<N> left", then the
//       optional "Few left" line (guards the DayCount extraction).
//   At least one build must show a hub count, else the comparison proved nothing (INFRA).
//   Element screenshots (lc-<mode>-<width>-<state>.png) land in <checkout>/.tmp/lc-shots/.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { MODES, authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'rendered.mjs';
const G = goldenJson('edits.json');
const WIDTHS = [1280, 390];
const NARROW = 420;
const SHOTS = path.join(repoRoot, G.shots);
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let runs = 0;
let hubCounts = 0;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Runs in the page: the cells of one day picker (hub Day Pass card or checkout form).
function readPicker(selector) {
  const fs = document.querySelector(selector);
  if (!fs) return null;
  const labels = [...fs.querySelectorAll('label.nk-day')];
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none'; };
  return {
    invalid: fs.getAttribute('aria-invalid'),
    alerts: [...fs.querySelectorAll('[role="alert"]')].map((a) => ({ tag: a.tagName, text: [...a.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('') })),
    note: fs.querySelector('.nk-unconfirmed')?.textContent ?? null,
    days: labels.map((label) => {
      const input = label.querySelector('input');
      const clone = label.cloneNode(true);
      clone.querySelector('input')?.remove();
      clone.querySelector('b')?.remove();
      const html = clone.innerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\sid="[^"]*"/g, '').trim();
      const left = label.querySelector('.nk-left');
      const of = label.querySelector('.nk-of');
      const wrap = left ? left.parentElement : null;
      const lr = label.getBoundingClientRect();
      const spans = [...label.querySelectorAll('span')].filter(shown);
      const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
      const described = ids.map((id) => document.getElementById(id)).filter(Boolean);
      return {
        day: input.value, checked: input.checked, disabled: input.disabled,
        low: label.classList.contains('is-low'), out: label.classList.contains('is-out'),
        html, left: left ? left.textContent : null, of: of ? of.textContent : null,
        visible: wrap ? ([...wrap.children].find(shown)?.textContent ?? null) : null,
        sub: label.querySelector('.nk-sub')?.textContent ?? null,
        describedIds: ids, describedInside: described.filter((el) => label.contains(el)).map((el) => el.textContent),
        overflow: spans.some((s) => s.getBoundingClientRect().right > lr.right + 0.5 || s.getBoundingClientRect().left < lr.left - 0.5) || label.scrollWidth > label.clientWidth + 1,
      };
    }),
  };
}

const FORM_PICKER = 'form[data-nos-ticket-form] fieldset.nk-days';
const HUB_PICKER = 'article#ticket-day fieldset.nk-days';
const pageState = (page) => page.evaluate(() => {
  const form = document.querySelector('form[data-nos-ticket-form]');
  const btn = form ? [...form.querySelectorAll('button[type="submit"]')].find((b) => b.textContent.includes('Continue to payment')) ?? null : null;
  const active = document.activeElement;
  const fs = form?.querySelector('fieldset.nk-days') ?? null;
  return {
    hasForm: Boolean(form), picker: Boolean(fs),
    countsAnywhere: document.querySelectorAll('main .nk-left, main .nk-of').length,
    button: btn ? { disabled: btn.disabled, ariaDisabled: btn.getAttribute('aria-disabled') } : null,
    focus: active && fs && fs.contains(active) && active.matches('input[type="radio"]') ? { value: active.value, checked: active.checked, disabled: active.disabled } : null,
    focusTag: active ? `${active.tagName}${active.id ? `#${active.id}` : ''}` : null,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

async function axeIn(page, at, label) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: axeSource() });
  const v = await page.evaluate(async (tags) => (await window.axe.run('form[data-nos-ticket-form]', { runOnly: { type: 'tag', values: tags } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`), AXE_TAGS);
  if (v.length) failures.push(`${at}: axe in the ${label} state: ${v.join('; ')} (C4)`);
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
      runs += 1;

      const hubRes = await page.goto(`${srv.origin}${G.hub}`, { waitUntil: 'networkidle' });
      if (!hubRes || hubRes.status() !== 200) { failures.push(`${tag}: hub HTTP ${hubRes ? hubRes.status() : 0} (INFRA)`); await ctx.close(); continue; }
      await page.evaluate(async () => { await document.fonts.ready; });
      const slugs = await page.evaluate(() => ({ day: document.querySelector('article#ticket-day')?.dataset.ticketSlug ?? null, weekend: document.querySelector('article#ticket-weekend')?.dataset.ticketSlug ?? null, vip: document.querySelector('article#ticket-vip')?.dataset.ticketSlug ?? null }));
      const hub = await page.evaluate(readPicker, HUB_PICKER);
      if (!slugs.day || !hub) { failures.push(`${tag}: no Day Pass card with a day picker on the hub (INFRA)`); await ctx.close(); continue; }

      // C7
      for (const d of hub.days) {
        const shape = d.left === null ? true : /^<span( data-placeholder="true")?><span class="nk-of">\d+ of \d+<\/span><span class="nk-left">\d+ left<\/span><\/span>(<span class="nk-sub">Few left<\/span>)?$/.test(d.html);
        if (!shape) failures.push(`${tag}: hub ${d.day} cell is ${JSON.stringify(d.html)}, not the of/left pair (+ optional Few left) (C7)`);
        if (d.left !== null) hubCounts += 1;
      }

      const url = `${srv.origin}/tickets/${slugs.day}?quantity=1`;
      const at = `${mode} /tickets/${slugs.day}?quantity=1 @${width}`;
      const shot = async (name) => { await page.mouse.move(0, 0); await page.locator('form[data-nos-ticket-form]').screenshot({ path: path.join(SHOTS, `lc-${mode}-${width}-${name}.png`), animations: 'disabled' }); };
      const open = async (u) => {
        const r = await page.goto(u, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return false; }
        await page.evaluate(async () => { await document.fonts.ready; });
        const s = await pageState(page);
        if (!s.hasForm || !s.picker) { failures.push(`${at}: no checkout form with a day picker (INFRA: is the Day Pass on sale?)`); return false; }
        return true;
      };

      if (await open(url)) {
        const co = await page.evaluate(readPicker, FORM_PICKER);
        let s = await pageState(page);
        const byDay = Object.fromEntries(hub.days.map((d) => [d.day, d]));
        let shared = 0;
        // C1, C2
        for (const c of co.days) {
          const h = byDay[c.day];
          if (!h) { if (c.html !== '') failures.push(`${at}: ${c.day} is not on the hub's card but shows ${JSON.stringify(c.html)} (C1)`); continue; }
          shared += 1;
          if (c.html !== h.html) failures.push(`${at}: ${c.day} cell is ${JSON.stringify(c.html)}, the hub's is ${JSON.stringify(h.html)} (C1)`);
          if (c.left !== h.left || c.of !== h.of) failures.push(`${at}: ${c.day} nk-left/nk-of are ${JSON.stringify([c.left, c.of])}, the hub's are ${JSON.stringify([h.left, h.of])} (C1)`);
          if (c.low !== h.low || c.sub !== h.sub) failures.push(`${at}: ${c.day} low/"Few left" are ${JSON.stringify([c.low, c.sub])}, the hub's are ${JSON.stringify([h.low, h.sub])} (C1)`);
          if (c.visible !== h.visible) failures.push(`${at}: ${c.day} shows ${JSON.stringify(c.visible)}, the hub shows ${JSON.stringify(h.visible)} (C1)`);
          if (h.left !== null) {
            const n = h.left.match(/^(\d+) left$/);
            if (!n || c.left !== `${n[1]} left`) failures.push(`${at}: ${c.day} count ${JSON.stringify(c.left)} is not "${n ? n[1] : '?'} left" (C1)`);
            if (!/^\d+ of \d+$/.test(c.of ?? '')) failures.push(`${at}: ${c.day} nk-of ${JSON.stringify(c.of)} is not "<N> of <T>" (C1)`);
            if (width < NARROW && c.visible !== c.left) failures.push(`${at}: ${c.day} shows ${JSON.stringify(c.visible)} below ${NARROW}px, want ${JSON.stringify(c.left)} (C1)`);
            if (!c.describedInside.some((t) => t.includes(c.left) || t.includes(c.of))) failures.push(`${at}: ${c.day} radio aria-describedby ${JSON.stringify(c.describedIds)} does not resolve to its count inside the label (C2)`);
          }
          if (c.overflow) failures.push(`${at}: ${c.day} option content leaves its box (C5)`);
        }
        if (shared === 0) failures.push(`${at}: the picker shares no day with the hub's card (INFRA)`);
        if (co.note !== hub.note) failures.push(`${at}: unconfirmed note ${JSON.stringify(co.note)}, the hub's is ${JSON.stringify(hub.note)} (C1)`);
        // C3 initial
        if (co.days.some((d) => d.checked)) failures.push(`${at}: a day is pre-selected: ${co.days.filter((d) => d.checked).map((d) => d.day).join(', ')} (C3)`);
        if (co.invalid !== 'false' || co.alerts.length) failures.push(`${at}: picker aria-invalid=${co.invalid} alerts=${co.alerts.length} before submit, want "false" / 0 (C3)`);
        if (!s.button || s.button.disabled || s.button.ariaDisabled === 'true') failures.push(`${at}: "${G.submitLabel}" is disabled or missing (C3)`);
        if (s.overflow > 0) failures.push(`${at}: scrolls horizontally by ${s.overflow}px (C5)`);
        await axeIn(page, at, 'initial');
        await shot('initial');

        // C3 error
        await page.locator('form[data-nos-ticket-form] button[type="submit"]').click();
        await page.waitForTimeout(400);
        const er = await page.evaluate(readPicker, FORM_PICKER);
        s = await pageState(page);
        if (page.url() !== url) failures.push(`${at}: submit with no day moved to ${page.url()} (C3)`);
        if (er.invalid !== 'true' || er.alerts.length !== 1 || er.alerts[0].tag !== 'P' || er.alerts[0].text !== G.chooseDay) failures.push(`${at}: after submit aria-invalid=${er.invalid} alerts=${JSON.stringify(er.alerts)}, want "true" and one <P> "${G.chooseDay}" (C3)`);
        const first = er.days.find((d) => !d.disabled);
        if (!s.focus || !first || s.focus.value !== first.day || s.focus.checked) failures.push(`${at}: after submit focus is ${s.focus ? `radio ${s.focus.value} checked=${s.focus.checked}` : s.focusTag}, want the first enabled day radio ${first ? first.day : '?'}, unchecked (C3)`);
        if (JSON.stringify(er.days.map((d) => [d.day, d.html, d.visible])) !== JSON.stringify(co.days.map((d) => [d.day, d.html, d.visible]))) failures.push(`${at}: the count cells changed in the error state (C3)`);
        if (!s.button || s.button.disabled) failures.push(`${at}: "${G.submitLabel}" is disabled after submit (C3)`);
        await axeIn(page, at, 'error');
        await shot('error');

        // C3 chosen
        const open2 = er.days.filter((d) => !d.disabled);
        const pick = open2[1] ?? open2[0];
        if (!pick) failures.push(`${at}: no enabled day to choose (INFRA)`);
        else {
          await page.locator(`form[data-nos-ticket-form] label:has(input[value="${pick.day}"])`).click();
          await page.waitForTimeout(250);
          const ch = await page.evaluate(readPicker, FORM_PICKER);
          if (!ch.days.find((d) => d.day === pick.day)?.checked) failures.push(`${at}: ${pick.day} not checked after choosing it (C3)`);
          if (ch.invalid !== 'false' || ch.alerts.length) failures.push(`${at}: after choosing a day aria-invalid=${ch.invalid} alerts=${ch.alerts.length}, want "false" / 0 (C3)`);
          if (JSON.stringify(ch.days.map((d) => [d.day, d.html])) !== JSON.stringify(co.days.map((d) => [d.day, d.html]))) failures.push(`${at}: the count cells changed after choosing a day (C3)`);
          await axeIn(page, at, 'chosen');
          await shot('chosen');

          // ?day=
          const atDay = `${at}&day=${pick.day}`;
          if (await open(`${url}&day=${pick.day}`)) {
            const pre = await page.evaluate(readPicker, FORM_PICKER);
            const checked = pre.days.filter((d) => d.checked).map((d) => d.day);
            if (checked.length !== 1 || checked[0] !== pick.day) failures.push(`${atDay}: checked ${JSON.stringify(checked)}, want ["${pick.day}"] (C3)`);
            if (JSON.stringify(pre.days.map((d) => [d.day, d.html])) !== JSON.stringify(co.days.map((d) => [d.day, d.html]))) failures.push(`${atDay}: the count cells differ with a day linked (C3)`);
          }
        }
      }

      // C6
      for (const [key, slug] of [['weekend', slugs.weekend], ['vip', slugs.vip]]) {
        if (!slug) { if (key === 'weekend') failures.push(`${tag}: no Weekend Pass slug on the hub (C6)`); continue; }
        const atNon = `${mode} /tickets/${slug}?quantity=1 @${width}`;
        const r = await page.goto(`${srv.origin}/tickets/${slug}?quantity=1`, { waitUntil: 'networkidle' });
        if (!r || r.status() !== 200) { failures.push(`${atNon}: HTTP ${r ? r.status() : 0}`); continue; }
        const s = await pageState(page);
        if (!s.hasForm) { if (key === 'weekend') failures.push(`${atNon}: no checkout form (INFRA)`); continue; }
        if (s.picker || s.countsAnywhere) failures.push(`${atNon}: ${key} checkout has a day picker (${s.picker}) or ${s.countsAnywhere} count element(s) (C6)`);
      }

      if (posts.length) failures.push(`${tag}: ${posts.length} request(s) to /api/tickets/checkout were attempted (aborted): nothing here may submit (C3)`);
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

if (hubCounts === 0 && failures.length === 0) failures.push('INFRA: the hub showed no per-day count in any build or width, so the comparison proved nothing (is the sold-count read configured in .env.local?)');
finish(NAME, failures, `${runs} runs (${MODES.join('/')}, ${WIDTHS.join('/')}), ${hubCounts} hub counts compared: every shared day option in the checkout picker carries the hub's own count cell ("<N> left" / "<N> of <T>", Few left, unconfirmed note), described by its radio; no default day, "Choose a day" alert, aria-invalid and focus unchanged (r45); axe clean in three states; no overflow; Weekend Pass/VIP checkouts show no count.`);
