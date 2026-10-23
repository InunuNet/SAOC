// sponsor-enquiry-form: screenshots of the enquiry section on both hosts at 1280 and 390, at rest, after
// an empty submit (the errors) and in the success state. Needs a prior `pnpm build` made with
// NEXT_PUBLIC_*_SITE_URL on port 3221. Run with SHOW_PLACEHOLDER_PREVIEW=true (built the same way) to shoot the marked beta preview. The success state is reached by answering the POST inside the
// browser with a stubbed 201, so nothing is ever written to Firestore and no email is sent.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import http from 'node:http';

import { chromium } from '@playwright/test';

const PORT = 3221;
const SHOT_DIR = '../sponsor-shots';
const LOG_DIR = '.tmp/sandbox/sponsor-enquiry';
const HOSTS = { saoc: `saoc.localhost:${PORT}`, nos: `nos.localhost:${PORT}` };
const VIEWPORTS = [1280, 390];
const HORIZONTAL_SCROLL_TOLERANCE_PX = 1;
const AFTER_CLICK_SETTLE_MS = 1200;

mkdirSync(SHOT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });
const log = openSync(`${LOG_DIR}/shots-start.log`, 'w');
const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
  stdio: ['ignore', log, log],
  env: {
    ...process.env,
    NODE_ENV: 'production',
    BETA_BASIC_AUTH_USER: 's',
    BETA_BASIC_AUTH_PASSWORD: 'p',
    SITE_PUBLIC_LAUNCH: '',
    NEXT_PUBLIC_SAOC_SITE_URL: `http://${HOSTS.saoc}`,
    NEXT_PUBLIC_NOS_SITE_URL: `http://${HOSTS.nos}`,
    SITE_URL: `http://${HOSTS.saoc}`,
  },
});

function up() {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/robots.txt', headers: { host: HOSTS.saoc } }, () => resolve(true));
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function waitUp() {
  for (let i = 0; i < 90; i += 1) {
    if (await up()) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`next start did not come up; see ${LOG_DIR}/shots-start.log`);
}

async function shoot(page, name) {
  const section = page.locator('#enquire');
  await section.scrollIntoViewIfNeeded();
  await section.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

async function run() {
  await waitUp();
  const browser = await chromium.launch();
  for (const [site, host] of Object.entries(HOSTS)) {
    for (const width of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, httpCredentials: { username: 's', password: 'p' } });
      const page = await context.newPage();
      await page.route('**/api/sponsors/enquire', (route) =>
        route.fulfill({ status: 201, contentType: 'application/json', body: '{"success":true}' }),
      );
      await page.goto(`http://${host}/sponsors`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log(`${site} ${width}: horizontal overflow ${overflow}px ${overflow <= HORIZONTAL_SCROLL_TOLERANCE_PX ? 'ok' : 'FAIL'}`);
      await page.screenshot({ path: `${SHOT_DIR}/${site}-${width}-hero.png` });
      await shoot(page, `${site}-${width}-rest`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole('link', { name: 'Talk to us about sponsorship' }).click();
      await page.waitForTimeout(AFTER_CLICK_SETTLE_MS);
      await page.screenshot({ path: `${SHOT_DIR}/${site}-${width}-after-cta.png` });
      console.log(`${site} ${width}: focus after CTA -> ${await page.evaluate(() => document.activeElement?.id)}`);

      await page.getByRole('button', { name: 'Send enquiry' }).click();
      await shoot(page, `${site}-${width}-errors`);
      const focused = await page.evaluate(() => document.activeElement?.id);
      console.log(`${site} ${width}: focus after empty submit -> ${focused}`);

      await page.fill('#se-contactName', 'Pat Grower');
      await page.fill('#se-email', 'pat@example.test');
      await page.fill('#se-message', 'We would like to talk about sponsoring the show.');
      await page.selectOption('#se-level', 'gold');
      await page.check('#se-consent');
      await page.getByRole('button', { name: 'Send enquiry' }).click();
      await page.locator('#enquire-success-heading').waitFor();
      const successFocus = await page.evaluate(() => document.activeElement?.id);
      console.log(`${site} ${width}: focus after success -> ${successFocus}`);
      await shoot(page, `${site}-${width}-success`);
      await context.close();
    }
  }
  await browser.close();
}

try {
  await run();
} finally {
  server.kill();
}
