// nos-ticket-day-stub F3 (the required-field alert reads as an error) rendered: a fresh PUBLIC production build on live Sanity, next start
// 3010-3019 minus 3002, 3013 and 3016. QA input, hash-locked. Golden: goldens/f3-edits.json. 1280 and 390, the hub's Day Pass card and
// the Day Pass checkout it links to (slug read from the hub, never hard-coded). POST /api/tickets/checkout is aborted for the whole context
// and any attempt fails the check.
//   E1  the alert (Buy / Continue to payment with no day): computed text colour and left border colour are the token (rgb 155, 44, 44);
//       the left border is 2px solid and the other three are 0px; no outline; its first child is an aria-hidden <span> holding the
//       text-presentation warning sign, also in the token colour; the readable text is "Choose a day"; text against the alert's own
//       background is at least 4.5:1 and the border against the surface around the alert at least 3:1.
//   E2  the invalid group: every day option's four border colours are the token, and each is at least 3:1 against the option's surface.
//   E3  axe (WCAG 2.2 AA tags) finds no violation in the card / the form in the error state.
//   E4  choosing a day clears it: aria-invalid "false", no alert, and every unchosen option's border colour is back to its pre-error value.
//   E5  hub only, before the plain click (Codex P2 on BuyBlock.tsx:158): a ControlOrMeta-click and a Shift-click on Buy with no day are
//       not intercepted (the click event reaches window with defaultPrevented false), the hub page stays and shows no error; any tab or
//       window they open is closed unread. The plain click after them still shows the error (E1).
//   Element screenshots of each error state (f3-<width>-<hub|checkout>-error.png) land in <checkout>/.tmp/tds-shots/.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { authorize, axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'f3-rendered.mjs';
const G = goldenJson('f3-edits.json');
const G1 = goldenJson('f1-edits.json');
const G2 = goldenJson('f2-edits.json');
const MODE = 'public';
const WIDTHS = [1280, 390];
const NON_TEXT = 3;
const MODIFIERS = ['ControlOrMeta', 'Shift'];
const SETTLE_MS = 500; // the options' border-color transition is --dur-med (250ms)
const SHOTS = path.join(repoRoot, '.tmp', 'tds-shots');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let checks = 0;

const rgb = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
const lum = (s) => { const c = rgb(s).slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// `scope` is the card or the form; everything is read from inside its day fieldset.
const measure = (page, scope) => page.evaluate((sel) => {
  const surface = (el) => { for (let n = el; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; const a = bg.match(/[\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0)) return bg; } return 'rgb(255, 255, 255)'; };
  const root = document.querySelector(sel);
  const fs = root?.querySelector('fieldset.nk-days') ?? null;
  const alerts = fs ? [...fs.querySelectorAll('[role="alert"]')] : [];
  const a = alerts[0] ?? null;
  const cs = a ? getComputedStyle(a) : null;
  const icon = a?.firstElementChild ?? null;
  return {
    found: Boolean(fs),
    invalid: fs ? fs.getAttribute('aria-invalid') : null,
    alerts: alerts.length,
    alert: a ? {
      color: cs.color,
      left: [cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor],
      others: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth],
      outline: [cs.outlineStyle, cs.outlineWidth],
      bg: surface(a),
      around: surface(a.parentElement),
      icon: icon ? { tag: icon.tagName, hidden: icon.getAttribute('aria-hidden'), text: icon.textContent, color: getComputedStyle(icon).color } : null,
      text: [...a.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join(''),
    } : null,
    options: fs ? [...fs.querySelectorAll('.nk-day')].map((o) => {
      const s = getComputedStyle(o);
      const input = o.querySelector('input');
      return { value: input?.value ?? null, checked: Boolean(input?.checked), disabled: Boolean(input?.disabled), colors: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor], bg: surface(o.parentElement) };
    }) : [],
  };
}, scope);

