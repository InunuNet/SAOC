#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A8 — regression guard for `/societies`. F4's `province`
// change touches ONLY the Studio sidebar (sanity/structure.ts COLLECTION_TYPES);
// docs/f4-orphaned-types-recon.md confirmed nothing in
// app/(marketing)/societies/SocietiesClient.tsx or lib/data/provinces.ts is touched.
// This check proves that claim holds against the real deployed page, not just by
// re-reading the recon's static analysis — a live guard against an unintended
// regression the recon didn't anticipate.
//
// Two conditions:
//   (a) SOURCE: SocietiesClient.tsx still imports `provinces` from
//       `@/lib/data/provinces` (unchanged) — province filtering is NOT part of this
//       feature's migration scope, unlike award's static import (A5), which
//       deliberately IS retired.
//   (b) LIVE, REAL BROWSER: the deployed /societies page renders all 9 real province
//       filter chip BUTTONS after JS execution. Two false starts were caught and
//       fixed live during this contract's authoring, 2026-08-05, both worth noting so
//       nobody "fixes" this check back to the broken version later:
//         1. A plain `fetch()` (no JS) looked like it worked but was a FALSE
//            POSITIVE — SocietiesClient is wrapped in `<Suspense fallback={null}>`
//            (app/(marketing)/societies/page.tsx) because it calls
//            `useSearchParams()`, so the filter chips never appear in the raw server
//            HTML at all; the fetch only "found" province names by coincidence,
//            matching a DIFFERENT society's `region` field inside the RSC data
//            payload (e.g. "Western Cape" as the Cape Orchid Society's region
//            string), not the actual filter button. Switched to real Playwright
//            rendering.
//         2. The chip buttons render `province.code` (e.g. "WC", "KZN"), NOT the
//            full province name — confirmed by reading
//            app/(marketing)/societies/SocietiesClient.tsx:66
//            (`{p.code === 'ALL' ? 'All' : p.code}`) after the first Playwright
//            attempt (searching for full names) came back with all 9 false — so the
//            expected labels below are codes, not names.
//
// THIS IS AN INVARIANT CHECK: expected to PASS both before and after F4's `province`
// sidebar removal — a failure at ANY point means F4 broke something it explicitly
// should not have, independent of A6/A7's province-specific results.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-societies-unaffected.mjs
// Exit codes: 0 = both conditions hold. 1 = source changed, a province chip is
// missing live, or the host is unreachable — never a skip.

import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { BASE_URL } from '../f6-prove-cms-loop/_shared.mjs';

const SOCIETIES_CLIENT_PATH = new URL('../../../app/(marketing)/societies/SocietiesClient.tsx', import.meta.url);
const SOCIETIES_PAGE_PATH = '/societies';
// Chip button text, verbatim from SocietiesClient.tsx:66 — province CODES (not full
// names), plus 'All' for the ALL pseudo-entry. lib/data/provinces.ts order.
const EXPECTED_PROVINCE_LABELS = ['All', 'WC', 'EC', 'NC', 'FS', 'KZN', 'GP', 'MP', 'LP', 'NW'];

console.log("--- Condition (a): SocietiesClient.tsx still imports the static provinces list? ---");
let sourceText;
try {
  sourceText = readFileSync(SOCIETIES_CLIENT_PATH, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read app/(marketing)/societies/SocietiesClient.tsx — ${err.message}`);
  process.exit(1);
}
const importsStaticProvinces = /from\s+['"]@\/lib\/data\/provinces['"]/.test(sourceText);
console.log(`SocietiesClient.tsx imports '@/lib/data/provinces': ${importsStaticProvinces}`);
if (!importsStaticProvinces) {
  console.error(
    'FAIL: SocietiesClient.tsx no longer imports @/lib/data/provinces. F4 is scoped to remove only the Studio ' +
      'sidebar entry for the province DOCUMENT type — the free-text society.province field and its static ' +
      'lib/data/provinces filter list are explicitly out of scope and must remain unchanged.'
  );
  process.exit(1);
}

console.log('--- Condition (b): live /societies page renders all 9 province filter chip buttons (real browser) ---');
let browser;
let exitCode = 1;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}${SOCIETIES_PAGE_PATH}`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000); // client component hydration

  let missing = 0;
  for (const label of EXPECTED_PROVINCE_LABELS) {
    const count = await page.getByRole('button', { name: label, exact: true }).count();
    console.log(`  [${count > 0 ? 'PASS' : 'FAIL'}] "${label}" filter chip button present: ${count > 0}`);
    if (count === 0) missing += 1;
  }
  if (missing > 0) {
    console.error(`FAIL: ${missing} province filter chip button(s) missing from the rendered live /societies page.`);
  } else {
    console.log('PASS: SocietiesClient.tsx still uses the static provinces list, and all 9 filter chips render live.');
    exitCode = 0;
  }
} catch (err) {
  console.error(`FAIL: unexpected error — ${err.stack ?? err.message}`);
} finally {
  if (browser) await browser.close();
}
process.exit(exitCode);
