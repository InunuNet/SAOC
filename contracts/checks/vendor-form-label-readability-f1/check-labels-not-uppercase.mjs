// A4 — behavioral, real headless browser (Playwright). Loads /national-show/vendors/register,
// /contact, and /national-show and asserts, on a representative label/legend/eyebrow element on
// each page, that getComputedStyle textTransform === 'none' (uppercase removed), fontFamily still
// matches the mono stack (font-mono preserved), and letterSpacing is a non-zero value (unchanged
// from tracking-[0.16em], not stripped alongside uppercase). Screenshots each page's label area.
//
// Run as: node contracts/checks/vendor-form-label-readability-f1/check-labels-not-uppercase.mjs

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VENDOR_FORM_CHECK_BASE_URL ?? 'http://localhost:3002';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const failures = [];

async function assertLabel(page, { pageName, url, locate, screenshotName }) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });

  const el = await locate(page);
  if ((await el.count()) === 0) {
    failures.push(`SETUP FAILURE (${pageName}): label element not found on ${url}.`);
    return;
  }

  const style = await el.evaluate((node) => {
    const cs = window.getComputedStyle(node);
    return {
      textTransform: cs.textTransform,
      fontFamily: cs.fontFamily,
      letterSpacing: cs.letterSpacing,
    };
  });

  if (style.textTransform !== 'none') {
    failures.push(
      `FAIL (${pageName}): textTransform is "${style.textTransform}", expected "none" — ` +
        `uppercase was not removed.`,
    );
  }

  if (!/mono/i.test(style.fontFamily)) {
    failures.push(
      `FAIL (${pageName}): fontFamily is "${style.fontFamily}", expected a monospace stack — ` +
        `font-mono class appears to have been dropped.`,
    );
  }

  if (style.letterSpacing === 'normal' || parseFloat(style.letterSpacing) === 0) {
    failures.push(
      `FAIL (${pageName}): letterSpacing is "${style.letterSpacing}", expected a non-zero value — ` +
        `tracking-[0.16em] appears to have been stripped alongside uppercase.`,
    );
  }

  console.log(`${pageName}:`, JSON.stringify(style));

  await el.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) }).catch(async () => {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, screenshotName) });
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });

await assertLabel(page, {
  pageName: 'register',
  url: '/national-show/vendors/register',
  locate: (p) => p.locator('label[for="vendor-register-businessName"]'),
  screenshotName: 'register-labels.png',
});

await assertLabel(page, {
  pageName: 'contact',
  url: '/contact',
  locate: (p) => p.locator('label[for="cf-name"]'),
  screenshotName: 'contact-labels.png',
});

await assertLabel(page, {
  pageName: 'national-show',
  url: '/national-show',
  locate: (p) => p.getByText('Editions held', { exact: true }),
  screenshotName: 'national-show-labels.png',
});

await browser.close();

for (const name of ['register-labels.png', 'contact-labels.png', 'national-show-labels.png']) {
  const p = path.join(SCREENSHOT_DIR, name);
  if (!existsSync(p)) {
    failures.push(`FAIL: screenshot was not written to ${p}`);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  process.exit(1);
}

console.log(
  'PASS: all 3 pages show textTransform: none, font-mono preserved, and non-zero letterSpacing ' +
    'on their representative label element.',
);
process.exit(0);
