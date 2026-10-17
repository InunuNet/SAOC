#!/usr/bin/env node
// F7b-B2 - vendor apply form in a real browser. Every POST to /api/vendors/apply is intercepted and fulfilled by the
// check itself: nothing ever reaches the live endpoint or Firestore.
import { BASE, GOLDEN_DIR, readJson, withBrowser, open, runAxe, report } from './_lib.mjs';

const copy = readJson(`${GOLDEN_DIR}/vendor-apply-copy.json`);
const problems = [];
const ID = (k) => `#vendor-register-${k}`;
const REQUIRED = ['businessName', 'contactPersonName', 'contactEmail', 'contactCellPhone', 'vendorCategory', 'indicativeBoothCount'];

await withBrowser(async (ctx) => {
  const page = await ctx.newPage();
  const posts = [];
  await page.route('**/api/vendors/apply', async (route) => {
    posts.push(route.request().postData());
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, id: 'f7-check' }) });
  });
  await open(page, '/national-show/vendors/apply');
  await page.waitForSelector('main form', { timeout: 15_000 }); // vendors/loading.tsx shows first
  const submit = page.getByRole('button', { name: /submit application/i });

  // copy, labels, attributes
  const text = await page.locator('main').innerText();
  if (text.split(copy.requiredSentence).length !== 2) problems.push(`sentence "${copy.requiredSentence}" must appear exactly once`);
  for (const k of [...REQUIRED, 'tradingName']) {
    // R82 (nos-critique-r6 f3) supersedes launch-weekend F7: no "(required)" suffix; the optional field's label says so itself.
    const want = k === 'tradingName' ? 'Trading name (if different, optional)' : null;
    const labelText = await page.evaluate((id) => {
      const el = document.getElementById(id);
      const l = el && el.tagName === 'FIELDSET' ? el.querySelector('legend') : document.querySelector(`label[for="${id}"]`);
      return l ? l.textContent : null;
    }, `vendor-register-${k}`);
    if (!labelText) problems.push(`${k}: no label/legend`);
    else if (want && labelText.trim() !== want) problems.push(`${k}: label/legend "${labelText}" is not exactly "${want}"`);
    else if (/\(required\)/.test(labelText) || /\) \(/.test(labelText)) problems.push(`${k}: label/legend "${labelText}" carries a "(required)" suffix or ") ("`);
  }
  const attrs = await page.evaluate(() => Object.fromEntries(['businessName', 'contactPersonName', 'contactEmail', 'contactCellPhone', 'indicativeBoothCount'].map((k) => {
    const e = document.getElementById(`vendor-register-${k}`);
    return [k, { ac: e.getAttribute('autocomplete'), type: e.type, im: e.getAttribute('inputmode'), min: e.getAttribute('min') }];
  })));
  for (const [k, want] of Object.entries({ businessName: 'organization', contactPersonName: 'name', contactEmail: 'email', contactCellPhone: 'tel' })) if (attrs[k].ac !== want) problems.push(`${k}: autocomplete="${attrs[k].ac}" (want ${want})`);
  const b = attrs.indicativeBoothCount;
  if (b.type !== 'number' || b.im !== 'numeric' || b.min !== '1') problems.push(`stands field: type=${b.type} inputmode=${b.im} min=${b.min} (want number/numeric/1)`);

  // border contrast >= 3:1 and button height >= 48
  const contrast = await page.evaluate(() => {
    const parse = (c) => c.match(/[\d.]+/g).map(Number);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.99) return c; } return [255, 255, 255]; };
    const els = [...document.querySelectorAll('form input[type="text"], form input[type="email"], form input[type="tel"], form input[type="number"], form input[type="checkbox"]')].filter((e) => e.name !== '_hp');
    return els.filter((e) => e.type !== 'checkbox' || getComputedStyle(e).appearance === 'none').map((e) => {
      // a native checkbox (appearance auto) is a user-agent control, exempt from 1.4.11 and computes border-width 0
      const cs = getComputedStyle(e); const bc = parse(cs.borderTopColor); const bg = bgOf(e);
      const [a, c] = [L(bc), L(bg)];
      return { id: e.id, width: parseFloat(cs.borderTopWidth), ratio: (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) };
    });
  });
  for (const c of contrast) if (c.width < 1 || c.ratio < 3) problems.push(`${c.id}: border ${c.width}px at ${c.ratio.toFixed(2)}:1 (needs >=3:1, WCAG 1.4.11)`);
  const sb = await submit.boundingBox();
  if (!sb || sb.height < 48) problems.push(`submit button height ${sb ? sb.height : 'n/a'}px (R32: >= 48)`);
  const boxes = await page.locator('form input[type="checkbox"]').evaluateAll((els) => els.map((e) => { const r = (e.closest('label') || e).getBoundingClientRect(); return [r.width, r.height]; }));
  if (boxes.some(([w, h]) => w < 24 || h < 24)) problems.push('a category checkbox hit area is under 24x24 (WCAG 2.5.8)');

  // 1. empty submit: no POST, summary focused, per-field wiring
  await submit.click();
  await page.waitForTimeout(300);
  if (posts.length) problems.push(`empty submit sent ${posts.length} POST(s) to /api/vendors/apply`);
  const summary = await page.evaluate(() => {
    const a = document.querySelector('form [role="alert"]');
    return a ? { focused: a === document.activeElement || a.contains(document.activeElement) || a.parentElement === document.activeElement, links: [...a.querySelectorAll('a[href^="#vendor-register-"]')].map((l) => l.getAttribute('href').slice(1)), text: a.textContent.trim() } : null;
  });
  if (!summary) problems.push('no role="alert" error summary after an invalid submit');
  else {
    if (!summary.focused) problems.push('error summary is not focused after an invalid submit');
    for (const k of REQUIRED) if (!summary.links.includes(`vendor-register-${k}`)) problems.push(`error summary has no link to ${k}`);
  }
  if (!(await page.locator(ID('businessName')).count())) { problems.push('the empty submit replaced the form (it was accepted as a success): client validation is missing'); return; }
  for (const k of REQUIRED) {
    const w = await page.evaluate((id) => {
      const e = document.getElementById(id);
      const ids = (e.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      return { invalid: e.getAttribute('aria-invalid'), texts: ids.map((i) => (document.getElementById(i) || {}).textContent || '').filter((t) => t.trim()) };
    }, `vendor-register-${k}`);
    if (w.invalid !== 'true') problems.push(`${k}: aria-invalid is "${w.invalid}" after an invalid submit`);
    if (!w.texts.length) problems.push(`${k}: aria-describedby does not point to a non-empty inline error`);
  }
  const optional = await page.evaluate(() => document.getElementById('vendor-register-tradingName').getAttribute('aria-invalid'));
  if (optional === 'true') problems.push('tradingName (optional) was flagged invalid');
  const errState = await runAxe(page);
  for (const v of errState) if (v.impact === 'serious' || v.impact === 'critical' || v.id === 'aria-allowed-attr') problems.push(`axe (error state): ${v.impact} ${v.id} ${v.nodes.map((n) => n.target).join(', ').slice(0, 120)}`);

  // 2. partly filled and invalid: values kept, still no POST
  await page.locator(ID('businessName')).fill('Test Orchid Traders');
  await page.locator(ID('contactEmail')).fill('nope');
  await page.locator(ID('contactCellPhone')).fill('12');
  await page.locator(ID('indicativeBoothCount')).pressSequentially('0');
  await submit.click();
  await page.waitForTimeout(300);
  if (posts.length) problems.push(`invalid submit sent ${posts.length} POST(s)`);
  for (const [k, v] of [['businessName', 'Test Orchid Traders'], ['contactEmail', 'nope'], ['contactCellPhone', '12'], ['indicativeBoothCount', '0']]) {
    if ((await page.locator(ID(k)).inputValue()) !== v) problems.push(`${k}: value not kept after a failed submit`);
  }
  for (const [k, re] of [['contactEmail', /email/i], ['contactCellPhone', /phone/i]]) {
    const t = await page.evaluate((id) => (document.getElementById(id).getAttribute('aria-describedby') || '').split(/\s+/).map((i) => (document.getElementById(i) || {}).textContent || '').join(' '), `vendor-register-${k}`);
    if (!re.test(t)) problems.push(`${k}: inline error "${t.trim()}" does not mention the problem`);
  }

  // 3. valid submit posts exactly once with the unchanged payload shape
  await page.locator(ID('businessName')).fill('Test Orchid Traders');
  await page.locator(ID('contactPersonName')).fill('Jane Test');
  await page.locator(ID('contactEmail')).fill('jane.test@example.com');
  await page.locator(ID('contactCellPhone')).fill('0821234567');
  await page.locator(ID('indicativeBoothCount')).fill('2');
  await page.locator(`${ID('vendorCategory')} input[type="checkbox"]`).first().check();
  await submit.click();
  await page.waitForTimeout(600);
  if (posts.length !== 1) problems.push(`valid submit sent ${posts.length} POST(s) (want exactly 1)`);
  else {
    const body = JSON.parse(posts[0]);
    if (body.businessName !== 'Test Orchid Traders' || body.contactEmail !== 'jane.test@example.com' || body.indicativeBoothCount !== 2 || !Array.isArray(body.vendorCategory) || body.vendorCategory.length !== 1) problems.push(`payload shape changed: ${posts[0].slice(0, 200)}`);
  }
  if (!(await page.getByText('Thank you').count())) problems.push('success state not shown after a valid submit');
}, { width: 1280, height: 1600 });
report(problems, `vendor apply form validates client-side, announces and focuses errors, keeps values, and posts once when valid at ${BASE}`);
