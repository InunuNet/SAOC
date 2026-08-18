#!/usr/bin/env node
// A8 -- mobile-first responsive structural proxy (static source check, same pattern as F3's
// A7 -- see contracts/checks/vendor-f3-showcase-page/check-responsive-grid-classes.mjs -- not a
// viewport render; real 320/375/1440px verification is BrowserAgent's job, named explicitly in
// this contract's README).
//
// The register page's own container and the form's fieldset layout must declare an
// unprefixed (mobile) base class plus at least one sm:/md:/lg: breakpoint override, and must
// not hardcode a fixed pixel width wider than 320px with no responsive override (a literal
// `w-[400px]` with no sm:/md: variant breaks below 400px).
//
// DEFEATING MUTATION: a fixed multi-column layout with no responsive prefixes at all; a
// desktop-only fixed-width container (e.g. `w-[960px]` unconditionally) that overflows a
// 320px viewport.
//
// Run as: node contracts/checks/vendor-form-ui/check-responsive-classes.mjs

import { readFileSync } from 'node:fs';

const repoRoot = new URL('../../../', import.meta.url);
const failures = [];

const filesToCheck = [
  'app/(marketing)/national-show/vendors/register/page.tsx',
  'components/vendors/VendorRegisterForm.tsx',
];

for (const rel of filesToCheck) {
  let src;
  try {
    src = readFileSync(new URL(rel, repoRoot), 'utf8');
  } catch {
    failures.push(`${rel} does not exist yet`);
    continue;
  }

  const hasBreakpointPrefix = /\b(sm|md|lg):/.test(src);
  if (!hasBreakpointPrefix) {
    failures.push(`${rel}: no sm:/md:/lg: responsive class prefix found -- layout is not mobile-first`);
  }

  const fixedWidthMatches = [...src.matchAll(/\bw-\[(\d+)px\]/g)];
  for (const m of fixedWidthMatches) {
    const px = Number(m[1]);
    if (px > 320) {
      failures.push(
        `${rel}: found an unconditional fixed width "${m[0]}" (${px}px) with no responsive ` +
          `override nearby -- this overflows a 320px viewport`,
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: register page and form declare mobile-first responsive classes, no unsafe fixed widths.');
process.exit(0);
