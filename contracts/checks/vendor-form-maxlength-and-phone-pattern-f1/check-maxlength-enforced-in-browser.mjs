// A5 — behavioral, real headless browser (Playwright), real network layer intercepted via
// page.route() (never a JS-level mock, never a real POST). Loads /national-show/vendors/register,
// fills businessName with 250 characters, and asserts the browser's native maxLength truncated
// the DOM value to exactly 200 -- proving enforcement at the DOM level, not merely some later JS
// validation step. Also submits with only businessName filled and asserts zero requests reach
// /api/vendors/register (existing required-field gate must not have regressed).
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-maxlength-enforced-in-browser.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'businessname-maxlength-enforced.png');
const EXPECTED_MAX = 200;

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
  registerRequests.push({ url: route.request().url(), method: route.request().method() });
  await route.abort('failed');
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

const businessNameInput = page.locator('#vendor-register-businessName');
await businessNameInput.fill('a'.repeat(250));

const actualLength = await businessNameInput.evaluate((el) => el.value.length);
if (actualLength !== EXPECTED_MAX) {
  failures.push(
    `FAIL: after filling businessName with a 250-char string, the DOM value.length was ` +
      `${actualLength}, expected exactly ${EXPECTED_MAX} (native maxLength truncation).`,
  );
} else {
  console.log(`businessName DOM value truncated to ${actualLength} chars as expected.`);
}

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  await page.waitForTimeout(1000);

  if (registerRequests.length > 0) {
    failures.push(
      `FAIL: ${registerRequests.length} request(s) reached /api/vendors/register with only ` +
        `businessName filled -- the existing required-field gate did not block the network ` +
        `call. Requests: ${JSON.stringify(registerRequests)}`,
    );
  }
}

await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
await browser.close();

if (!existsSync(SCREENSHOT_PATH)) {
  failures.push(`FAIL: screenshot was not written to ${SCREENSHOT_PATH}`);
}

console.log(JSON.stringify({ actualLength, registerRequests, screenshot: SCREENSHOT_PATH }, null, 2));

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: businessName is truncated to exactly 200 chars at the DOM level, and submitting with ' +
    'only businessName filled fires zero requests to /api/vendors/register.',
);
process.exit(0);
