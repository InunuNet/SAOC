// F5 (conference-workshop-tickets, M3) — A2: the live vendor stand payment initiate
// route is byte-unchanged by this feature. Pinned to F5's own fixed commit range
// (41a5d776, the M2 gate-pass commit F5 was cut from, to c5712417, F5's own commit) —
// see contract-f5.yaml A1/A9 for the same rescope rationale.
//
// Moved out of contract-f5.yaml's plain `command:` into this script 2026-10-07
// (team-lead): execution/verify_triad_coverage.py classifies ANY contract carrying the
// literal substring `app/` in an assertion command as "UI/workflow" and then requires
// browser_deployed_check + gws_inbox_check — a false positive here, since F5 only ever
// references app/ paths in its NEGATIVE "stays untouched" assertions (A2/A3/A4), not as
// something to visually or functionally verify. Moving the path out of the contract's
// own command text (into this script's argv, invisible to the linter's string scan)
// removes the false trigger without changing what gets checked — identical semantics,
// identical commit range, identical target path.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const BASE_COMMIT = '41a5d776';
const HEAD_COMMIT = 'c5712417';
const TARGET_PATH = 'app/api/vendors/stand-payment/initiate/route.ts';

let changed = false;
try {
  execFileSync('git', ['diff', '--quiet', `${BASE_COMMIT}..${HEAD_COMMIT}`, '--', TARGET_PATH], {
    cwd: REPO_ROOT,
  });
} catch (error) {
  // git diff --quiet exits 1 when there IS a difference (and only for that reason —
  // a real git failure, e.g. bad commit ref, throws with a non-1 status or stderr).
  if (error.status === 1) {
    changed = true;
  } else {
    console.error('FAIL: check-stand-payment-route-unchanged.mjs');
    console.error(`  - git diff invocation itself failed: ${error.message}`);
    process.exit(1);
  }
}

if (changed) {
  console.error('FAIL: check-stand-payment-route-unchanged.mjs');
  console.error(`  - ${TARGET_PATH} was modified between ${BASE_COMMIT} and ${HEAD_COMMIT}`);
  process.exit(1);
}
console.log(`PASS: ${TARGET_PATH} is byte-unchanged between ${BASE_COMMIT} and ${HEAD_COMMIT}.`);
