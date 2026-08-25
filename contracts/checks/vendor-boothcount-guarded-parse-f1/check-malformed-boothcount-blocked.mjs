// A6 — behavioral, real headless browser (Playwright), real network layer intercepted via
// page.route() (not mocked at the fetch/JS level). Loads /national-show/vendors/register, fills
// every OTHER required field with valid data, then for boothCount in turn tries "1.5", "1e3",
// "e1", and "abc". For each value asserts:
//   (a) zero requests to /api/vendors/register are observed
//   (b) a genuinely visible role="alert" error containing the humanised boothCount message
//       ("Number of booths") appears
// Screenshots the "1.5" case to screenshots/malformed-boothcount-blocked.png.
//
// Defends Codex finding 2 live in the real browser: STRICT_INTEGER_PATTERN
// (lib/vendor-register-form-validation.ts) must reject all four values before
// buildVendorRegistrationPayload()'s toOptionalInt(state.boothCount) (lib/vendor-register-form-payload.ts)
// is ever reached.
//
// Run as: node contracts/checks/vendor-boothcount-guarded-parse-f1/check-malformed-boothcount-blocked.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_PATH = path.join(__dirname, 'screenshots', 'malformed-boothcount-blocked.png');
const MALFORMED_VALUES = ['1.5', '1e3', 'e1', 'abc'];

const failures = [];

async function fillText(page, id, value) {
  await page.locator(`#${id}`).fill(value);
}

// boothCount is an <input type="number">: the browser itself rejects non-numeric-syntax
// keystrokes (Playwright's .fill() throws rather than silently drop them), so "e1"/"abc" must be
// entered via real simulated keystrokes instead -- matching what a real user's keyboard input
// would produce (the DOM commits an empty value for those cases, which is itself a valid defense
// layer this check still verifies via the "required" error).
async function typeBoothCount(page, value) {
  const locator = page.locator('#vendor-register-boothCount');
  await locator.fill('');
  await locator.pressSequentially(value);
}

async function fillOtherRequiredFields(page) {
  await fillText(page, 'vendor-register-businessName', 'Test Orchid Traders');
  await fillText(page, 'vendor-register-contactPersonName', 'Jane Test');
  await fillText(page, 'vendor-register-contactCellPhone', '0821234567');
  await fillText(page, 'vendor-register-contactEmail', 'jane.test@example.com');
  await fillText(page, 'vendor-register-productDescription', 'Assorted cymbidium and cattleya orchids.');
  await page.locator('#vendor-register-vendorCategory-plant-sales').check();
  await page.locator('#vendor-register-powerRequired-false').check();
  await page.locator('#vendor-register-termsAccepted').check();
}

const browser = await chromium.launch();

for (const value of MALFORMED_VALUES) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const registerRequests = [];

  // Intercept and abort — a regression here would create a live vendorSubmissions Firestore
  // document with a malformed boothCount, exactly the defect class this contract guards against.
  await page.route('**/api/vendors/register', async (route) => {
    const request = route.request();
    registerRequests.push({ url: request.url(), method: request.method() });
    await route.abort('failed');
  });

  await page.goto(`${BASE_URL}/national-show/vendors/register`, { waitUntil: 'networkidle' });
  await fillOtherRequiredFields(page);
  await typeBoothCount(page, value);

  const submitButton = page.getByRole('button', { name: 'Submit registration' });
  if ((await submitButton.count()) === 0) {
    failures.push(`SETUP FAILURE (value="${value}"): no "Submit registration" button found.`);
    await page.close();
    continue;
  }

  await submitButton.click();
  await page.waitForTimeout(1000);

  if (registerRequests.length > 0) {
    failures.push(
      `FAIL (value="${value}"): ${registerRequests.length} request(s) reached ` +
        `/api/vendors/register — malformed boothCount was not blocked client-side. Requests: ` +
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
      `FAIL (value="${value}"): no genuinely visible [role="alert"] error found after submit.`,
    );
  } else if (!alertText.includes('Number of booths')) {
    failures.push(
      `FAIL (value="${value}"): visible alert did not mention "Number of booths". Alert text: ` +
        `"${alertText}"`,
    );
  } else {
    console.log(`value="${value}": visible error banner text: "${alertText}"`);
  }

  if (value === '1.5') {
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  }

  await page.close();
}

await browser.close();

if (!existsSync(SCREENSHOT_PATH)) {
  failures.push(`FAIL: screenshot was not written to ${SCREENSHOT_PATH}`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: all malformed boothCount values ("1.5", "1e3", "e1", "abc") were blocked client-side ' +
    'with zero network requests and a visible error.',
);
process.exit(0);
