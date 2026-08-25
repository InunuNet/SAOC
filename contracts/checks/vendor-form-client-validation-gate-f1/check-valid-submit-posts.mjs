// A4 — regression guard, same Playwright harness as A3. Fills every required field of the
// vendor registration form with valid data and submits. Asserts:
//   (a) exactly one request to /api/vendors/register is observed
//   (b) the request method is POST
//   (c) the form reaches a non-error state (success, or at minimum the request left the
//       browser — this check does not require a seeded Firestore backend to pass)
//   (d) a screenshot is saved to screenshots/valid-submit-posts.png
//
// This is the "gate too aggressive, blocks valid submissions" failure mode — treated as
// seriously as A3's "gate too permissive" failure mode.
//
// The request to /api/vendors/register is intercepted with page.route() and fulfilled with a
// mocked 201 success body BEFORE it ever reaches the real Next.js server — this check proves
// the client fired the POST, not that the real API accepted it. Letting the real request
// through here would create a real vendorSubmissions Firestore document (and potentially a
// real admin notification email, per lib/vendor-registration-handler.ts) on every re-run of
// this check, forever. See the project's fixture-leak-hardening precedent.
//
// Field ids follow the documented id contract in components/vendors/VendorFormField.tsx et al:
// "vendor-register-<key>" for single inputs, "vendor-register-<key>-<optionValue>" for
// checkbox/radio group options.
//
// Run as: node contracts/checks/vendor-form-client-validation-gate-f1/check-valid-submit-posts.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'valid-submit-posts.png');

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

// Intercept and fulfill locally — never let this reach the real server. Fulfilling with a
// shape matching the real 201 success body (see lib/vendor-registration-handler.ts and
// lib/vendor-register-response.ts's isSuccessBody()) lets the client reach its real
// "success" UI state without any live Firestore write.
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

async function fillText(id, value) {
  await page.locator(`#${id}`).fill(value);
}

// Required fields per lib/vendor-register-form-validation.ts.
await fillText('vendor-register-businessName', 'Test Orchid Traders');
await fillText('vendor-register-contactPersonName', 'Jane Test');
await fillText('vendor-register-contactCellPhone', '0821234567');
await fillText('vendor-register-contactEmail', 'jane.test@example.com');
await fillText('vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');

// vendorCategory — check one checkbox option.
await page.locator('#vendor-register-vendorCategory-plant-sales').check();

// boothCount — positive integer.
await fillText('vendor-register-boothCount', '2');

// powerRequired — boolean radio group, select "No" to avoid triggering the conditional
// electricalLoad field (which is not required, but keeps the filled state minimal).
await page.locator('#vendor-register-powerRequired-false').check();

// termsAccepted — required checkbox.
await page.locator('#vendor-register-termsAccepted').check();

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  await page.waitForTimeout(1500);

  if (registerRequests.length === 0) {
    failures.push(
      'FAIL: zero requests reached /api/vendors/register for a fully valid form submit — the ' +
        'client validation gate is blocking a genuinely valid submission.',
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

  // Non-error state: either the success screen rendered, or at minimum no client-side
  // validation-error banner is showing (a 'validation-error' descriptor kind would mean the
  // request never should have left the browser, contradicting the network assertion above; a
  // server-side error, e.g. an unseeded Firestore backend returning 500, is acceptable here
  // since this check only proves the CLIENT gate did not block a valid submission).
  const validationErrorVisible = await page
    .locator('[role="alert"]')
    .filter({ hasText: 'Please check the highlighted fields' })
    .first()
    .isVisible()
    .catch(() => false);
  if (validationErrorVisible) {
    failures.push(
      'FAIL: the client-side "Please check the highlighted fields." validation-error banner is ' +
        'visible after submitting a fully valid form.',
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

console.log('PASS: a fully valid vendor form submit fired exactly one POST to /api/vendors/register.');
process.exit(0);
