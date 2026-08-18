#!/usr/bin/env node
// A6 — scope guard: the two files this feature's dispatch explicitly says not to touch
// (the ITN webhook route and the F1-established exhibitor-entry route it must not collide
// with) are byte-identical to the baseline hash captured before any F3 code existed.
//
// Not a "vendor* naming collision" check (F1F2's own contract already gates that against the
// schema layer) — this is a plain regression guard against scope creep into unrelated,
// currently-shipping code paths. branding/ is deliberately NOT included here: it is another
// agent's active, independently-changing workstream (see project memory
// project_design_folders_brad_active) — hashing its contents would produce false failures on
// every legitimate concurrent edit that has nothing to do with F3.
//
// DEFEATING MUTATION: any edit to app/api/tickets/itn/route.ts or
// app/(marketing)/national-show/exhibitors/page.tsx while implementing F3 — including a
// "helpful" refactor, an added import, or reformatting.
//
// Run as: node contracts/checks/vendor-f3-showcase-page/check-untouched-scope.mjs
// (no TypeScript import needed — this only reads file bytes, so plain `node` is fine here.)

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const baselinePath = new URL('./fixtures/untouched-files.baseline.json', import.meta.url);
const { files: baseline } = JSON.parse(readFileSync(baselinePath, 'utf8'));

const failures = [];

for (const [relPath, expectedHash] of Object.entries(baseline)) {
  const fullPath = `${repoRoot}${relPath}`;
  let actualHash;
  try {
    actualHash = createHash('sha256').update(readFileSync(fullPath)).digest('hex');
  } catch (error) {
    failures.push(`could not read ${relPath}: ${error.message}`);
    continue;
  }
  if (actualHash !== expectedHash) {
    failures.push(
      `${relPath} changed since the F3 baseline (expected sha256 ${expectedHash}, got ` +
        `${actualHash}) — this file is out of F3's scope; revert unrelated edits`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: itn route and the exhibitor-entry route are unchanged from the pre-F3 baseline.');
process.exit(0);
