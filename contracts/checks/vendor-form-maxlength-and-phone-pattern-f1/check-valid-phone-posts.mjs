// A7 — regression guard, same Playwright harness as A5/A6. Fills every required field with
// fully valid data, including a valid contactCellPhone ("+27 82 123 4567"), and submits.
// Network intercepted and fulfilled locally with a mocked 201 -- never a real POST reaching the
// live server. Asserts exactly one POST request reaches /api/vendors/register (proves the new
// phone validator does not false-positive-reject a genuinely valid number), and that the request
// body's contactCellPhone matches what was typed.
//
// Run as: node contracts/checks/vendor-form-maxlength-and-phone-pattern-f1/check-valid-phone-posts.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'valid-phone-posts.png');
const VALID_PHONE = '+27 82 123 4567';

const failures = [];
const registerRequests = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  let body;
  try {
    body = request.postDataJSON();
  } catch {
    body = undefined;
  }
  registerRequests.push({ url: request.url(), method: request.method(), body });
  if (body?.contactCellPhone !== VALID_PHONE) {
    failures.push(
      `FAIL: the intercepted POST body's contactCellPhone was ${JSON.stringify(body?.contactCellPhone)}, ` +
        `expected "${VALID_PHONE}" -- the typed phone number was not serialized into the request body ` +
        'unchanged.',
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
await fillText('vendor-register-contactCellPhone', VALID_PHONE);
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
  await page.waitForTimeout(1500);

  if (registerRequests.length === 0) {
    failures.push(
      `FAIL: zero requests reached /api/vendors/register with a valid contactCellPhone ` +
        `("${VALID_PHONE}") and everything else valid -- the new phone validator is falsely ` +
        'rejecting a genuinely valid number.',
    );
  } else if (registerRequests.length > 1) {
    failures.push(
      `FAIL: ${registerRequests.length} requests reached /api/vendors/register for a single ` +
        `submit (expected exactly 1). Requests: ${JSON.stringify(registerRequests)}`,
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

console.log(
  `PASS: a vendor form submit with a valid contactCellPhone ("${VALID_PHONE}") fired exactly ` +
    'one POST to /api/vendors/register with the phone number serialized unchanged.',
);
process.exit(0);
