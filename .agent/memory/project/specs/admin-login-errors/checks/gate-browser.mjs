// Browser gate on the production build (run build.sh first). /admin/login at 1280 and 390: screenshots, the Forgot control,
// the empty-email prompt, identical reset text for success and user-not-found, plain sign-in errors. Every Firebase call is
// mocked or aborted, so nothing is written or sent. Screenshots land in .tmp/sandbox/admin-login-gate/ for the report.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, openSync, readFileSync } from 'node:fs';

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('@playwright/test');
const copy = JSON.parse(readFileSync('.agent/memory/project/specs/admin-login-errors/goldens/copy.json', 'utf8'));
const PORT = Number(process.env.ADMIN_LOGIN_PORT ?? 3071);
const BASE = `http://localhost:${PORT}`;
const OUT = '.tmp/sandbox/admin-login-gate';
mkdirSync(OUT, { recursive: true });
const log = openSync(`${OUT}/next-start.log`, 'w');
const env = { ...process.env, NODE_ENV: 'production', BETA_BASIC_AUTH_USER: 'sandbox', BETA_BASIC_AUTH_PASSWORD: 'sandbox-pass', SITE_PUBLIC_LAUNCH: '' };
delete env.BETA_PASSWORD_WALL_OFF;
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], { stdio: ['ignore', log, log], env });
const failures = [];
const check = (n, ok, d = '') => { if (!ok) failures.push(`${n}${d ? `: ${d}` : ''}`); };
const fbError = (message) => ({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message, errors: [{ message }] } }) });

