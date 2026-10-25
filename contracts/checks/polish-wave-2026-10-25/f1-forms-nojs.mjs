// F1 rendered: with JavaScript disabled (what a visitor gets before hydration), typing PII-shaped
// values into each public form and submitting by Enter, and separately by a forced click, must
// never put a field value, or any query string, in the URL. Baseline: the forms are native GET and
// the URL fills up. Each gesture is its own fresh page load, so one cannot mask the other.
// Forms reached (the one inside <main>; the footer newsletter form is excluded, see goldens/README.md): /contact, /members (SAOC host); /vendors/apply and /vendors/register
// (code-entry gate, no session cookie) on the NOS host. SubmitEventForm sits behind a Firebase session and TicketPurchaseForm needs a Sanity ticket
// document, so both are covered by f1-forms-static.mjs only (declared limitation).
// Run as: node contracts/checks/polish-wave-2026-10-25/f1-forms-nojs.mjs   (needs a current build)
import { finish } from './_lib.mjs';
import { buildProblem, require, startServer } from './_server.mjs';

const failures = [];
const stale = buildProblem(['components/vendors/VendorApplyForm.tsx', 'components/contact/ContactForm.tsx']);
if (stale.length) finish('f1-forms-nojs', stale);

const { chromium } = require('playwright');
const TARGETS = [
  { host: 'localhost', path: '/contact' },
  { host: 'localhost', path: '/members' },
  { host: 'nos.localhost', path: '/vendors/apply' },
  { host: 'nos.localhost', path: '/vendors/register' },
];
const VIEWPORTS = [
  { width: 390, height: 844, dpr: 3 },
  { width: 768, height: 1024, dpr: 1 },
  { width: 1280, height: 800, dpr: 1 },
  { width: 1440, height: 900, dpr: 2 },
];
const SENTINEL = 'PIISENTINEL';
const FIELD_SELECTOR = 'input[name]:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]), textarea[name]';

const srv = await startServer();
const browser = await chromium.launch();

async function attempt(target, how, vp) {
  const label = `${vp.width}@${vp.dpr} ${target.host}${target.path} (${how})`;
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr });
  const page = await ctx.newPage();
  try {
    const resp = await page.goto(`http://${target.host}:${srv.port}${target.path}`, { waitUntil: 'load', timeout: 30000 });
    if (!resp || resp.status() !== 200) { failures.push(`${label}: HTTP ${resp ? resp.status() : 'none'}, want 200`); return; }
    const form = page.locator('main form').filter({ has: page.locator('input[name], textarea[name]') }).first();
    if ((await form.count()) === 0) { failures.push(`${label}: no form with named fields rendered (check cannot run)`); return; }
    const fields = form.locator(FIELD_SELECTOR);
    const n = await fields.count();
    let filled = 0;
    for (let i = 0; i < n; i++) {
      const el = fields.nth(i);
      const type = (await el.getAttribute('type')) ?? 'text';
      const value = type === 'email' ? `${SENTINEL}${i}@example.test` : `${SENTINEL}${i}`;
      try { await el.fill(value, { timeout: 2000 }); filled += 1; } catch { /* date and number types reject text */ }
    }
    if (filled < 1) { failures.push(`${label}: could not type into any field (check cannot run)`); return; }
    if (how === 'enter') {
      await fields.first().press('Enter');
    } else {
      const submit = form.locator('button[type=submit]').first();
      if ((await submit.count()) === 0) { failures.push(`${label}: no submit button rendered`); return; }
      await submit.click({ force: true, timeout: 3000, noWaitAfter: true }).catch(() => {});
    }
    await page.waitForTimeout(1000);
    const after = new URL(page.url());
    if (after.search !== '' || page.url().includes(SENTINEL)) {
      failures.push(`${label}: a no-JS submit left field data in the URL: ${page.url().slice(0, 140)}`);
    }
  } catch (e) {
    failures.push(`${label}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  } finally {
    await ctx.close();
  }
}

try {
  for (const t of TARGETS) {
    for (const vp of VIEWPORTS) {
      await attempt(t, 'enter', vp);
      await attempt(t, 'click', vp);
    }
  }
} finally {
  await browser.close();
  srv.stop();
}
finish('f1-forms-nojs', failures);
