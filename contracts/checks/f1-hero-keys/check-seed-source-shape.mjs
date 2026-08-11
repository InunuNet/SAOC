#!/usr/bin/env node
// F1 (saoc-pages-editable): fast, network-free structural check that the fix is
// actually present in source — catches a case where check-seed-idempotent-keys.mjs
// might pass against dataset state left over from a one-off manual repair (e.g.
// someone clicking Studio's "Add missing keys" button) without the code itself ever
// being changed, which would leave the bug live for the next reseed.
//
// This is deliberately narrow: it does not re-derive the whole file's correctness,
// it only asserts the two specific code shapes the implementation spec requires.
//
// Run as: node contracts/checks/f1-hero-keys/check-seed-source-shape.mjs
// Exit codes: 0 = both required shapes present. 1 = either is missing.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const filePath = path.resolve(process.cwd(), 'scripts/seed-page-singletons.ts');
let src;
try {
  src = readFileSync(filePath, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read ${filePath} — ${err.message}`);
  process.exit(1);
}

const failures = [];

// 1. uploadImage() must attach a _key to every image object it returns, so any
//    freshly uploaded array item is born with one.
const uploadImageMatch = src.match(/function uploadImage\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
if (!uploadImageMatch) {
  failures.push('could not locate uploadImage() function');
} else if (!/_key:\s*randomUUID\(\)/.test(uploadImageMatch[1])) {
  failures.push('uploadImage() does not set `_key: randomUUID()` on the returned image object');
}

// 2. imageArrayFieldOrReuse() must backfill a _key onto reused existing items (not
//    just onto newly-uploaded ones) — this is what repairs the already-broken live
//    array without re-uploading duplicate assets.
const reuseMatch = src.match(/function imageArrayFieldOrReuse\([^)]*\)[\s\S]*?\n\}\n/);
if (!reuseMatch) {
  failures.push('could not locate imageArrayFieldOrReuse() function');
} else if (!/_key/.test(reuseMatch[0].split('uploaded.push')[0])) {
  // Everything before the "upload fresh" fallback branch is the reuse branch.
  failures.push('imageArrayFieldOrReuse() reuse branch does not reference `_key` — existing items are not backfilled');
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: scripts/seed-page-singletons.ts generates _key on upload and backfills it on reuse.');
process.exit(0);
