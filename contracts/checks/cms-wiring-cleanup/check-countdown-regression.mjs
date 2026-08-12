#!/usr/bin/env node
// A6 — F4 regression guard for the countdown, read-only.
//
// F4 REMOVES `homePage.countdownDate`. The removal is safe only because the home page
// countdown is driven by `nationalShow.countdownDate` (app/(marketing)/page.tsx:77
// passes `show?.countdownDate` to ShowBand). Two fields named countdownDate, one of
// them inert, is the confusion that produced the backlog's "the countdown field does
// not drive the countdown" entry — so the fix is to delete the dead one, and this
// check is what proves @dev deleted the dead one rather than the live one.
//
// This check needs a real browser. The countdown SSRs as "00" by design (the
// f1-countdown-hydration fix renders hydration-safe zeros), so plain HTTP cannot see
// its value — a curl-based assertion here would be a false green by construction.
// Playwright loads the page, lets it hydrate, and reads the rendered day count, then
// compares it against the day count computed independently from the dataset's
// `nationalShow.countdownDate`.
//
// Verified live 2026-08-11 pre-implementation: read 402 days from the hydrated page,
// matching the dataset value — so the check passes today and can only break if the
// wrong field is removed or the wiring is disturbed.
//
// Read-only: mutates nothing.

import { chromium } from 'playwright';
import { loadEnv, groq, BASE_URL, assertDevServerUp, installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-countdown-regression');

const TOLERANCE_DAYS = 1; // absorbs a midnight/timezone boundary crossing mid-run.

const env = loadEnv();
await assertDevServerUp();

const countdownDate = await groq(env, '*[_type == "nationalShow"][0].countdownDate');
if (!countdownDate) {
  fail(
    'nationalShow.countdownDate is unset in the dataset — this regression guard has nothing to ' +
      'compare against. It will not silently skip.'
  );
}
const expectedDays = Math.floor((new Date(countdownDate).getTime() - Date.now()) / 86_400_000);
console.log(`Dataset nationalShow.countdownDate implies ~${expectedDays} days remaining.`);

const browser = await chromium.launch();
let actualDays = null;
try {
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  // Wait for hydration to replace the SSR "00" placeholders with live values.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('section span.font-serif')]
        .map((el) => el.textContent.trim())
        .some((t) => /^\d+$/.test(t) && Number(t) > 0),
    undefined,
    { timeout: 30_000 }
  );
  const numbers = (await page.locator('section:has-text("Days") span.font-serif').allTextContents())
    .map((t) => t.trim())
    .filter((t) => /^\d+$/.test(t));
  if (numbers.length < 4) {
    fail(
      `expected four countdown numbers (days/hours/minutes/seconds) on the home page, found ` +
        `${numbers.length}: ${JSON.stringify(numbers)}. The ShowBand countdown appears to be gone ` +
        'or restructured.'
    );
  }
  actualDays = Number(numbers[0]);
} finally {
  await browser.close();
}

console.log(`Home page countdown rendered ${actualDays} days.`);

if (Math.abs(actualDays - expectedDays) > TOLERANCE_DAYS) {
  fail(
    `home page countdown shows ${actualDays} days but nationalShow.countdownDate implies ` +
      `${expectedDays}. Removing homePage.countdownDate must not disturb the LIVE countdown, which ` +
      'is driven by nationalShow.countdownDate — check that the correct field was removed.'
  );
}

pass(`the home page countdown still tracks nationalShow.countdownDate (${actualDays} days).`);
