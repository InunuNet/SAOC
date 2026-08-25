// A7 — behavioral, same Playwright harness as A6. Codex finding 1: after a FIRST invalid
// submission ("1.5") produces a visible error, without reloading the page, change boothCount to
// a SECOND, different invalid value ("e1") and submit again. Asserts the role="alert" error is
// still visible after this second submission by querying the live DOM state post-submit both
// times — not by inferring the second case from the first firing once.
//
// Guards against a React-batching regression where a same-shape descriptor object (or a memoized
// effect dependency) fails to rerender/refocus the banner on a second consecutive failure.
// components/vendors/VendorRegisterForm.tsx's setDescriptor({...}) always passes a new object
// literal, so this must currently pass; this check exists to keep it that way.
//
// Screenshot after the second submission to screenshots/second-invalid-submit-still-errors.png.
//
// Run as: node contracts/checks/vendor-boothcount-guarded-parse-f1/check-second-invalid-submit-still-errors.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'second-invalid-submit-still-errors.png');

const failures = [];
const registerRequests = [];

async function fillText(page, id, value) {
  await page.locator(`#${id}`).fill(value);
}

// boothCount is an <input type="number">: Playwright's .fill() throws on non-numeric-syntax
// strings, so real simulated keystrokes are used instead (matches real keyboard input).
async function typeBoothCount(page, value) {
  const locator = page.locator('#vendor-register-boothCount');
  await locator.fill('');
  await locator.pressSequentially(value);
}

async function assertVisibleAlert(page, label) {
  const alertRegion = page.locator('[role="alert"]').first();
  const alertVisible = await alertRegion.isVisible().catch(() => false);
  let alertText = '';
  if (alertVisible) {
    alertText = (await alertRegion.innerText()).trim();
  }
  if (!alertVisible || alertText.length === 0) {
    failures.push(`FAIL (${label}): no genuinely visible [role="alert"] error found after submit.`);
    return;
  }
  if (!alertText.includes('Number of booths')) {
    failures.push(
      `FAIL (${label}): visible alert did not mention "Number of booths". Alert text: "${alertText}"`,
    );
    return;
  }
  console.log(`${label}: visible error banner text: "${alertText}"`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  registerRequests.push({ url: request.url(), method: request.method() });
  await route.abort('failed');
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

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  // First invalid submission.
  await typeBoothCount(page, '1.5');
  await submitButton.click();
  await page.waitForTimeout(1000);
  await assertVisibleAlert(page, 'first submit ("1.5")');

  // Second, different invalid value, without reloading the page.
  await typeBoothCount(page, 'e1');
  await submitButton.click();
  await page.waitForTimeout(1000);
  await assertVisibleAlert(page, 'second submit ("e1")');

  if (registerRequests.length > 0) {
    failures.push(
      `FAIL: ${registerRequests.length} request(s) reached /api/vendors/register across the two ` +
        `invalid submissions. Requests: ${JSON.stringify(registerRequests)}`,
    );
  }
}

await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
await browser.close();

if (!existsSync(SCREENSHOT_PATH)) {
  failures.push(`FAIL: screenshot was not written to ${SCREENSHOT_PATH}`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log('PASS: a second, different invalid boothCount submit still shows a visible error banner.');
process.exit(0);
