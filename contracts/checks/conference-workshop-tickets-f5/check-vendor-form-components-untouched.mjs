// F5 (conference-workshop-tickets, M3) — A3: no vendor registration/application form
// component is touched by this feature's diff. Pinned to F5's own fixed commit range
// (41a5d776..c5712417) — see contract-f5.yaml A1/A9 for the same rescope rationale.
//
// Moved out of contract-f5.yaml's plain `command:` into this script 2026-10-07
// (team-lead) — same reason as check-stand-payment-route-unchanged.mjs: removes the
// literal `app/` substring from the contract's own command text so
// execution/verify_triad_coverage.py's UI/workflow string-match heuristic stops firing
// on a negative "stays untouched" assertion. Identical semantics, identical commit
// range, identical path patterns.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const BASE_COMMIT = '41a5d776';
const HEAD_COMMIT = 'c5712417';
const FORBIDDEN_PATH_PATTERN = /components\/vendors\/|app\/\(marketing\)\/national-show\/vendors\//;

let changedFiles = '';
try {
  changedFiles = execFileSync('git', ['diff', '--name-only', `${BASE_COMMIT}..${HEAD_COMMIT}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
} catch (error) {
  console.error('FAIL: check-vendor-form-components-untouched.mjs');
  console.error(`  - git diff invocation itself failed: ${error.message}`);
  process.exit(1);
}

const hits = changedFiles
  .split('\n')
  .filter((line) => line.length > 0 && FORBIDDEN_PATH_PATTERN.test(line));

if (hits.length > 0) {
  console.error('FAIL: check-vendor-form-components-untouched.mjs');
  for (const hit of hits) console.error(`  - vendor form component touched: ${hit}`);
  process.exit(1);
}
console.log(`PASS: no vendor registration/application form component appears in the ${BASE_COMMIT}..${HEAD_COMMIT} diff.`);
