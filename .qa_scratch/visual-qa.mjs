// QA scratch: real BrowserAgent-style visual pass for door-checkin-success-feedback F1.
// Uses the manual-entry form (a real reachable UI path, same handleCheckIn() the camera
// decode callback calls) against a real seeded Firestore ticket (DOOR-QR-ADMIT-01,
// scripts/seed-door-test-tickets.ts) through a real admin session cookie, so both the
// success and already-checked-in-failure overlays are produced by the actual app code
// path, not by mocking client state.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE_URL = 'https://dev.saoc.co.za:3334';
const OUT_DIR = '.qa_scratch/screenshots';
mkdirSync(OUT_DIR, { recursive: true });

const { sessionCookie } = JSON.parse(readFileSync('.qa_scratch/session.json', 'utf8'));

const VIEWPORTS = [
  { name: '375x667', width: 375, height: 667 },
  { name: '320x568', width: 320, height: 568 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  // Reset the fixture ticket back to 'paid' before each viewport pass so the first
  // manual-entry submit always produces a genuine ADMIT (success), never a stale
  // already-checked-in from a prior pass.
  execSync('pnpm door:seed', { stdio: 'inherit', cwd: '/Users/vetus/ai/SAOC' });

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    ignoreHTTPSErrors: true,
  });
  await context.addCookies([
    {
      name: 'session',
      value: sessionCookie,
      domain: 'dev.saoc.co.za',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
    },
  ]);

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });

  // --- SUCCESS ---
  await page.fill('#manual-ref', 'DOOR-QR-ADMIT-01');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="status"]', { timeout: 10000 });
  await page.waitForTimeout(300);
  const successScrollCheck = await page.evaluate(() => ({
    docScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    bodyOverflow: document.body.scrollHeight > window.innerHeight,
  }));
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-success.png` });
  console.log(`[${vp.name}] SUCCESS scroll-check:`, JSON.stringify(successScrollCheck));

  // Wait past the 3s auto-dismiss and confirm it's gone.
  await page.waitForTimeout(3500);
  const stillThereAfterDismiss = (await page.$('[role="status"]')) !== null;
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-after-dismiss.png` });
  console.log(`[${vp.name}] success overlay still present after 3.5s (expect false):`, stillThereAfterDismiss);

  // --- FAILURE (duplicate scan of the now-checked-in ticket) ---
  const [checkinResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/admin/checkin'), { timeout: 10000 }),
    page.fill('#manual-ref', 'DOOR-QR-ADMIT-01').then(() => page.click('button[type="submit"]')),
  ]);
  console.log(`[${vp.name}] checkin response status:`, checkinResp.status(), await checkinResp.text().catch(() => '<err>'));
  await page.waitForSelector('[role="alert"]', { timeout: 10000 });
  await page.waitForTimeout(300);
  const failureScrollCheck = await page.evaluate(() => ({
    docScrollHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-failure.png` });
  console.log(`[${vp.name}] FAILURE scroll-check:`, JSON.stringify(failureScrollCheck));

  await page.waitForTimeout(3500);
  const stillThereAfterWait = (await page.$('[role="alert"]')) !== null;
  await page.screenshot({ path: `${OUT_DIR}/${vp.name}-failure-holds.png` });
  console.log(`[${vp.name}] failure overlay still present after 3.5s (expect true):`, stillThereAfterWait);

  await context.close();
}

await browser.close();
console.log('DONE');
