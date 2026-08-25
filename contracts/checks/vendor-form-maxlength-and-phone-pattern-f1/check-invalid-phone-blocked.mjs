// A6 — behavioral, real headless browser (Playwright), real network layer intercepted via
// page.route() (never a real POST -- abort so no live Firestore document can ever be created by
// re-running this check). Fills every required field with otherwise-valid data EXCEPT
// contactCellPhone, which gets "not a phone number !!". Submits and asserts:
//   (a) zero requests reach /api/vendors/register
//   (b) a visible [role="alert"] region shows a validation error after submit
//   (c) a screenshot is saved to screenshots/invalid-phone-blocked.png
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-invalid-phone-blocked.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'invalid-phone-blocked.png');

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
  registerRequests.push({ url: route.request().url(), method: route.request().method() });
  await route.abort('failed');
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

async function fillText(id, value) {
  await page.locator(`#${id}`).fill(value);
}

await fillText('vendor-register-businessName', 'Test Orchid Traders');
await fillText('vendor-register-contactPersonName', 'Jane Test');
// The malformed phone under test -- must NOT satisfy ^[0-9+\-() ]{7,20}$.
await fillText('vendor-register-contactCellPhone', 'not a phone number !!');
await fillText('vendor-register-contactEmail', 'jane.test@example.com');
await fillText('vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');
await page.locator('#vendor-register-vendorCategory-plant-sales').check();
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
      `FAIL: ${registerRequests.length} request(s) reached /api/vendors/register with a ` +
        `malformed contactCellPhone -- the phone-format gate did not block the network call. ` +
        `Requests: ${JSON.stringify(registerRequests)}`,
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
        'submitting with a malformed contactCellPhone (element must be present, visible, and ' +
        'non-empty -- not merely present in the DOM).',
    );
  } else if (!/phone/i.test(alertText)) {
    failures.push(
      `FAIL: [role="alert"] text does not mention "phone". Actual text: "${alertText}"`,
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
  'PASS: submitting an otherwise-valid vendor form with a malformed contactCellPhone fired zero ' +
    '/api/vendors/register requests and showed a visible phone-related validation error.',
);
process.exit(0);
