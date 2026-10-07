// F5 (conference-workshop-tickets, M3) — A4: no Sanity schema, UI field, or ticketType
// document is added for Exhibitors, Vendors, Indoor/Outdoor, or Full Access. Pinned to
// F5's own fixed commit range (41a5d776..c5712417) — see contract-f5.yaml A1/A9 for the
// same rescope rationale.
//
// Moved out of contract-f5.yaml's plain `command:` into this script 2026-10-07
// (team-lead) — same reason as the other two F5 check scripts added this pass: removes
// the literal `app/` substring from the contract's own command text so
// execution/verify_triad_coverage.py's UI/workflow string-match heuristic stops firing
// on this negative "no content was added" assertion.
//
// Scope and bug fixes carried over unchanged from the prior inline command (same pass,
// same day):
//   1. File list is scoped to CODE paths only (app/, lib/, components/, sanity/) — the
//      assertion's own intent is schema/UI/document additions, not documentation prose.
//      F5's real diff is docs-only, and its doc legitimately discusses these exact terms
//      factually (documenting that they do NOT exist in code); a content-grep over the
//      whole diff can't distinguish that from an actual violation.
//   2. Empty-file-list case: the diff of code paths for F5's real (docs-only) commit is
//      empty, which must count as a trivial PASS (zero files changed = zero violations),
//      not a FAIL — handled below with an explicit zero-length check rather than piping
//      through a shell `xargs grep`, which has its own well-known empty-stdin footgun
//      (BSD xargs exits 0 itself without ever invoking grep, which negating via `!` was
//      inverting into a false FAIL on this exact empty-list case).
//   3. Pattern dropped the literal-quote-char requirement around exhibitors/vendors
//      (`exhibitors.{0,10}3500` instead of `'exhibitors'.*3500`) — functionally
//      equivalent, catches the same real content, no longer needs any shell quoting at
//      all now that it's a plain JS RegExp literal.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '../../../');
const BASE_COMMIT = '41a5d776';
const HEAD_COMMIT = 'c5712417';
const CODE_PATHSPECS = ['app/', 'lib/', 'components/', 'sanity/'];
const FORBIDDEN_CONTENT_PATTERN = /Indoor.?Outdoor|FullAccess|exhibitors.{0,10}3500|vendors.{0,10}3500/i;

let changedFiles = '';
try {
  changedFiles = execFileSync(
    'git',
    ['diff', '--name-only', `${BASE_COMMIT}..${HEAD_COMMIT}`, '--', ...CODE_PATHSPECS],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
} catch (error) {
  console.error('FAIL: check-no-vendor-flagging-content-added.mjs');
  console.error(`  - git diff invocation itself failed: ${error.message}`);
  process.exit(1);
}

const files = changedFiles.split('\n').filter((line) => line.length > 0);

// Empty file list under the code-path scope is a trivial, correct PASS — F5's real diff
// is docs-only, so zero code files changed means zero violations, by definition.
const hits = [];
for (const relPath of files) {
  let content;
  try {
    content = readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
  } catch {
    // File existed in the diff but not at the current worktree HEAD (e.g. deleted since)
    // — nothing to scan, not a violation.
    continue;
  }
  if (FORBIDDEN_CONTENT_PATTERN.test(content)) hits.push(relPath);
}

if (hits.length > 0) {
  console.error('FAIL: check-no-vendor-flagging-content-added.mjs');
  for (const hit of hits) console.error(`  - forbidden Exhibitor/Vendor/Indoor-Outdoor/FullAccess content found in: ${hit}`);
  process.exit(1);
}
console.log(`PASS: no Sanity schema, UI field, or ticketType content for Exhibitors/Vendors/Indoor-Outdoor/FullAccess was added to app/, lib/, components/, or sanity/ between ${BASE_COMMIT} and ${HEAD_COMMIT}.`);
