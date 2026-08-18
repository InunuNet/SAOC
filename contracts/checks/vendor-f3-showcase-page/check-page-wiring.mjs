#!/usr/bin/env node
// A4 — page.tsx wiring: static source inspection, NOT a live render.
//
// Why static, unlike A2/A3/A5: page.tsx calls sanityFetch(), which calls next/headers'
// draftMode() and (when a Sanity client is configured) a real network fetch against the
// Content Lake. Actually invoking the real async Page() function here would violate this
// contract's own "no live Sanity" constraint — sanityFetch has no injectable seam (it is a
// bare top-level function, not a prop or dependency-injected client), so the only way to test
// page.tsx offline is to read its source and confirm it is wired correctly, while the pieces
// it wires together (VendorIntro, VendorGrid, VendorEmptyState) are each independently proven
// by real renders in A2/A3/A5. This is a deliberate, named gap — see golden README "What this
// contract does NOT prove."
//
// DEFEATING MUTATION: hardcoding fixture-looking nursery data directly in page.tsx instead of
// calling sanityFetch (would make A2/A3/A5 pass while the real page never touches Sanity);
// always rendering VendorGrid regardless of whether nurseries is empty (VendorGrid already
// returns null on empty, so this bug is invisible in the DOM output but means the required
// empty-state message never appears — this check catches it by requiring the literal
// VendorEmptyState token AND a length/branch check, not just VendorGrid's presence); marking
// the file 'use client' (this is Sanity-fetched, non-interactive content — must stay a Server
// Component per project convention); dropping the revalidate export (breaks the project's
// documented 60s CDN-staleness bound, same class of regression cms-loop-f1-cdn-purge exists to
// prevent).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-page-wiring.mjs

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const pagePath = `${repoRoot}app/(marketing)/national-show/vendors/page.tsx`;
const loadingPath = `${repoRoot}app/(marketing)/national-show/vendors/loading.tsx`;

const failures = [];

if (!existsSync(pagePath)) {
  failures.push(`app/(marketing)/national-show/vendors/page.tsx does not exist`);
}
if (!existsSync(loadingPath)) {
  failures.push(
    `app/(marketing)/national-show/vendors/loading.tsx does not exist — every other Sanity-backed ` +
      `route under app/(marketing)/national-show/ ships a loading.tsx (exhibitors/, faq/, ` +
      `plan-your-visit/, what-to-expect/); this route should not be the exception`,
  );
}

if (existsSync(pagePath)) {
  const src = readFileSync(pagePath, 'utf8');

  if (/^\s*['"]use client['"]/m.test(src)) {
    failures.push(`page.tsx is marked 'use client' — this must stay a Server Component`);
  }
  if (!/sanityFetch/.test(src)) {
    failures.push(`page.tsx does not call sanityFetch — nurseries must come from Sanity, not hardcoded data`);
  }
  if (!/vendorNurseriesQuery/.test(src)) {
    failures.push(`page.tsx does not reference vendorNurseriesQuery`);
  }
  if (!/export const revalidate\s*=\s*60/.test(src)) {
    failures.push(
      `page.tsx does not export "revalidate = 60" — every other CMS-backed route on this site ` +
        'bounds CDN staleness to 60s; this route should not silently opt out',
    );
  }
  if (!/VendorIntro/.test(src)) {
    failures.push(`page.tsx does not reference VendorIntro — Lee-Ann's prose has nowhere to render from`);
  }
  if (!/VendorGrid/.test(src)) {
    failures.push(`page.tsx does not reference VendorGrid`);
  }
  if (!/VendorEmptyState/.test(src)) {
    failures.push(
      `page.tsx does not reference VendorEmptyState — since VendorGrid itself renders nothing ` +
        'for an empty list, page.tsx must render VendorEmptyState in that branch itself, or the ' +
        'zero-nurseries starting state renders as a blank page',
    );
  }
  // A real branch, not both components rendered unconditionally side by side.
  if (!/\.length/.test(src)) {
    failures.push(
      `page.tsx never checks nurseries.length — expected a conditional branch between ` +
        'VendorGrid and VendorEmptyState, not both always rendered together',
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: page.tsx is wired correctly (structural check — see README for why this is not a live render).');
process.exit(0);
