#!/usr/bin/env node
// A7 — mobile-first responsive proxy: VendorGrid's outer grid container declares a
// single-column base layout with wider breakpoints layered on top, matching the project's own
// established convention (components/sponsors/SponsorGrid.tsx: "grid-cols-1 sm:grid-cols-2
// lg:grid-cols-3"). This is a structural proxy, not a real viewport test — see golden README
// "What this contract does NOT prove": whether the layout actually reads well at 320px is a
// visual judgement, left to @qa/BrowserAgent per the project's coding rules
// (.claude/rules/coding.md: "Mobile-first responsive: Design for 320px width up ... No new
// colours" is enforced by review, not a compiler-checkable fact for CSS).
//
// DEFEATING MUTATION: a fixed multi-column grid with no responsive prefixes at all (e.g. just
// "grid grid-cols-3"), which lays out three cramped columns on a 320px phone screen.
//
// Run as: node contracts/checks/vendor-f3-showcase-page/check-responsive-grid-classes.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const gridPath = `${repoRoot}components/vendors/VendorGrid.tsx`;

const failures = [];

let src;
try {
  src = readFileSync(gridPath, 'utf8');
} catch (error) {
  failures.push(`could not read components/vendors/VendorGrid.tsx: ${error.message}`);
}

if (src !== undefined) {
  if (!/grid-cols-1\b/.test(src)) {
    failures.push('VendorGrid.tsx has no unprefixed "grid-cols-1" base class — layout is not mobile-first');
  }
  if (!/\bsm:grid-cols-\d/.test(src) && !/\bmd:grid-cols-\d/.test(src)) {
    failures.push('VendorGrid.tsx has no sm: or md: grid-cols breakpoint class');
  }
  if (!/\blg:grid-cols-\d/.test(src)) {
    failures.push('VendorGrid.tsx has no lg: grid-cols breakpoint class');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: VendorGrid declares a mobile-first responsive grid (grid-cols-1 → sm/md → lg).');
process.exit(0);
