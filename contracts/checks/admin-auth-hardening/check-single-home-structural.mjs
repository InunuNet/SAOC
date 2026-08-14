// A-STRUCT-01 — supersedes contract-d5-admin-dashboard.yaml's D5-04 (see
// contracts/golden/admin-auth-hardening/README.md for why D5-04 is a false-green risk).
// This is a STRUCTURAL check, used only for the one fact a grep can actually settle:
// the authorisation decision has exactly ONE home. It does not, and cannot, prove the
// decision is CORRECT — that is what every behavioural check in this contract is for.
//
// Two things, both required:
//   1. every one of the six admin surfaces imports getAdminSession or isAdminToken
//      from lib/admin-auth (the '@/lib/admin-auth' alias or a relative equivalent);
//   2. NONE of them still contains the old inline duplicated check
//      (decodedToken.admin === true / ['role'] === 'admin'), which would mean the
//      refactor was only partially done and two sources of truth now disagree silently.

import { readFileSync } from 'node:fs';

const SURFACES = [
  'app/admin/page.tsx',
  'app/admin/door/layout.tsx',
  'app/api/admin/tickets/route.ts',
  'app/api/admin/checkin/route.ts',
  'app/api/admin/export-csv/route.ts',
  'app/api/admin/session/route.ts',
];

const IMPORT_PATTERN = /from ['"](@\/)?lib\/admin-auth['"]/;
const INLINE_RESIDUE_PATTERN = /decodedToken\.admin\s*===\s*true|\[['"]role['"]\]\s*===\s*['"]admin['"]/;

let failures = 0;
for (const relPath of SURFACES) {
  let content;
  try {
    content = readFileSync(relPath, 'utf8');
  } catch {
    console.error(`  FAIL  ${relPath} does not exist`);
    failures += 1;
    continue;
  }
  if (!IMPORT_PATTERN.test(content)) {
    console.error(`  FAIL  ${relPath} does not import from lib/admin-auth`);
    failures += 1;
  } else {
    console.log(`  PASS  ${relPath} imports from lib/admin-auth`);
  }
  if (INLINE_RESIDUE_PATTERN.test(content)) {
    console.error(`  FAIL  ${relPath} still contains an inline admin-claim check — the decision has more than one home`);
    failures += 1;
  } else {
    console.log(`  PASS  ${relPath} has no inline admin-claim check residue`);
  }
}

// Self-test: the residue pattern must actually fire on the OLD code shape, or this
// check is as toothless as D5-04 was.
const oldShapeFixture =
  "const isAdmin = decodedToken.admin === true || (decodedToken as Record<string, unknown>)['role'] === 'admin';";
if (!INLINE_RESIDUE_PATTERN.test(oldShapeFixture)) {
  console.error('  FAIL  self-test: INLINE_RESIDUE_PATTERN does not detect the known old inline-check shape');
  failures += 1;
} else {
  console.log('  PASS  self-test: INLINE_RESIDUE_PATTERN detects the known old inline-check shape');
}

if (failures > 0) {
  console.error(`FAIL: A-STRUCT-01 — ${failures} failing assertion(s)`);
  process.exit(1);
}
console.log('PASS: A-STRUCT-01 single home for the admin authorisation decision');