async function waitReady() {
  for (let i = 0; i < 90; i += 1) {
    try { const r = await fetch(`${BASE}/admin/login`, { headers: { authorization: `Basic ${Buffer.from('sandbox:sandbox-pass').toString('base64')}` } }); if (r.status < 500) return; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never became ready');
}

async function run() {
  await waitReady();
  const browser = await chromium.launch();
  try {
    for (const vp of [{ name: '1280', width: 1280, height: 900, dsf: 1 }, { name: '390', width: 390, height: 844, dsf: 3 }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dsf, httpCredentials: { username: 'sandbox', password: 'sandbox-pass' } });
      const page = await ctx.newPage();
      const tag = `[${vp.name}]`;
      let resetOutcome = 'ok';
      let resetDelayMs = 0;
      let oobPosts = 0;
      const external = [];
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
        const url = route.request().url();
        if (/identitytoolkit\.googleapis\.com/.test(url)) {
          if (/accounts:sendOobCode/.test(url)) { oobPosts += 1; if (resetDelayMs) await new Promise((r) => setTimeout(r, resetDelayMs)); }
          if (/accounts:sendOobCode/.test(url)) return resetOutcome === 'ok' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'x@y.z' }) }) : route.fulfill(fbError('EMAIL_NOT_FOUND'));
          if (/accounts:signInWithPassword/.test(url)) return route.fulfill(fbError('INVALID_LOGIN_CREDENTIALS'));
        }
        external.push(url);
        return route.abort();
      });
      await page.goto(`${BASE}/admin/login`, { waitUntil: 'load' });
      const ALERT = '[role="alert"]:not([id^="__next-route-announcer"])';
      const stripGlyph = (t) => t.replace(/^⚠︎?\s*/, '').trim();
      let signInPosts = 0;
      page.on('request', (r) => { if (/accounts:signInWithPassword/.test(r.url())) signInPosts += 1; });
      const forgot = page.getByTestId('admin-forgot-password');
      check(`${tag} Forgot password? control visible with exact label`, (await forgot.count()) === 1 && (await forgot.innerText()).trim() === 'Forgot password?');
      check(`${tag} control is a type=button with the existing inline-link treatment`, (await forgot.getAttribute('type')) === 'button' && /\binline-link\b/.test((await forgot.getAttribute('class')) ?? ''));
      const geom = await page.evaluate(() => {
        const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height }; };
        const btn = document.querySelector('[data-testid="admin-forgot-password"]');
        return { pw: r(document.querySelector('#password')), btn: r(btn), fontSize: parseFloat(getComputedStyle(btn).fontSize), underline: getComputedStyle(btn).textDecorationLine };
      });
      const gap = geom.btn.top - geom.pw.bottom;
      check(`${tag} control sits 0-8px below the password field`, gap >= -0.5 && gap <= 8.5, String(gap));
      check(`${tag} control is right-aligned with the field`, Math.abs(geom.btn.right - geom.pw.right) <= 1, JSON.stringify(geom));
      check(`${tag} control box at least 44px tall, from padding not font size`, geom.btn.height >= 44 && geom.fontSize <= 16, JSON.stringify(geom));
      check(`${tag} control is underlined like the footer inline link`, geom.underline.includes('underline'), geom.underline);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${tag} no horizontal overflow`, overflow <= 1, String(overflow));
      await page.screenshot({ path: `${OUT}/login-${vp.name}.png`, fullPage: true });
      await forgot.focus();
      const ring = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
      check(`${tag} visible focus ring on the control`, ring.style !== 'none' && ring.width > 0, JSON.stringify(ring));

      // Empty email: inline error on the Email field, focus on Email.
      await forgot.click();
      const empty = await page.evaluate(() => { const e = document.querySelector('#email'); return { active: document.activeElement?.id, invalid: e?.getAttribute('aria-invalid'), alerts: [...document.querySelectorAll('[role="alert"]:not([id^="__next-route-announcer"])')].map((a) => ({ text: a.textContent ?? '', inEmailBlock: Boolean(a.parentElement?.contains(e)) })) }; });
      check(`${tag} empty email: focus on Email and aria-invalid`, empty.active === 'email' && empty.invalid === 'true', JSON.stringify(empty));
      check(`${tag} empty email: one inline role=alert in the Email block with the approved prompt`, empty.alerts.length === 1 && empty.alerts[0].inEmailBlock && stripGlyph(empty.alerts[0].text) === copy.resetEmptyPrompt, JSON.stringify(empty.alerts));
      await page.screenshot({ path: `${OUT}/login-${vp.name}-empty-email.png`, fullPage: true });

      await page.fill('#email', 'lee-ann@example.test');
      // In-flight guard: a double click while the (delayed) send is pending sends once and the control is disabled meanwhile.
      resetDelayMs = 1200;
      await forgot.dblclick();
      await page.waitForTimeout(300);
      check(`${tag} control is disabled while the reset is pending`, await forgot.isDisabled());
      await page.getByRole('status').waitFor();
      resetDelayMs = 0;
      check(`${tag} double click sends exactly one reset request`, oobPosts === 1, String(oobPosts));
      check(`${tag} control is enabled again after the reset settles`, await forgot.isEnabled());
      const okText = (await page.getByRole('status').innerText()).trim();
      check(`${tag} reset success text verbatim`, okText === copy.resetResponse, okText);
      check(`${tag} prompt alert cleared after a send`, (await page.locator(ALERT).count()) === 0);
      const statusStyle = await page.evaluate(() => { const el = document.querySelector('[role="status"]'); const s = getComputedStyle(el); return { cls: el.className, color: s.color, bg: s.backgroundColor, rule: s.borderLeftColor, glyph: (el.textContent ?? '').includes('⚠') }; });
      await page.screenshot({ path: `${OUT}/login-${vp.name}-reset-sent.png`, fullPage: true });

      resetOutcome = 'not-found';
      await forgot.click();
      await page.waitForTimeout(500);
      check(`${tag} user-not-found shows the identical text`, (await page.getByRole('status').innerText()).trim() === okText);

      // Enter in the password field submits Sign in (the control must not capture it).
      await page.fill('#password', 'wrong-password-1');
      await page.press('#password', 'Enter');
      await page.locator(ALERT).waitFor();
      check(`${tag} Enter in password submits sign-in exactly once`, signInPosts === 1, String(signInPosts));
      const err = await page.evaluate(() => { const el = document.querySelector('[role="alert"]:not([id^="__next-route-announcer"])'); const s = getComputedStyle(el); const a = document.activeElement; return { text: el.textContent ?? '', cls: el.className, color: s.color, bg: s.backgroundColor, ruleWidth: parseFloat(s.borderLeftWidth), focused: a === el || Boolean(a?.contains(el)) || Boolean(el.contains(a)), activeInAnnouncer: Boolean(a?.id?.startsWith('__next-route-announcer')) }; });
      check(`${tag} invalid credential shows plain copy`, stripGlyph(err.text) === copy.invalidCredential, err.text);
      check(`${tag} error is role=alert, carries the warning glyph, error colour and left rule`, err.text.includes('⚠') && err.color === 'rgb(155, 44, 44)' && err.ruleWidth > 0, JSON.stringify(err));
      check(`${tag} focus moves to the error`, err.focused && !err.activeInAnnouncer, JSON.stringify(err));
      check(`${tag} reset-sent status is neutral and differs from the error`, !statusStyle.glyph && statusStyle.color !== err.color && statusStyle.cls !== err.cls && statusStyle.rule !== 'rgb(155, 44, 44)', JSON.stringify({ statusStyle, err }));
      check(`${tag} no raw Firebase text anywhere on the page`, !/Firebase: |auth\/[a-z-]+/.test(await page.locator('body').innerText()));
      await page.screenshot({ path: `${OUT}/login-${vp.name}-error.png`, fullPage: true });
      check(`${tag} no un-mocked external requests`, external.every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)), external.join(', '));
      await ctx.close();
    }
  } finally { await browser.close(); }
}

run()
  .catch((e) => { failures.push(`exception ${e.message}`); console.error(e); })
  .finally(() => {
    server.kill();
    if (failures.length) { console.error(`FAILED:\n- ${failures.join('\n- ')}`); process.exit(1); }
    console.log('admin-login-errors browser checks pass; screenshots in .tmp/sandbox/admin-login-gate/');
    process.exit(0);
  });
