#!/usr/bin/env node
// F3 (ticketing-foundation) — A8, the one deliberately SOURCE-LEVEL check in this contract.
//
// Why source-level, when every other check in this contract is behavioural: @qa proved
// live (2026-08-18 revision) that "manager hand-listed as its own 7-member literal" and
// "manager derived via `new Set(CAPABILITIES)`" are INDISTINGUISHABLE by calling resolve()
// — both currently produce the identical Set of 7 members. A3/A5/A6 all stayed green
// through the actual regression this check exists to catch (see golden/README.md's
// "Contradiction found and resolved" section). This is an AUTHORSHIP property (how the
// bundle is constructed), not a behavioural one (what it currently returns), so a
// behavioural call cannot see it — a source check is the correct instrument here, not a
// shortcut around one.
//
// What this proves: lib/admin-roles.ts's `manager` entry in ROLE_TO_CAPABILITIES is a
// hand-listed literal array of exactly the seven real capability strings — NOT
// `new Set(CAPABILITIES)`, not `new Set([...CAPABILITIES])`, not an alias of `owner`'s
// bundle, and not missing/extra members. This matters because `manager` already holds
// `export-buyer-data`, the single most POPIA-sensitive capability in the set (Lee-Ann's
// role) — silently deriving it from the fixed set would auto-grant her every future
// capability the moment it's added to CAPABILITIES, with no review step. `owner` is
// SUPPOSED to do exactly that (see check-owner-derived-from-fixed-set.mjs, A6); `manager`
// is not.
//
// Run as: node contracts/checks/ticketing-f3-admin-roles/check-manager-hand-listed-source.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(__dirname, '../../../lib/admin-roles.ts');

const CAPABILITIES = [
  'view-admin-dashboard',
  'scan-checkin',
  'lookup-booking-ref',
  'search-buyers',
  'issue-comp',
  'issue-refund',
  'export-buyer-data',
];

const failures = [];

let source;
try {
  source = readFileSync(TARGET, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read ${TARGET} — ${err.message}`);
  process.exit(1);
}

// Isolate the `manager:` entry inside the ROLE_TO_CAPABILITIES object literal. Requiring
// `new Set([` immediately (only whitespace/newlines between) is deliberate: it fails to
// match — and this check fails loudly — for `new Set(CAPABILITIES)`, `new Set([...CAPABILITIES])`,
// or `ROLE_TO_CAPABILITIES.owner` (none of those open with a literal `[`), which is exactly
// the class of regression this check exists to catch, not an incidental side effect.
const managerMatch = source.match(/\bmanager\s*:\s*new Set\(\s*\[([^\]]*)\]\s*\)/s);

if (!managerMatch) {
  failures.push(
    "Could not find 'manager: new Set([ ...literal strings... ])' in lib/admin-roles.ts. " +
      "manager must be a hand-listed literal array, not derived (e.g. `new Set(CAPABILITIES)` " +
      'or a spread) and not an alias of another role\'s bundle.'
  );
} else {
  const arrayBody = managerMatch[1];

  // No reference to the fixed-set identifier or to another role's bundle inside the
  // literal — catches `new Set([...CAPABILITIES])` (spread) and
  // `new Set([...ROLE_TO_CAPABILITIES.owner])`-style aliasing, neither of which the
  // opening-bracket regex above rules out on its own.
  if (/CAPABILITIES|ROLE_TO_CAPABILITIES|owner/.test(arrayBody)) {
    failures.push(
      "manager's array body references CAPABILITIES, ROLE_TO_CAPABILITIES, or owner — it " +
        'must be a plain literal array of capability strings, not derived from or aliased ' +
        'to another binding.'
    );
  }

  const quoted = [...arrayBody.matchAll(/['"]([a-z-]+)['"]/g)].map((m) => m[1]);

  for (const cap of CAPABILITIES) {
    if (!quoted.includes(cap)) {
      failures.push(`manager's literal array is missing capability '${cap}'.`);
    }
  }
  for (const cap of quoted) {
    if (!CAPABILITIES.includes(cap)) {
      failures.push(`manager's literal array contains '${cap}', which is not a real capability.`);
    }
  }
  if (quoted.length !== CAPABILITIES.length) {
    failures.push(
      `manager's literal array has ${quoted.length} string entries, expected exactly ${CAPABILITIES.length}.`
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: manager is a hand-listed literal array of exactly the seven real capabilities in " +
    'lib/admin-roles.ts source — not derived from CAPABILITIES, not aliased to owner.'
);
process.exit(0);
