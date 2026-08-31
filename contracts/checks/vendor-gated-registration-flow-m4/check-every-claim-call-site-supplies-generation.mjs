#!/usr/bin/env node
// vendor-gated-registration-flow M4 -- A42-style STANDING regression guard, not a one-off
// instance check. `expectedGeneration` is OPTIONAL on ClaimRegistrationTokenOptions
// (lib/vendor-registration-token-claim.ts) purely so check-single-use-claim-is-atomic.mjs's own
// pre-generation call shapes keep working -- omitting it means "do not check the generation",
// never "any generation matches". A future call site that forgets the argument silently loses
// reissue revocation while every visible behaviour, and the gate, stays green (exactly the
// `vendorCategoryOther` shape of defect A42 already generalises against).
//
// Rather than hardcoding "app/api/vendors/register/route.ts must pass expectedGeneration"
// (satisfied today, but blind to a second call site added tomorrow), this scans every
// `claimRegistrationToken(` CALL EXPRESSION in the tracked source tree (excluding the module
// that defines it, and this checks/ directory's own fixtures) and asserts EACH one supplies
// `expectedGeneration` in its options argument. Also asserts the scan is not vacuous -- it must
// find at least one real call site, or this check would pass by finding nothing to check
// (the same "vacuous scan" trap A42's own header calls out).
//
// Run as: node contracts/checks/vendor-gated-registration-flow-m4/check-every-claim-call-site-supplies-generation.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;
const DEFINING_MODULE = 'lib/vendor-registration-token-claim.ts';
const failures = [];

// `git grep` over TRACKED files only -- deliberately excludes untracked scratch/build output,
// same convention as this project's other repo-wide structural scans (e.g. A18).
let grepOutput;
try {
  grepOutput = execFileSync(
    'git',
    // Restricted to real source (.ts/.tsx) -- markdown docs and this very YAML contract also
    // mention the literal string "claimRegistrationToken()" in PROSE (as the function's name,
    // with no options argument at all), which is not a call site and must not be scanned as one.
    ['grep', '-n', '-l', '--', 'claimRegistrationToken(', '*.ts', '*.tsx'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
} catch (error) {
  // git grep exits 1 when it finds nothing -- that IS a failure condition here (see the
  // vacuous-scan guard below), not a tool error, so don't crash on it.
  if (error.status === 1) {
    grepOutput = '';
  } else {
    throw error;
  }
}

const candidateFiles = grepOutput
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  // Exclude the defining module itself (its own internal reference is the function
  // declaration/JSDoc, not a call site) and every contracts/checks/** fixture (this file and
  // its siblings intentionally exercise pre-generation and omitted-option call shapes as
  // deliberate test cases, not production call sites).
  .filter((f) => f !== DEFINING_MODULE && !f.startsWith('contracts/checks/'));

let totalCallSites = 0;

for (const file of candidateFiles) {
  const raw = readFileSync(new URL(file, `file://${REPO_ROOT}`), 'utf8');
  // Strip comments so a call site mentioned only in prose (JSDoc, inline comment) is never
  // mistaken for a real call expression -- same precaution as this mission's other structural
  // checks (e.g. check-approval-mints-code-atomically.mjs).
  const source = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  let searchFrom = 0;
  for (;;) {
    const at = source.indexOf('claimRegistrationToken(', searchFrom);
    if (at === -1) break;
    totalCallSites += 1;

    // Grab a generous window after the call site for the options-object argument -- balanced-
    // paren parsing is unnecessary here since we only need to know whether `expectedGeneration`
    // appears anywhere before the call statement plausibly ends (next top-level `;` followed by
    // a newline, or 800 chars, whichever comes first -- generous enough for a multi-line options
    // object, tight enough not to accidentally read into an unrelated later call).
    const window = source.slice(at, at + 800);
    const semicolonBoundary = window.indexOf(';\n');
    const clause = semicolonBoundary === -1 ? window : window.slice(0, semicolonBoundary + 1);

    if (!/expectedGeneration\s*:/.test(clause)) {
      failures.push(
        `${file}: a claimRegistrationToken(...) call site does not supply expectedGeneration -- ` +
          `this call would claim without checking the registration-code generation, silently ` +
          `losing reissue revocation for this caller. Context: ${clause.trim().slice(0, 200)}`,
      );
    }

    searchFrom = at + 'claimRegistrationToken('.length;
  }
}

if (totalCallSites === 0) {
  failures.push(
    'Found ZERO claimRegistrationToken(...) call sites outside the defining module and ' +
      'contracts/checks/** -- this check would otherwise pass vacuously. Either the production ' +
      'call site was removed/renamed, or this scan\'s file/pattern exclusions are wrong.',
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: every claimRegistrationToken(...) call site in the tracked source tree (${totalCallSites} ` +
    'found, outside its own defining module and contracts/checks/**) supplies expectedGeneration -- ' +
    'a future call site that forgets it will fail this gate instead of silently losing reissue ' +
    'revocation.',
);
process.exit(0);
