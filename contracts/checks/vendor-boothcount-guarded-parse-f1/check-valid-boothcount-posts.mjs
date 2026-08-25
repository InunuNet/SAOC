// A9 — behavioral, same Playwright harness. Regression guard: a genuine positive whole-number
// boothCount ("3") must still submit successfully after routing boothCount through
// toOptionalInt() instead of the raw Number.parseInt(). Asserts exactly one POST request to
// /api/vendors/register is observed.
//
// The request is intercepted with page.route() and fulfilled locally with a mocked 201 — never
// let this reach the real server, per the project's leak-prevention lesson (a live vendorSubmissions
// Firestore document would otherwise be created on every re-run of this check).
//
// Run as: node contracts/checks/vendor-boothcount-guarded-parse-f1/check-valid-boothcount-posts.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'valid-boothcount-posts.png');

const failures = [];
const registerRequests = [];

async function fillText(page, id, value) {
  await page.locator(`#${id}`).fill(value);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  registerRequests.push({ url: request.url(), method: request.method() });
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'contract-check-mock-id' }),
  });
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

await fillText(page, 'vendor-register-businessName', 'Test Orchid Traders');
await fillText(page, 'vendor-register-contactPersonName', 'Jane Test');
await fillText(page, 'vendor-register-contactCellPhone', '0821234567');
await fillText(page, 'vendor-register-contactEmail', 'jane.test@example.com');
await fillText(page, 'vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');
await page.locator('#vendor-register-vendorCategory-plant-sales').check();
await page.locator('#vendor-register-powerRequired-false').check();
await page.locator('#vendor-register-termsAccepted').check();
await fillText(page, 'vendor-register-boothCount', '3');

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  await page.waitForTimeout(1500);

  if (registerRequests.length === 0) {
    failures.push(
      'FAIL: zero requests reached /api/vendors/register for a valid boothCount="3" submit — ' +
        'the toOptionalInt() fix regressed a genuinely valid submission.',
    );
  } else if (registerRequests.length > 1) {
    failures.push(
      `FAIL: ${registerRequests.length} requests reached /api/vendors/register (expected 1). ` +
        `Requests: ${JSON.stringify(registerRequests)}`,
    );
  } else if (registerRequests[0].method !== 'POST') {
    failures.push(
      `FAIL: request to /api/vendors/register used method "${registerRequests[0].method}", ` +
        'expected POST.',
    );
  }
}

await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
await browser.close();

if (!existsSync(SCREENSHOT_PATH)) {
  failures.push(`FAIL: screenshot was not written to ${SCREENSHOT_PATH}`);
}

console.log(JSON.stringify({ registerRequests, screenshot: SCREENSHOT_PATH }, null, 2));

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log('PASS: a valid whole-number boothCount ("3") still fires exactly one POST to /api/vendors/register.');
process.exit(0);
