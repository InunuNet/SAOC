// nos-form-errors (rFE) rendered: a fresh PUBLIC production build on live Sanity, next start 3010-3019 minus 3002, 3013 and 3016. QA
// input, hash-locked. Golden: goldens/edits.json. /contact and /members at 1280 and 390. POST /api/contact is fulfilled by a mock in
// the browser (page.route) and counted; it is never allowed through (a real send would email and write Firestore).
//   A  submit empty: no request; every field aria-invalid="true"; each aria-describedby token resolves to a visible element holding the
//      existing string (name/email/subject "All fields are required.", message the form's own 10-character string); the message also
//      describes itself with its hint ("Minimum 10 characters."); the error is a <p role="alert"> whose class ends with the shared
//      TicketFieldAlert class, text and left border rgb(155, 44, 44) (2px solid, 0px elsewhere, no outline), an aria-hidden sign first,
//      text 4.5:1 and border 3:1; the invalid inputs' four borders are the same colour; focus is on the first field; exactly one
//      role="alert" per invalid field and no form-level one; axe (WCAG 2.2 AA) clean.
//   B  valid except email "not-an-email": no request; only the email is invalid ("Invalid email address."), the others carry no
//      aria-invalid="true" and no error; focus on the email; one alert; axe clean.
//   C  email fixed: exactly one request with the golden body (the honeypot never sent), "Thank you" shown.
//   D  fresh load, all valid, mock replies 500 {error}: one request, one role="alert" (the form-level one, id cf-form-error / msf-form-error,
//      shared class, existing string), no field aria-invalid="true"; axe clean.
//   Element screenshots: <checkout>/.tmp/fe-shots/<form>-<width>-<empty|email>.png.
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { finish, goldenJson, repoRoot } from './_lib.mjs';
import { axeSource, require, serve } from './_server.mjs';

const { chromium } = require('playwright');
const NAME = 'rendered.mjs';
const G = goldenJson('edits.json');
const MODE = 'public';
const WIDTHS = [1280, 390];
const SETTLE_MS = 400;
const SHOTS = path.join(repoRoot, '.tmp', 'fe-shots');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
let runs = 0;