function expectError(m, at) {
  const T = G.token.rgb;
  if (!m.found) { failures.push(`${at}: no day fieldset (INFRA)`); return; }
  if (m.invalid !== 'true' || m.alerts !== 1 || !m.alert) { failures.push(`${at}: aria-invalid=${m.invalid}, ${m.alerts} alert(s); want "true" and 1 (E1)`); return; }
  const a = m.alert;
  if (a.color !== T) failures.push(`${at}: the alert text is ${a.color}, want ${T} (E1)`);
  if (a.left[0] !== '2px' || a.left[1] !== 'solid' || a.left[2] !== T) failures.push(`${at}: the alert's left border is ${a.left.join(' ')}, want 2px solid ${T} (E1)`);
  if (a.others.some((w) => w !== '0px')) failures.push(`${at}: the alert's top/right/bottom borders are ${a.others.join(' / ')}, want 0px each: no box outline (E1)`);
  if (a.outline[0] !== 'none' && a.outline[1] !== '0px') failures.push(`${at}: the alert has an outline ${a.outline.join(' ')} (E1)`);
  if (!a.icon || a.icon.tag !== 'SPAN' || a.icon.hidden !== 'true' || a.icon.text !== G.icon || a.icon.color !== T) failures.push(`${at}: the alert's leading sign is ${JSON.stringify(a.icon)}, want an aria-hidden SPAN holding ${JSON.stringify(G.icon)} in ${T} (E1)`);
  if (a.text !== G1.copy.chooseDay) failures.push(`${at}: the alert reads ${JSON.stringify(a.text)}, want "${G1.copy.chooseDay}" (E1)`);
  const tr = ratio(a.color, a.bg);
  if (tr < G.minContrast) failures.push(`${at}: alert text ${a.color} on ${a.bg} is ${tr.toFixed(2)}:1, want ${G.minContrast}:1 (E1)`);
  const br = ratio(a.left[2], a.around);
  if (br < NON_TEXT) failures.push(`${at}: alert border ${a.left[2]} on ${a.around} is ${br.toFixed(2)}:1, want ${NON_TEXT}:1 (E1)`);
  if (!m.options.length) failures.push(`${at}: no day options (INFRA)`);
  for (const o of m.options) {
    if (o.colors.some((c) => c !== T)) failures.push(`${at}: option ${o.value} borders ${o.colors.join(' / ')} in the invalid group, want ${T} on all four sides (E2)`);
    const r = ratio(o.colors[0], o.bg);
    if (r < NON_TEXT) failures.push(`${at}: option ${o.value} border on ${o.bg} is ${r.toFixed(2)}:1, want ${NON_TEXT}:1 (E2)`);
  }
}

function expectCleared(m, before, pick, at) {
  if (m.invalid !== 'false' || m.alerts) failures.push(`${at}: after choosing ${pick} aria-invalid=${m.invalid} with ${m.alerts} alert(s), want "false" and none (E4)`);
  for (const o of m.options) {
    if (o.value === pick) { if (o.colors[0] === G.token.rgb) failures.push(`${at}: the chosen option ${pick} still has the error border (E4)`); continue; }
    const was = before.find((b) => b.value === o.value);
    if (!was || o.colors.join() !== was.colors.join()) failures.push(`${at}: option ${o.value} borders ${o.colors.join(' / ')} after a day is picked, want the pre-error ${was ? was.colors.join(' / ') : '?'} (E4)`);
  }
}

