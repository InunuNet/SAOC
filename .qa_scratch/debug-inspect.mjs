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

await page.goto(`${BASE_URL}/admin/door`, { waitUntil: 'networkidle' });
page.on('response', async (res) => {
  if (res.url().includes('/api/admin/checkin')) {
    console.log('CHECKIN RESPONSE', res.status(), await res.text().catch(() => '<err>'));
  }
});
await page.fill('#manual-ref', 'DOOR-QR-ADMIT-01');
await page.click('button[type="submit"]');
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const el = document.querySelector('[role="alert"]');
  if (!el) return null;
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    className: el.className,
    position: cs.position,
    inset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`,
    zIndex: cs.zIndex,
    display: cs.display,
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    outerHTML: el.outerHTML.slice(0, 500),
  };
});
console.log(JSON.stringify(info, null, 2));

await browser.close();
