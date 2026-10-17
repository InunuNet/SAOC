// nos-critique-r6 F3 — rendered check for R82 on /national-show/vendors/apply (production build, next start 3010-3019).
// At 390 and 1280:
//   INTRO   "All fields are required unless marked optional." is present
//   LABELS  no "(required)" text; no label contains ") ("; the Trading name label is exactly "Trading name (if different, optional)"; required inputs keep `required` and carry aria-required="true"; every label / legend of the 7 fields has the
//           nos-form-label class and computes Karla 14px / 500, colour = --ink, letter-spacing 0, no uppercase, opacity 1
//   AUTO    autocomplete: businessName organization, tradingName organization, contactPersonName name, contactEmail email,
//           contactCellPhone tel; stands inputmode numeric
//   PAYLOAD driving the real form with /api/vendors/apply stubbed, the POST body equals goldens/vendor-apply-payload.json
//           (case A all fields, case B blank trading name), key order included
//   REG     the label class is shared: all the form labels compute identical typography
//   C4      no horizontal overflow
// Run as: node check-rendered-f3.mjs   (NOS_CR6_ROOT selects the worktree)
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { finish, scopeFiles, specDir } from './_lib.mjs';
import { AUTH, assertFreshBuild, require, startServer } from './_server.mjs';

const NAME = 'check-rendered-f3.mjs';
const failures = [];
const { chromium } = require('playwright');
const gold = JSON.parse(readFileSync(path.join(specDir, 'goldens', 'vendor-apply-payload.json'), 'utf8'));
const ROUTE = '/national-show/vendors/apply';
const FIELDS = ['businessName', 'tradingName', 'contactPersonName', 'contactEmail', 'contactCellPhone', 'vendorCategory', 'indicativeBoothCount'];
const AUTO = { businessName: 'organization', tradingName: 'organization', contactPersonName: 'name', contactEmail: 'email', contactCellPhone: 'tel' };

const stale = assertFreshBuild(scopeFiles());
if (stale.length > 0) finish(NAME, stale);

