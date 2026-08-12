#!/usr/bin/env node
// A10 — F5: the f3-pin-singletons check must exercise the REAL schema type name.
//
// contracts/checks/f3-pin-singletons/check-new-document-filter.mjs:17 hardcodes
// MUST_SURVIVE = ['society', 'event']. `'event'` is the IMPORT BINDING name in
// sanity/schemas/index.ts, not a schema type name — the type that file's defineType
// actually declares is `societyEvent`. No false pass results today (that check only
// tests set membership, and 'event' never collides with the pinned list either way),
// but it means the assertion never touches the real name, so a regression that
// accidentally filtered `societyEvent` out of the Studio's "+ Create new" menu would
// go uncaught.
//
// This check does two things a plain grep would not:
//   1. Confirms the constant now names `societyEvent` and no longer names the
//      non-existent `event`.
//   2. Confirms `societyEvent` is a REAL registered schema type, by importing the
//      actual schema index and looking for a defineType whose name is societyEvent —
//      so the constant cannot simply be swapped for another wrong string.
//   3. Runs the f3 check itself, so this fix cannot break the assertion it repairs.

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { installCrashGuard, pass, fail } from './_shared.mjs';

installCrashGuard('check-f3-constant-fixed');

const CHECK_FILE = 'contracts/checks/f3-pin-singletons/check-new-document-filter.mjs';
const EVENT_SCHEMA = 'sanity/schemas/documents/event.ts';

const failures = [];

if (!fs.existsSync(CHECK_FILE)) fail(`${CHECK_FILE} is missing`);
const src = fs.readFileSync(CHECK_FILE, 'utf8');
const line = (src.match(/const\s+MUST_SURVIVE\s*=\s*\[[^\]]*\]/) ?? [null])[0];
if (!line) {
  failures.push(`${CHECK_FILE} no longer declares a MUST_SURVIVE constant`);
} else {
  if (!/'societyEvent'/.test(line)) {
    failures.push(`MUST_SURVIVE does not include 'societyEvent' — found: ${line}`);
  }
  if (/'event'/.test(line)) {
    failures.push(
      `MUST_SURVIVE still includes the bogus 'event' (an import binding name, not a schema type) ` +
        `— found: ${line}`
    );
  }
  if (!/'society'/.test(line)) {
    failures.push(`MUST_SURVIVE lost 'society' — found: ${line}`);
  }
}

// The corrected name must be a real registered type, not another plausible-looking string.
if (!fs.existsSync(EVENT_SCHEMA)) {
  failures.push(`${EVENT_SCHEMA} is missing`);
} else if (!/name:\s*'societyEvent'/.test(fs.readFileSync(EVENT_SCHEMA, 'utf8'))) {
  failures.push(`${EVENT_SCHEMA} does not declare name: 'societyEvent' — the constant is still wrong`);
}

// Running the repaired check keeps this fix honest.
if (failures.length === 0) {
  try {
    const out = execFileSync('node', ['--import', 'tsx/esm', CHECK_FILE], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(out.trim());
  } catch (err) {
    failures.push(
      `${CHECK_FILE} now FAILS when run (exit ${err.status}). Fixing the constant must not break ` +
        `the assertion it repairs.\n${(err.stdout ?? '') + (err.stderr ?? '')}`
    );
  }
}

if (failures.length > 0) {
  fail(`f3 constant fix — ${failures.length} problem(s):\n  - ${failures.join('\n  - ')}`);
}
pass("MUST_SURVIVE names the real 'societyEvent' type and the f3 filter check still passes.");
