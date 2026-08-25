// A8 — behavioral, same Playwright harness. Codex finding 4: after an invalid submission,
// resolves the SPECIFIC ancestor div[tabindex="-1"] that directly wraps the role="alert" node
// (components/vendors/VendorRegisterForm.tsx's `<div ref={bannerRef} tabIndex={-1}>` wrapping
// `<VendorRegisterStatusBanner>`, whose role="alert" div is its direct child) — not any
// tabindex="-1" element anywhere on the page (e.g. the honeypot's hidden input has tabIndex={-1}
// too). Asserts that specific element exists and is document.activeElement after the post-submit
// scroll/focus effect settles.
//
// Run as: node contracts/checks/vendor-boothcount-guarded-parse-f1/check-banner-tabindex-target.mjs

import { chromium } from 'playwright';

const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const failures = [];

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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await page.route('**/api/vendors/register', async (route) => {
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
await typeBoothCount(page, 'e1');

const submitButton = page.getByRole('button', { name: 'Submit registration' });
if ((await submitButton.count()) === 0) {
  failures.push('SETUP FAILURE: no "Submit registration" button found on the vendor register page.');
} else {
  await submitButton.click();
  // Wait for the scrollIntoView + focus effect (VendorRegisterForm.tsx's useEffect on
  // `descriptor`) to settle after the React state update.
  await page.waitForTimeout(1200);

  const alertCount = await page.locator('[role="alert"]').count();
  if (alertCount === 0) {
    failures.push('FAIL: no [role="alert"] element found after invalid submit.');
  } else {
    const resolution = await page.evaluate(() => {
      const alertEl = document.querySelector('[role="alert"]');
      if (!alertEl) {
        return { found: false };
      }
      const ancestor = alertEl.closest('[tabindex="-1"]');
      if (!ancestor) {
        return { found: false, alertFound: true };
      }
      return {
        found: true,
        isActiveElement: document.activeElement === ancestor,
        tagName: ancestor.tagName,
      };
    });

    if (!resolution.found) {
      failures.push(
        'FAIL: could not resolve a [tabindex="-1"] ancestor of the [role="alert"] node ' +
          '(closest() found none) — expected the bannerRef wrapper div.',
      );
    } else if (!resolution.isActiveElement) {
      failures.push(
        `FAIL: the resolved ancestor [tabindex="-1"] div (a ${resolution.tagName}) is not ` +
          'document.activeElement after the post-submit effect settled.',
      );
    } else {
      console.log('PASS-DETAIL: bannerRef ancestor div[tabindex="-1"] is document.activeElement.');
    }
  }
}

await browser.close();

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: the specific tabindex="-1" ancestor of the role="alert" banner receives focus after ' +
    'an invalid submit.',
);
process.exit(0);