const measure = (fields) => {
  const probe = document.createElement('span');
  probe.style.color = 'var(--ink)';
  document.querySelector('.nos-theme').appendChild(probe);
  const ink = getComputedStyle(probe).color;
  probe.remove();
  const labelFor = (key) => {
    const el = document.getElementById(`vendor-register-${key}`);
    if (!el) return null;
    const node = el instanceof HTMLFieldSetElement ? el.querySelector('legend') : document.querySelector(`label[for="vendor-register-${key}"]`);
    if (!node) return null;
    const cs = getComputedStyle(node);
    return { text: node.textContent.trim(), cls: node.className, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, ls: cs.letterSpacing, tt: cs.textTransform, op: cs.opacity, fam: cs.fontFamily, auto: el.getAttribute('autocomplete'), req: el.hasAttribute('required'), ariaReq: el.getAttribute('aria-required'), inputmode: el.getAttribute('inputmode') };
  };
  return { ink, labels: Object.fromEntries(fields.map((k) => [k, labelFor(k)])), body: document.querySelector('form')?.textContent ?? '', sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
};

let browser;
let stop = () => {};
try {
  const srv = await startServer();
  stop = srv.stop;
  browser = await chromium.launch();
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, extraHTTPHeaders: { authorization: AUTH } });
    const page = await ctx.newPage();
    const res = await page.goto(`${srv.origin}${ROUTE}`, { waitUntil: 'networkidle' });
    const tag = `${ROUTE} @${vp.width}`;
    if (!res || res.status() !== 200) { failures.push(`${tag}: HTTP ${res && res.status()}`); await ctx.close(); continue; }
    const m = await page.evaluate(measure, FIELDS);
    if (!m.body.includes('All fields are required unless marked optional.')) failures.push(`${tag}: intro sentence missing`);
    if (/\(required\)/.test(m.body)) failures.push(`${tag}: a "(required)" suffix is still rendered`);
    for (const key of FIELDS) { const l = m.labels[key]; if (l && /\) \(/.test(l.text)) failures.push(`${tag}: ${key} label "${l.text}" contains ") ("`); }
    if (m.labels.tradingName && m.labels.tradingName.text !== 'Trading name (if different, optional)') failures.push(`${tag}: Trading name label is "${m.labels.tradingName.text}", want exactly "Trading name (if different, optional)"`);
    for (const key of ['businessName', 'contactPersonName', 'contactEmail', 'contactCellPhone', 'indicativeBoothCount']) {
      const l = m.labels[key];
      if (l && (!l.req || l.ariaReq !== 'true')) failures.push(`${tag}: ${key} must keep required and aria-required="true" (required ${l.req}, aria-required ${l.ariaReq})`);
    }
    const sig = new Set();
    for (const key of FIELDS) {
      const l = m.labels[key];
      if (!l) { failures.push(`${tag}: no label/legend for ${key}`); continue; }
      if (!/\bnos-form-label\b/.test(l.cls)) failures.push(`${tag}: ${key} label lacks the nos-form-label class`);
      if (l.size !== '14px') failures.push(`${tag}: ${key} label ${l.size}, want 14px`);
      if (l.weight !== '500') failures.push(`${tag}: ${key} label weight ${l.weight}, want 500`);
      if (l.color !== m.ink) failures.push(`${tag}: ${key} label colour ${l.color}, want full ink ${m.ink}`);
      if (!(l.ls === 'normal' || parseFloat(l.ls) === 0)) failures.push(`${tag}: ${key} label letter-spacing ${l.ls}, want 0`);
      if (l.tt === 'uppercase') failures.push(`${tag}: ${key} label is uppercase`);
      if (l.op !== '1') failures.push(`${tag}: ${key} label opacity ${l.op}`);
      if (!/karla/i.test(l.fam)) failures.push(`${tag}: ${key} label family ${l.fam}, want Karla`);
      if (key in AUTO && l.auto !== AUTO[key]) failures.push(`${tag}: ${key} autocomplete ${l.auto}, want ${AUTO[key]}`);
      if (key === 'indicativeBoothCount' && l.inputmode !== 'numeric') failures.push(`${tag}: stands inputmode ${l.inputmode}, want numeric`);
      sig.add([l.size, l.weight, l.color, l.ls, l.fam].join('|'));
    }
    if (sig.size > 1) failures.push(`${tag}: labels do not share one typography: ${[...sig].join(' / ')}`);
    if (m.sw > m.cw) failures.push(`${tag}: horizontal overflow ${m.sw} > ${m.cw}`);

    if (vp.width === 1280) {
      for (const [name, withTrading] of [['caseA', true], ['caseB', false]]) {
        await page.goto(`${srv.origin}${ROUTE}`, { waitUntil: 'networkidle' });
        let posted = null;
        await page.route('**/api/vendors/apply', async (route) => {
          posted = route.request().postData();
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, id: 'check' }) });
        });
        const i = gold.inputs;
        await page.fill('#vendor-register-businessName', i.businessName);
        if (withTrading) await page.fill('#vendor-register-tradingName', i.tradingName);
        await page.fill('#vendor-register-contactPersonName', i.contactPersonName);
        await page.fill('#vendor-register-contactEmail', i.contactEmail);
        await page.fill('#vendor-register-contactCellPhone', i.contactCellPhone);
        const boxes = await page.$$eval('#vendor-register-vendorCategory input[type="checkbox"]', (els) => els.map((e) => e.value));
        const want = withTrading ? [boxes[0], boxes[1]] : [boxes[0]];
        for (const v of want) await page.check(`#vendor-register-vendorCategory input[value="${v}"]`);
        await page.fill('#vendor-register-indicativeBoothCount', i.stands);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(800);
        const expected = JSON.stringify(JSON.parse(JSON.stringify(gold[name]).replace('$CAT1', want[0]).replace('$CAT2', want[1] ?? '')));
        if (posted === null) failures.push(`${name}: the form did not POST to /api/vendors/apply`);
        else if (posted !== expected) failures.push(`${name}: POST body changed.\n    want ${expected}\n    got  ${posted}`);
        await page.unroute('**/api/vendors/apply');
      }
    }
    await ctx.close();
  }
} catch (err) {
  failures.push(`${err.name}: ${err.message}`);
} finally {
  if (browser) await browser.close();
  stop();
}
finish(NAME, failures, 'R82 rendered: no "(required)", one "(optional)", every label Karla 14px/500 in full ink with the nos-form-label class, autocomplete and stands inputmode set, POST body identical to the recorded payload, no overflow at 390 and 1280.');
