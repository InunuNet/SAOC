import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE_URL = 'https://dev.saoc.co.za:3334';
const { sessionCookie } = JSON.parse(readFileSync('.qa_scratch/session.json', 'utf8'));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  ignoreHTTPSErrors: true,
});
await context.addCookies([
  { name: 'session', value: sessionCookie, domain: 'dev.saoc.co.za', path: '/', httpOnly: true, secure: true, sameSite: 'Strict' },
]);
const page = await context.newPage();
page.on('console', (msg) => console.log('BROWSER:', msg.type(), msg.text()));
page.on('response', async (res) => {
  if (res.url().includes('/api/admin/checkin')) {
    console.log('CHECKIN RESPONSE', res.status(), await res.text().catch(() => '<err>'));
  }
});

await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });

// Ticket should already be checked-in from the prior full run (DOOR-QR-ADMIT-01).
// Submit once, expect an already-checked-in failure directly.
await page.fill('#manual-ref', 'DOOR-QR-ADMIT-01');
await page.click('button[type="submit"]');
await page.waitForTimeout(500);
console.log('role=alert present after 500ms:', (await page.$('[role="alert"]')) !== null);
console.log('role=status present after 500ms:', (await page.$('[role="status"]')) !== null);
await page.screenshot({ path: '.qa_scratch/screenshots/debug-immediate.png' });
await page.waitForTimeout(1500);
console.log('role=alert present after 2s:', (await page.$('[role="alert"]')) !== null);
await page.screenshot({ path: '.qa_scratch/screenshots/debug-after-2s.png' });

await browser.close();
