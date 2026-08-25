// A7 — regression guard, same Playwright harness as A6. Same valid form as A6, but checks
// exactly ONE vendorCategory checkbox ("plant-sales") before submitting. Network intercepted
// and fulfilled locally with a mocked 201 — never a real POST reaching the live server.
// Asserts:
//   (a) exactly one request reaches /api/vendors/register
//   (b) the request method is POST
//   (c) the client-side "Please check the highlighted fields." validation-error banner is NOT
//       visible after submit (the gate does not over-trigger when exactly one category is
//       selected)
//   (d) a screenshot is saved to screenshots/one-category-posts.png
//
// This is the "gate too aggressive" failure mode — must not be too strict.
//
// Run as: node contracts/checks/vendorcategory-aria-required-enforcement-f1/check-one-category-posts.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'one-category-posts.png');

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

// Intercept and fulfill locally — never let this reach the real server. Fulfilling with a
// shape matching the real 201 success body lets the client reach its real "success" UI state
// without any live Firestore write.
await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  let vendorCategory;
  try {
    vendorCategory = request.postDataJSON()?.vendorCategory;
  } catch {
    vendorCategory = undefined;
  }
  registerRequests.push({ url: request.url(), method: request.method(), vendorCategory });
  if (!Array.isArray(vendorCategory) || !vendorCategory.includes('plant-sales')) {
    failures.push(
      `FAIL: the intercepted POST body's vendorCategory was ${JSON.stringify(vendorCategory)}, ` +
        "expected an array containing 'plant-sales' — the checked checkbox was not serialized " +
        'into the request body.',
    );
  }
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'contract-check-mock-id' }),
  });
});

await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });

async function fillText(id, value) {
  await page.locator(`#${id}`).fill(value);
}

await fillText('vendor-register-businessName', 'Test Orchid Traders');
await fillText('vendor-register-contactPersonName', 'Jane Test');
await fillText('vendor-register-contactCellPhone', '0821234567');
await fillText('vendor-register-contactEmail', 'jane.test@example.com');
await fillText('vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');

// vendorCategory — exactly one checkbox checked.
await page.locator('#vendor-register-vendorCategory-plant-sales').check();

await fillText('vendor-register-boothCount', '2');
await page.locator('#vendor-register-powerRequired-false').check();
await page.locator('#vendor-register-termsAccepted').check();

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  await page.waitForTimeout(1500);

  if (registerRequests.length === 0) {
    failures.push(
      'FAIL: zero requests reached /api/vendors/register with exactly one vendorCategory ' +
        'checkbox selected and everything else valid — the required-category gate is blocking ' +
        'a genuinely valid submission.',
    );
  } else if (registerRequests.length > 1) {
    failures.push(
      `FAIL: ${registerRequests.length} requests reached /api/vendors/register for a single ` +
        `submit (expected exactly 1 — possible double-submit). Requests: ` +
        `${JSON.stringify(registerRequests)}`,
    );
  } else if (registerRequests[0].method !== 'POST') {
    failures.push(
      `FAIL: request to /api/vendors/register used method "${registerRequests[0].method}", ` +
        'expected POST.',
    );
  }

  const validationErrorVisible = await page
    .locator('[role="alert"]')
    .filter({ hasText: 'Please check the highlighted fields' })
    .first()
    .isVisible()
    .catch(() => false);
  if (validationErrorVisible) {
    failures.push(
      'FAIL: the client-side "Please check the highlighted fields." validation-error banner is ' +
        'visible after submitting with exactly one vendorCategory selected and everything else ' +
        'valid — the required-category gate is over-triggering.',
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

console.log(
  'PASS: a vendor form submit with exactly one vendorCategory selected fired exactly one POST ' +
    'to /api/vendors/register with no validation-error banner shown.',
);
process.exit(0);