async function axe(page, scope, at) {
  await page.addScriptTag({ path: axeSource() });
  const v = await page.evaluate(async (sel) => (await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`), scope);
  if (v.length) failures.push(`${at}: axe in the error state: ${v.join('; ')} (E3)`);
}

async function modifiedClicks(page, trigger, scope, at) {
  for (const mod of MODIFIERS) {
    await page.evaluate(() => { window.tdsPrevented = null; window.addEventListener('click', (e) => { window.tdsPrevented = e.defaultPrevented; }, { once: true }); });
    const start = page.url();
    const opened = page.context().waitForEvent('page', { timeout: 5000 }).catch(() => null);
    await page.locator(trigger).first().click({ modifiers: [mod] });
    const tab = await opened;
    if (tab) await tab.close();
    await page.waitForTimeout(SETTLE_MS);
    const prevented = await page.evaluate(() => window.tdsPrevented);
    if (prevented !== false) failures.push(`${at}: a ${mod}-click on Buy with no day was ${prevented === true ? 'intercepted (defaultPrevented)' : 'not seen'}, want it to pass through as a link (E5)`);
    if (page.url() !== start) failures.push(`${at}: a ${mod}-click on Buy moved the hub to ${page.url()} (E5)`);
    const m = await measure(page, scope);
    if (m.invalid === 'true' || m.alerts) failures.push(`${at}: a ${mod}-click on Buy with no day showed the error (E5)`);
  }
}

// One surface: open, record the options, trigger the error, measure it, choose the first open day, measure the reset.
async function run(page, url, scope, trigger, at, shotName, modified = false) {
  const r = await page.goto(url, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) { failures.push(`${at}: HTTP ${r ? r.status() : 0}`); return; }
  await page.evaluate(async () => { await document.fonts.ready; });
  const start = page.url();
  const before = await measure(page, scope);
  if (!before.found || !before.options.length) { failures.push(`${at}: no day picker (INFRA: is the Day Pass on sale?)`); return; }
  if (before.invalid === 'true' || before.alerts) failures.push(`${at}: an error shows before Buy / Continue (E4)`);
  if (before.options.some((o) => o.colors[0] === G.token.rgb)) failures.push(`${at}: an option has the error border before Buy / Continue (E4)`);
  if (modified) await modifiedClicks(page, trigger, scope, at);
  await page.locator(trigger).first().click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(SETTLE_MS);
  if (page.url() !== start) { failures.push(`${at}: Buy / Continue with no day moved to ${page.url()} (INFRA: F1/F2 behaviour)`); return; }
  expectError(await measure(page, scope), at);
  await axe(page, scope, at);
  await page.locator(scope).screenshot({ path: path.join(SHOTS, `f3-${shotName}-error.png`), animations: 'disabled' });
  const pick = before.options.find((o) => !o.disabled)?.value;
  if (!pick) { failures.push(`${at}: no enabled day to choose (INFRA)`); return; }
  await page.locator(`${scope} label:has(input[value="${pick}"])`).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(SETTLE_MS);
  expectCleared(await measure(page, scope), before.options, pick, at);
}

const srv = await serve(MODE);
if (srv.failures) failures.push(...srv.failures.map((f) => `${MODE}: ${f}`));
else {
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await authorize(ctx, srv);
      const posts = [];
      await ctx.route('**/api/tickets/checkout**', (route) => { posts.push(route.request().method()); return route.abort(); });
      const page = await ctx.newPage();
      checks += 1;
      const hubUrl = `${srv.origin}${G1.routes.hub}`;
      await run(page, hubUrl, 'article#ticket-day', 'article#ticket-day [data-ticket-cta]', `${MODE} ${G1.routes.hub} @${width}`, `${width}-hub`, true);
      await page.goto(hubUrl, { waitUntil: 'networkidle' });
      const slug = await page.evaluate(() => document.querySelector('article#ticket-day')?.dataset.ticketSlug ?? null);
      if (!slug) failures.push(`${MODE} @${width}: no Day Pass slug on the hub (INFRA)`);
      else {
        const form = 'form[data-nos-ticket-form]';
        await run(page, `${srv.origin}/tickets/${slug}?quantity=1`, form, `${form} button[type="submit"]`, `${MODE} /tickets/${slug}?quantity=1 @${width}`, `${width}-checkout`);
      }
      if (posts.length) failures.push(`${MODE} @${width}: ${posts.length} request(s) to /api/tickets/checkout were attempted (aborted) (E1)`);
      await ctx.close();
    }
  } catch (e) {
    failures.push(`render error: ${e && e.message ? e.message : e}`);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${checks} runs (${MODE}, ${WIDTHS.join('/')}), hub card and checkout: the "${G1.copy.chooseDay}" alert is ${G.token.rgb} text with a 2px left border and no outline, an aria-hidden ${G.icon} leads it, the invalid group's options take the same colour, contrast clears ${G.minContrast}:1 / ${NON_TEXT}:1, axe is clean, picking a day restores the options, and Ctrl/Meta- and Shift-clicks on Buy pass through. (Submit label: ${G2.submitLabel}.)`);
