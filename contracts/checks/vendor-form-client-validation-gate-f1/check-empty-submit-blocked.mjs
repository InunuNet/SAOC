// A3 — behavioral, real headless browser (Playwright), real network layer intercepted via
// page.route() (not mocked at the fetch/JS level) so a real request would be observed even if
// some future refactor bypassed the fetch() wrapper entirely. Loads
// /national-show/vendors/register, submits the form completely empty, and asserts:
//   (a) zero requests to /api/vendors/register are observed
//   (b) visible validation error text renders on the page after submit
//   (c) a screenshot is saved to screenshots/empty-submit-blocked.png
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-empty-submit-blocked.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'empty-submit-blocked.png');

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

// Intercept and abort rather than merely observe — this check expects zero requests, but if
// the client gate silently regressed, an unintercepted request would fire a real POST to
// /api/vendors/register and leak a bad vendorSubmissions Firestore document. Aborting keeps
// this check leak-proof even in its own failure mode.
await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  registerRequests.push({ url: request.url(), method: request.method() });
  await route.abort('failed');
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  // Give React state updates and any (incorrectly fired) network request time to land.
  await page.waitForTimeout(1000);

  if (registerRequests.length > 0) {
    failures.push(
      `FAIL: ${registerRequests.length} request(s) reached /api/vendors/register for a fully ` +
        `empty submit — client validation gate did not block the network call. Requests: ` +
        `${JSON.stringify(registerRequests)}`,
    );
  }

  const alertRegion = page.locator('[role="alert"]').first();
  const alertVisible = await alertRegion.isVisible().catch(() => false);
  let alertText = '';
  if (alertVisible) {
    alertText = (await alertRegion.innerText()).trim();
  }
  if (!alertVisible || alertText.length === 0) {
    failures.push(
      'FAIL: no genuinely visible validation error text found in a [role="alert"] region ' +
        'after submitting an empty form (element must be present, visible, and non-empty — ' +
        'not merely present in the DOM).',
    );
  } else {
    console.log(`Visible error banner text: "${alertText}"`);
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

console.log('PASS: empty vendor form submit fired zero /api/vendors/register requests and showed a visible error.');
process.exit(0);
