// A6 — behavioral, real headless browser (Playwright), real network layer intercepted via
// page.route() (never a real POST — abort the route so no live Firestore document can ever be
// created by re-running this check). Loads /national-show/vendors/register, fills every other
// required field with valid data, leaves all 8 vendorCategory checkboxes unchecked, and
// submits. Asserts:
//   (a) zero requests reach /api/vendors/register
//   (b) a visible [role="alert"] region renders text mentioning vendor category
//   (c) a screenshot is saved to screenshots/empty-category-blocked.png
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-empty-category-blocked.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'empty-category-blocked.png');

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

// Intercept and abort — a regression that lets this request through would create a real
// vendorSubmissions Firestore document (with no category) on every re-run of this check.
await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  registerRequests.push({ url: request.url(), method: request.method() });
  await route.abort('failed');
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

async function fillText(id, value) {
  await page.locator(`#${id}`).fill(value);
}

// Every OTHER required field per lib/vendor-register-form-validation.ts, deliberately leaving
// all 8 vendorCategory checkboxes unchecked.
await fillText('vendor-register-businessName', 'Test Orchid Traders');
await fillText('vendor-register-contactPersonName', 'Jane Test');
await fillText('vendor-register-contactCellPhone', '0821234567');
await fillText('vendor-register-contactEmail', 'jane.test@example.com');
await fillText('vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');
await fillText('vendor-register-boothCount', '2');
await page.locator('#vendor-register-powerRequired-false').check();
await page.locator('#vendor-register-termsAccepted').check();

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  await page.waitForTimeout(1000);

  if (registerRequests.length > 0) {
    failures.push(
      `FAIL: ${registerRequests.length} request(s) reached /api/vendors/register with all 8 ` +
        `vendorCategory checkboxes left unchecked — the required-category gate did not block ` +
        `the network call. Requests: ${JSON.stringify(registerRequests)}`,
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
      'FAIL: no genuinely visible validation error text found in a [role="alert"] region after ' +
        'submitting with no vendor category selected (element must be present, visible, and ' +
        'non-empty — not merely present in the DOM).',
    );
  } else if (!/vendor category/i.test(alertText) && !/vendorcategory/i.test(alertText)) {
    failures.push(
      `FAIL: [role="alert"] text does not mention vendor category. Actual text: "${alertText}"`,
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

console.log(
  'PASS: submitting the vendor form with an otherwise-valid form and zero categories selected ' +
    'fired zero /api/vendors/register requests and showed a visible vendor-category error.',
);
process.exit(0);
