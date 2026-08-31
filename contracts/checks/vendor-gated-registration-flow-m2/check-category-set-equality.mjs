#!/usr/bin/env node
// F13 (vendor-gated-registration-flow, M2) — A23: the VendorCategory union in types/index.ts
// is set-identical to the runtime VENDOR_CATEGORIES constant in lib/vendor-submissions.ts.
// Source-grep, not a compiled import (the union is a TYPE, erased at runtime -- there is
// nothing to import and compare programmatically) -- but scoped precisely to each
// declaration's own block, not a whole-file grep, so it cannot match an unrelated list
// (see A25's fix on 2026-08-31 for why that distinction matters on this file/mission).
//
// FAILS ON: 'other' present in either set, or any value present in one but not the other
// (added, removed, or misspelled in only one place).
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m2/check-category-set-equality.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function extractQuotedValues(text) {
  const matches = text.matchAll(/'([a-z0-9-]+)'/g);
  return new Set(Array.from(matches, (m) => m[1]));
}

function extractBlock(source, startMarker, closeToken) {
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`marker not found: ${startMarker}`);
  }
  const closeIdx = source.indexOf(closeToken, startIdx);
  if (closeIdx === -1) {
    throw new Error(`no closing "${closeToken}" found after marker: ${startMarker}`);
  }
  return source.slice(startIdx, closeIdx);
}

const typesSource = readFileSync(path.join(ROOT, 'types/index.ts'), 'utf8');
const submissionsSource = readFileSync(path.join(ROOT, 'lib/vendor-submissions.ts'), 'utf8');

// The union type is pipe-separated and terminates with ';', not a closing bracket.
const unionBlock = extractBlock(typesSource, 'export type VendorCategory =', ';');
const constBlock = extractBlock(submissionsSource, 'const VENDOR_CATEGORIES: readonly VendorCategory[] = [', '\n]');

const unionValues = extractQuotedValues(unionBlock);
const constValues = extractQuotedValues(constBlock);

const failures = [];

if (unionValues.has('other') || constValues.has('other')) {
  failures.push(`'other' must not be a member of either set. union has 'other': ${unionValues.has('other')}, const has 'other': ${constValues.has('other')}.`);
}

const onlyInUnion = [...unionValues].filter((v) => !constValues.has(v));
const onlyInConst = [...constValues].filter((v) => !unionValues.has(v));

if (onlyInUnion.length > 0) {
  failures.push(`present in VendorCategory union but missing from VENDOR_CATEGORIES: ${JSON.stringify(onlyInUnion)}.`);
}
if (onlyInConst.length > 0) {
  failures.push(`present in VENDOR_CATEGORIES but missing from VendorCategory union: ${JSON.stringify(onlyInConst)}.`);
}
if (unionValues.size !== 14) {
  failures.push(`expected 14 members in VendorCategory union, got ${unionValues.size}: ${JSON.stringify([...unionValues])}.`);
}
if (constValues.size !== 14) {
  failures.push(`expected 14 members in VENDOR_CATEGORIES, got ${constValues.size}: ${JSON.stringify([...constValues])}.`);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: VendorCategory union and VENDOR_CATEGORIES are set-identical, 14 members, no \'other\'.');
process.exit(0);
