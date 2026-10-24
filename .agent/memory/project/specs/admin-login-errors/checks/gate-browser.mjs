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
      const external = [];
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
        const url = route.request().url();
        if (/identitytoolkit\.googleapis\.com/.test(url)) {
          if (/accounts:sendOobCode/.test(url)) return resetOutcome === 'ok' ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'x@y.z' }) }) : route.fulfill(fbError('EMAIL_NOT_FOUND'));
          if (/accounts:signInWithPassword/.test(url)) return route.fulfill(fbError('INVALID_LOGIN_CREDENTIALS'));
        }
        external.push(url);
        return route.abort();
      });
      await page.goto(`${BASE}/admin/login`, { waitUntil: 'load' });
      const forgot = page.getByTestId('admin-forgot-password');
      check(`${tag} Forgot password? control visible with exact label`, (await forgot.count()) === 1 && (await forgot.innerText()).trim() === 'Forgot password?');
      const box = await forgot.boundingBox();
      check(`${tag} Forgot control at least 44px tall`, box && box.height >= 44, JSON.stringify(box));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(`${tag} no horizontal overflow`, overflow <= 1, String(overflow));
      await page.screenshot({ path: `${OUT}/login-${vp.name}.png`, fullPage: true });

      await forgot.click();
      check(`${tag} empty email shows the prompt`, (await page.locator('[role="alert"]:not([id^="__next-route-announcer"])').innerText()).trim() === copy.resetEmptyPrompt);

      await page.fill('#email', 'lee-ann@example.test');
      await forgot.click();
      await page.getByRole('status').waitFor();
      const okText = (await page.getByRole('status').innerText()).trim();
      check(`${tag} reset success text verbatim`, okText === copy.resetResponse, okText);
      check(`${tag} prompt alert cleared after a send`, (await page.locator('[role="alert"]:not([id^="__next-route-announcer"])').count()) === 0);
      await page.screenshot({ path: `${OUT}/login-${vp.name}-reset-sent.png`, fullPage: true });

      resetOutcome = 'not-found';
      await forgot.click();
      await page.waitForTimeout(500);
      check(`${tag} user-not-found shows the identical text`, (await page.getByRole('status').innerText()).trim() === okText);

      await page.fill('#password', 'wrong-password-1');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.locator('[role="alert"]:not([id^="__next-route-announcer"])').waitFor();
      const errText = (await page.locator('[role="alert"]:not([id^="__next-route-announcer"])').innerText()).trim();
      check(`${tag} invalid credential shows plain copy`, errText === copy.invalidCredential, errText);
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