const rgb = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
const lum = (s) => { const c = rgb(s).slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const expectedText = (kind) => G.strings[kind].text;

// Everything the checks read, in one pass: per field the input's state and its describedby targets, plus the form's alerts and focus.
async function snapshot(page, F) {
  const m = await page.evaluate(({ sel, fields }) => {
    const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const surface = (el) => { for (let n = el; n; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; const a = bg.match(/[\d.]+/g); if (a && (a.length < 4 || Number(a[3]) > 0)) return bg; } return 'rgb(255, 255, 255)'; };
    const alertInfo = (a) => {
      const cs = getComputedStyle(a);
      const icon = a.firstElementChild;
      return {
        id: a.id, tag: a.tagName, className: a.getAttribute('class') ?? '', color: cs.color, left: [cs.borderLeftWidth, cs.borderLeftStyle, cs.borderLeftColor],
        others: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth], outline: [cs.outlineStyle, cs.outlineWidth], bg: surface(a), around: surface(a.parentElement),
        icon: icon ? { tag: icon.tagName, hidden: icon.getAttribute('aria-hidden'), color: getComputedStyle(icon).color } : null,
        text: [...a.childNodes].filter((n) => !(n.nodeType === 1 && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join('').trim(),
        visible: visible(a),
      };
    };
    const root = document.querySelector(sel);
    const alerts = root ? [...root.querySelectorAll('[role="alert"]')] : [];
    return {
      found: Boolean(root),
      focus: document.activeElement ? document.activeElement.id : null,
      alerts: alerts.map(alertInfo),
      fields: fields.map((f) => {
        const el = document.getElementById(f.id);
        const tokens = (el?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
        const cs = el ? getComputedStyle(el) : null;
        return {
          id: f.id, present: Boolean(el), invalid: el ? el.getAttribute('aria-invalid') : null, tokens,
          targets: tokens.map((t) => { const n = document.getElementById(t); return { id: t, found: Boolean(n), visible: visible(n), text: n ? n.textContent.trim() : '', isAlert: Boolean(n && n.getAttribute('role') === 'alert') }; }),
          borders: cs ? [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor] : [],
        };
      }),
    };
  }, { sel: F.form, fields: F.fields });
  return m;
}

function expectAlertStyle(a, at) {
  const T = G.token.rgb;
  if (a.tag !== 'P') failures.push(`${at}: the alert is a <${a.tag}>, want <p role="alert"> (shared TicketFieldAlert)`);
  if (!a.className.endsWith(G.alertClass)) failures.push(`${at}: the alert's class is ${JSON.stringify(a.className)}, want one ending with the shared TicketFieldAlert class`);
  if (a.color !== T) failures.push(`${at}: the alert text is ${a.color}, want ${T}`);
  if (a.left[0] !== '2px' || a.left[1] !== 'solid' || a.left[2] !== T) failures.push(`${at}: the alert's left border is ${a.left.join(' ')}, want 2px solid ${T}`);
  if (a.others.some((w) => w !== '0px')) failures.push(`${at}: the alert's top/right/bottom borders are ${a.others.join(' / ')}, want 0px each`);
  if (a.outline[0] !== 'none' && a.outline[1] !== '0px') failures.push(`${at}: the alert has an outline ${a.outline.join(' ')}`);
  if (!a.icon || a.icon.tag !== 'SPAN' || a.icon.hidden !== 'true' || a.icon.color !== T) failures.push(`${at}: the alert's leading sign is ${JSON.stringify(a.icon)}, want an aria-hidden SPAN in ${T}`);
  if (!a.visible) failures.push(`${at}: the alert is not visible`);
  const tr = ratio(a.color, a.bg);
  if (tr < G.minContrast) failures.push(`${at}: alert text ${a.color} on ${a.bg} is ${tr.toFixed(2)}:1, want ${G.minContrast}:1`);
  const br = ratio(a.left[2], a.around);
  if (br < G.nonText) failures.push(`${at}: alert border ${a.left[2]} on ${a.around} is ${br.toFixed(2)}:1, want ${G.nonText}:1`);
}

async function axe(page, form, at) {
  if (!(await page.locator(form).count())) { failures.push(`${at}: the form is gone, axe cannot run`); return; }
  await page.addScriptTag({ path: axeSource() });
  const v = await page.evaluate(async (sel) => (await window.axe.run(sel, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).join(', ')}`), form);
  if (v.length) failures.push(`${at}: axe: ${v.join('; ')}`);
}

// Which field ids must be invalid, and the text each error must hold.
function expectInvalid(m, F, want, at) {
  const T = G.token.rgb;
  const invalidIds = F.fields.filter((f) => want[f.id]).map((f) => f.id);
  const alertsHere = m.alerts.length;
  if (alertsHere !== invalidIds.length) failures.push(`${at}: ${alertsHere} role="alert" element(s) in the form, want exactly ${invalidIds.length} (one per invalid field)`);
  for (const fld of m.fields) {
    const f = F.fields.find((x) => x.id === fld.id);
    if (!fld.present) { failures.push(`${at}: #${fld.id} is missing`); continue; }
    if (!want[fld.id]) {
      if (fld.invalid === 'true') failures.push(`${at}: #${fld.id} is aria-invalid="true" but its value is valid`);
      if (fld.tokens.includes(f.errorId)) failures.push(`${at}: #${fld.id} still points at ${f.errorId} though valid`);
      if (m.alerts.some((a) => a.id === f.errorId)) failures.push(`${at}: ${f.errorId} still shows though #${fld.id} is valid`);
      if (f.hintId && !fld.tokens.includes(f.hintId)) failures.push(`${at}: #${fld.id} lost its hint ${f.hintId} in aria-describedby`);
      continue;
    }
    if (fld.invalid !== 'true') failures.push(`${at}: #${fld.id} aria-invalid=${fld.invalid}, want "true"`);
    if (!fld.tokens.includes(f.errorId)) failures.push(`${at}: #${fld.id} aria-describedby ${JSON.stringify(fld.tokens)} lacks ${f.errorId}`);
    if (f.hintId && !fld.tokens.includes(f.hintId)) failures.push(`${at}: #${fld.id} aria-describedby ${JSON.stringify(fld.tokens)} lacks its hint ${f.hintId}`);
    for (const t of fld.targets) {
      if (!t.found || !t.visible || t.text === '') failures.push(`${at}: #${fld.id} aria-describedby token ${t.id} does not resolve to visible text (found ${t.found}, visible ${t.visible}, text ${JSON.stringify(t.text)})`);
      if (t.id === f.hintId && t.text !== G.strings.hint.text) failures.push(`${at}: the hint ${t.id} reads ${JSON.stringify(t.text)}, want ${JSON.stringify(G.strings.hint.text)}`);
    }
    const err = m.alerts.find((a) => a.id === f.errorId);
    if (!err) { failures.push(`${at}: no role="alert" element with id ${f.errorId}`); continue; }
    const wantText = want[fld.id];
    if (err.text !== wantText) failures.push(`${at}: ${f.errorId} reads ${JSON.stringify(err.text)}, want ${JSON.stringify(wantText)} (an existing string)`);
    expectAlertStyle(err, `${at} ${f.errorId}`);
    if (fld.borders.some((c) => c !== T)) failures.push(`${at}: #${fld.id} borders ${fld.borders.join(' / ')} while invalid, want ${T} on all four sides (handoff styles.css .field.is-error, in the --color-error token)`);
  }
}

async function fill(page, F, skip = {}) {
  for (const f of F.fields) await page.locator(`#${f.id}`).fill(skip[f.id] ?? f.valid);
}

async function openForm(ctx, srv, F, mock) {
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/api/contact', async (route) => {
    posts.push(route.request().postData());
    await route.fulfill(mock);
  });
  const r = await page.goto(`${srv.origin}${F.route}`, { waitUntil: 'networkidle' });
  if (!r || r.status() !== 200) failures.push(`${F.route}: HTTP ${r ? r.status() : 0} (INFRA)`);
  return { page, posts };
}

async function runForm(browser, srv, key, width) {
  const F = G.forms[key];
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const at = `${MODE} ${F.route} @${width}`;
  try {
    // A, B, C on one page.
    const ok = { status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true }) };
    const { page, posts } = await openForm(ctx, srv, F, ok);
    await page.evaluate(async () => { await document.fonts.ready; });
    const submit = page.getByRole('button', { name: F.submit });
    const form = page.locator(F.form);
    if (!(await form.count())) { failures.push(`${at}: no form ${F.form} (INFRA)`); return; }

    await submit.click();
    await page.waitForTimeout(SETTLE_MS);
    let m = await snapshot(page, F);
    const wantA = Object.fromEntries(F.fields.map((f) => [f.id, expectedText(f.empty)]));
    expectInvalid(m, F, wantA, `${at} A(empty)`);
    if (m.focus !== F.fields[0].id) failures.push(`${at} A(empty): focus is on #${m.focus}, want the first invalid field #${F.fields[0].id}`);
    if (posts.length) failures.push(`${at} A(empty): ${posts.length} request(s) sent though the client guard failed`);
    await axe(page, F.form, `${at} A(empty)`);
    await form.screenshot({ path: path.join(SHOTS, `${key}-${width}-empty.png`), animations: 'disabled' });

    await fill(page, F, { [F.fields.find((f) => f.bad).id]: 'not-an-email' });
    await submit.click();
    await page.waitForTimeout(SETTLE_MS);
    m = await snapshot(page, F);
    const emailField = F.fields.find((f) => f.bad);
    expectInvalid(m, F, { [emailField.id]: G.strings.invalidEmail.text }, `${at} B(bad email)`);
    if (m.focus !== emailField.id) failures.push(`${at} B(bad email): focus is on #${m.focus}, want #${emailField.id}`);
    if (posts.length) failures.push(`${at} B(bad email): ${posts.length} request(s) sent though the email is malformed`);
    await axe(page, F.form, `${at} B(bad email)`);
    await form.screenshot({ path: path.join(SHOTS, `${key}-${width}-email.png`), animations: 'disabled' });

    await page.locator(`#${emailField.id}`).fill(emailField.valid);
    await submit.click();
    await page.getByText('Thank you').waitFor({ state: 'visible', timeout: 5000 }).catch(() => failures.push(`${at} C: "Thank you" never appeared after a valid submit`));
    if (posts.length !== 1) failures.push(`${at} C: ${posts.length} request(s), want exactly 1`);
    else if (JSON.stringify(JSON.parse(posts[0])) !== JSON.stringify(F.body)) failures.push(`${at} C: request body ${posts[0]}, want ${JSON.stringify(F.body)}`);
    await page.close();

    // D: a non-OK reply is a form-level alert, not a field error.
    const bad = { status: 500, contentType: 'application/json', body: JSON.stringify({ error: G.strings.serverError.text }) };
    const d = await openForm(ctx, srv, F, bad);
    await fill(d.page, F);
    await d.page.getByRole('button', { name: F.submit }).click();
    await d.page.waitForTimeout(SETTLE_MS);
    const md = await snapshot(d.page, F);
    if (d.posts.length !== 1) failures.push(`${at} D(500): ${d.posts.length} request(s), want exactly 1`);
    if (md.alerts.length !== 1 || md.alerts[0].id !== F.formErrorId) failures.push(`${at} D(500): alerts ${JSON.stringify(md.alerts.map((a) => a.id))}, want only ${F.formErrorId}`);
    else {
      if (md.alerts[0].text !== G.strings.serverError.text) failures.push(`${at} D(500): the form-level alert reads ${JSON.stringify(md.alerts[0].text)}, want ${JSON.stringify(G.strings.serverError.text)}`);
      expectAlertStyle(md.alerts[0], `${at} D(500) ${F.formErrorId}`);
    }
    if (md.fields.some((f) => f.invalid === 'true')) failures.push(`${at} D(500): a field is aria-invalid="true" after a server error`);
    await axe(d.page, F.form, `${at} D(500)`);
    runs += 1;
  } catch (e) {
    failures.push(`${at}: render error: ${e && e.message ? e.message : e}`);
  } finally {
    await ctx.close();
  }
}

const srv = await serve(MODE);
if (srv.failures) failures.push(...srv.failures.map((f) => `${MODE}: ${f}`));
else {
  const browser = await chromium.launch();
  try {
    for (const width of WIDTHS) for (const key of Object.keys(G.forms)) await runForm(browser, srv, key, width);
  } finally {
    await browser.close();
    await srv.stop();
  }
}

finish(NAME, failures, `${runs} runs (${MODE}, ${WIDTHS.join('/')}, /contact and /members): empty and bad-email submits send nothing, mark exactly the invalid fields aria-invalid with aria-describedby on visible existing-string errors in the shared ${G.token.rgb} TicketFieldAlert, focus the first invalid field, axe is clean; the valid submit posts the golden body; a 500 reply is one form-level alert.`);
