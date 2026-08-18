#!/usr/bin/env node
// A2 — VendorGrid actually renders fixture nursery data: real react-dom/server output,
// text-content and href checks, not a source grep. Proven offline: no Sanity client, no
// network, no next/image loader network call (createImageUrlBuilder is a pure URL builder —
// confirmed against the real sanity/lib/image.ts urlFor() while writing this contract).
//
// Exercises three shapes from fixtures/nurseries.fixture.json:
//   [] (empty)          — zero nurseries: component must render nothing (page.tsx owns the
//                          empty-state message instead — see A3/A4).
//   [fixture #1]         — one fully-populated nursery: every optional field set.
//   [fixture #1, #2, #3] — three nurseries, one with almost every optional field null, to
//                          prove optional fields are conditionally rendered, not `undefined`
//                          leaking into the DOM, and order is preserved (component must not
//                          re-sort — sort order is the query's job, per queries.ts convention).
//
// DEFEATING MUTATION: a field present in the fixture (e.g. `owner`) never appearing in JSX;
// rendering the literal string "null"/"undefined" for an unset optional field instead of
// omitting it; a website/social `<a>` missing its real `href`; dropping `target="_blank"
// rel="noopener noreferrer"` on an external link (security regression, not just cosmetic);
// re-sorting the nursery list instead of rendering it in the order the prop array arrived in.
//
// Run as: node --import tsx/esm contracts/checks/vendor-f3-showcase-page/check-grid-renders-fixture-data.mjs

import { readFileSync } from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

// tsx's ESM hook resolves the project's `@/*` tsconfig path alias, but its CJS hook
// (which loads .tsx files, since package.json has no "type": "module") does not —
// VendorGrid's `@/sanity/lib/image` import fails with MODULE_NOT_FOUND without this.
const CHECK_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CHECK_DIR, '../../..');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  let mapped = request;
  if (request.startsWith('@/')) mapped = path.join(REPO_ROOT, request.slice(2));
  // Real next/image throws on any remote src outside a Next server (next.config.ts's
  // remotePatterns are never loaded here) — see stubs/next-image.cjs.
  if (request === 'next/image') mapped = path.join(CHECK_DIR, 'stubs/next-image.cjs');
  return originalResolveFilename.call(this, mapped, ...rest);
};

// sanity/env.ts falls back to projectId '' when unset, producing a malformed
// cdn.sanity.io/images//production/... URL — pin a fixture id for a well-formed one.
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ??= 'fixture0';

const { VendorGrid } = await import('../../../components/vendors/VendorGrid.tsx');

const fixturePath = new URL('./fixtures/nurseries.fixture.json', import.meta.url);
const nurseries = JSON.parse(readFileSync(fixturePath, 'utf8'));
const [full, minimal, partial] = nurseries;

const failures = [];
const stripTags = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// --- empty: renders nothing ---
const emptyHtml = renderToStaticMarkup(React.createElement(VendorGrid, { nurseries: [] })) ?? '';
if (emptyHtml.trim() !== '') {
  failures.push(
    `VendorGrid({ nurseries: [] }) must render nothing (page.tsx owns the empty-state message) ` +
      `— got: ${emptyHtml.slice(0, 200)}`,
  );
}

// --- one fully-populated nursery ---
const oneHtml = renderToStaticMarkup(React.createElement(VendorGrid, { nurseries: [full] }));
const oneText = stripTags(oneHtml);

for (const field of ['name', 'country', 'owner', 'history', 'specialisation', 'plantsBrought']) {
  const value = full[field];
  if (!oneText.includes(value)) {
    failures.push(`VendorGrid does not render ${full.name}'s "${field}" field ("${value}")`);
  }
}
for (const tag of full.availableAtShow) {
  if (!oneText.includes(tag)) {
    failures.push(`VendorGrid does not render availableAtShow tag "${tag}" for ${full.name}`);
  }
}
if (!oneHtml.includes(`href="${full.website}"`)) {
  failures.push(`VendorGrid does not render an <a href="${full.website}"> for the website link`);
}
for (const social of full.socialMedia) {
  if (!oneHtml.includes(`href="${social.url}"`)) {
    failures.push(`VendorGrid does not render an <a href="${social.url}"> for ${social.platform}`);
  }
}
// External links must not leak referrer/opener context — a real security property, not decoration.
const externalLinkPattern = /<a\s+[^>]*href="https:\/\/[^"]+"[^>]*>/g;
const externalLinks = oneHtml.match(externalLinkPattern) ?? [];
if (externalLinks.length === 0) {
  failures.push('expected at least one external <a href="https://..."> link in the one-nursery render');
}
for (const link of externalLinks) {
  if (!/target="_blank"/.test(link) || !/rel="noopener noreferrer"/.test(link)) {
    failures.push(`external link missing target="_blank" rel="noopener noreferrer": ${link}`);
  }
}
// The logo must reach an <img> whose src is the urlFor()-built CDN URL for the fixture's
// asset _ref (next/image is stubbed to a plain <img> here — see stubs/next-image.cjs —
// so assert on the resolved src, which the real component would receive identically).
const logoImgPattern = /<img\s+[^>]*src="[^"]*fixture1-800x600\.jpg[^"]*"[^>]*>/;
const logoImg = oneHtml.match(logoImgPattern);
if (!logoImg) {
  failures.push(`VendorGrid does not render the logo <img> for ${full.name} (no img src built from the fixture asset _ref)`);
} else if (!logoImg[0].includes(`alt="${full.name} logo"`)) {
  failures.push(`logo <img> for ${full.name} is missing its alt="${full.name} logo" text`);
}

// --- three nurseries: optional fields omitted cleanly, order preserved ---
const threeHtml = renderToStaticMarkup(
  React.createElement(VendorGrid, { nurseries: [full, minimal, partial] }),
);
const threeText = stripTags(threeHtml);

if (/\bnull\b/.test(threeText) || /\bundefined\b/.test(threeText)) {
  failures.push(
    `VendorGrid leaks the literal word "null" or "undefined" into rendered text when optional ` +
      `fields are unset (nursery "${minimal.name}" has almost every optional field null)`,
  );
}
if (!threeText.includes(minimal.name)) {
  failures.push(`VendorGrid does not render "${minimal.name}" (a nursery with no optional fields set)`);
}
if (!threeText.includes(partial.name)) {
  failures.push(`VendorGrid does not render "${partial.name}"`);
}

const positions = [full, minimal, partial].map((n) => threeText.indexOf(n.name));
if (positions.some((p) => p === -1)) {
  failures.push(`one of the three fixture nursery names did not appear in the three-nursery render`);
} else if (!(positions[0] < positions[1] && positions[1] < positions[2])) {
  failures.push(
    `VendorGrid re-sorted the nursery list instead of rendering the prop array's order — ` +
      `positions: ${JSON.stringify(positions)}`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: VendorGrid renders fixture data correctly for 0, 1, and 3 nurseries.');
process.exit(0);
