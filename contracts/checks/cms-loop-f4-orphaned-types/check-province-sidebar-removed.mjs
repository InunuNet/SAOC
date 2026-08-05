#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A6 — the positive-path assertion for `province`. The
// user-visible outcome of "remove the sidebar entry" IS the sidebar entry
// disappearing for a real editor in the real deployed Studio — so this is verified
// against the DEPLOYED Studio via real browser automation (Playwright), never by
// trusting the sanity/structure.ts source diff alone (a source change could be
// unmerged, mis-deployed, or shadowed by Studio-side caching — this check catches
// that class of gap the same way F6/F2 insist on verifying the deployed host).
//
// Two directions, BOTH required for a PASS — a check that only verified "Province is
// gone" could pass on a broken/blank Studio page that shows nothing at all, which
// would be a vacuous pass hiding a totally different failure:
//   (a) 'Province' must be ABSENT from the desk structure's top-level list (no link
//       with that exact accessible name).
//   (b) 'Award' — the CONTROL item — must be PRESENT, proving the structure pane
//       loaded correctly and other collection types are still listed normally; it
//       isn't "everything is gone because auth/render failed."
//
// Selector strategy (getByRole('link', { name, exact: true })) was verified live
// against the REAL deployed Studio during this contract's authoring, 2026-08-05,
// before either type had been touched: Province link count 1, Award link count 1 —
// confirming the selector correctly finds both entries in their current, unremoved
// state.
//
// EXPECTED RESULT TODAY: FAIL — 'Province' is still present (province has not yet
// been removed from COLLECTION_TYPES in sanity/structure.ts). 'Award' presence is
// expected to already PASS today and always (it's the invariant control, unaffected
// by this feature).
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-province-sidebar-removed.mjs
// Requires SANITY_API_TOKEN in .env.local and a working Playwright/Chromium install.
// Exit codes: 0 = Province absent AND Award present. 1 = Province still present,
// Award missing (structure pane broken), auth failure, or host unreachable — never a skip.

import { chromium } from 'playwright';
import { loadStudioToken, loadEnvOrFail, BASE_URL, SANITY_PROJECT_ID } from '../f6-prove-cms-loop/_shared.mjs';

loadEnvOrFail('SANITY_API_TOKEN'); // hard-fails with a clear message if missing, not a skip
const token = loadStudioToken();

let browser;
let exitCode = 1;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(
    ({ key, val }) => window.localStorage.setItem(key, val),
    { key: `__studio_auth_token_${SANITY_PROJECT_ID}`, val: JSON.stringify({ token, authenticated: true }) }
  );

  await page.goto(`${BASE_URL}/studio/structure`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(7000); // Studio is a heavy client app; the structure pane renders async.
  await page.keyboard.press('Escape');

  const provinceCount = await page.getByRole('link', { name: 'Province', exact: true }).count();
  const awardCount = await page.getByRole('link', { name: 'Award', exact: true }).count();
  console.log(`'Province' sidebar link count: ${provinceCount}`);
  console.log(`'Award' sidebar link count (control): ${awardCount}`);

  if (awardCount === 0) {
    console.error(
      "FAIL: 'Award' control item not found — the structure pane may not have loaded correctly (auth failure, " +
        'Studio UI change, or timing). Cannot trust a 0 count for Province under these conditions.'
    );
  } else if (provinceCount > 0) {
    console.error(
      `FAIL: 'Province' is still present in the Studio sidebar (count ${provinceCount}). Expected before @dev removes ` +
        "'province' from COLLECTION_TYPES in sanity/structure.ts — see contract header \"EXPECTED PRE-FIX RESULTS\"."
    );
  } else {
    console.log("PASS: 'Province' is absent from the sidebar, and 'Award' (control) is present.");
    exitCode = 0;
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (browser) await browser.close();
}

process.exit(exitCode);
