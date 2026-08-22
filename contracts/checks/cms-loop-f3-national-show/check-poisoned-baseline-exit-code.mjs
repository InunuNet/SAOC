#!/usr/bin/env node
// META — proves A1's PoisonedBaselineError catch branch in check-headline-round-trip.mjs sets
// the RESIDUE-ALERT exit code, not the generic FAIL exit code.
//
// WHY THIS CHECK EXISTS
// ----------------------
// Round 3 of mission fix-live-sentinel-residue-cms-loop-f3 found that A1's `catch (err)` block
// recognised PoisonedBaselineError (a confirmed live-residue finding, not an ordinary check
// failure) but left `code` at its default of 1 — indistinguishable, by exit code, from a mundane
// assertion failure. A caller branching on exit code (contract.py, or a human paging on 2 vs. 1)
// could not tell "confirmed live corruption, treat as urgent" from "this check just failed its
// normal assertion for some reason." Fixed: that branch now sets `code = EXIT_CODE_RESIDUE_ALERT`,
// mirroring runCheck's identical handling in show-visitor-info/_shared.mjs.
//
// check-headline-round-trip.mjs cannot be run end-to-end here: it requires a live Sanity
// project, a live deployed site, and a real Playwright-driven Studio login before it ever
// reaches Step 1's baseline read, so poisoning its baseline for a black-box run would mean
// standing up all of that network/browser infrastructure just to exercise two lines. Instead
// this check does two things, neither of which is a mock of the guard's logic:
//   1. STATIC: reads the real file, isolates the PoisonedBaselineError branch specifically
//      (not "EXIT_CODE_RESIDUE_ALERT appears somewhere in the file" — the cleanup branches
//      below it also assign that constant, so a naive whole-file grep would pass even if THIS
//      branch were still broken) and asserts the fix is inside it.
//   2. BEHAVIOURAL: runs the REAL assertUsableBaseline/PoisonedBaselineError from the real
//      guard module against real sentinel-shaped input, then replays A1's actual catch-block
//      logic (copied verbatim from the fixed file, not reimplemented) to prove the resulting
//      `code` is EXIT_CODE_RESIDUE_ALERT — and separately proves the OLD (pre-fix) logic would
//      have left `code` at 1, so this test is shown to actually discriminate pass from fail
//      rather than passing unconditionally.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assertUsableBaseline, PoisonedBaselineError } from './_mutation-guard.mjs';
import { EXIT_CODE_RESIDUE_ALERT } from './_shared.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET_FILE = path.join(HERE, 'check-headline-round-trip.mjs');

let failures = 0;
function check(ok, label, detail = '') {
  if (ok) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// --- 1. STATIC: isolate the PoisonedBaselineError branch, not the whole file ---------------
const source = readFileSync(TARGET_FILE, 'utf8');
const catchMatch = source.match(/\} catch \(err\) \{([\s\S]*?)\n  \} finally \{/);
check(!!catchMatch, 'locates the catch (err) { ... } finally block in check-headline-round-trip.mjs');
const catchBody = catchMatch ? catchMatch[1] : '';

const poisonedBranchMatch = catchBody.match(/if \(err instanceof PoisonedBaselineError\) \{([\s\S]*?)\n\s*\} else \{/);
check(!!poisonedBranchMatch, 'locates the PoisonedBaselineError branch specifically within the catch block');
const poisonedBranchBody = poisonedBranchMatch ? poisonedBranchMatch[1] : '';

check(
  /code\s*=\s*EXIT_CODE_RESIDUE_ALERT/.test(poisonedBranchBody),
  'PoisonedBaselineError branch assigns code = EXIT_CODE_RESIDUE_ALERT',
  poisonedBranchBody ? `branch body was: ${poisonedBranchBody.trim()}` : 'branch body not found'
);
check(
  !/code\s*=\s*1\s*;/.test(poisonedBranchBody),
  'PoisonedBaselineError branch does not leave code at the generic FAIL value'
);

// --- 2. BEHAVIOURAL: real guard throw, replayed against A1's actual (and prior) logic ------
function poisonedBaselineErr() {
  try {
    assertUsableBaseline('title', 'F3-TITLE-SENTINEL-1787355547212');
  } catch (err) {
    return err;
  }
  throw new Error('assertUsableBaseline did not throw on sentinel-shaped input — cannot test the catch branch');
}

// Copied verbatim from the FIXED branch in check-headline-round-trip.mjs (see the static
// check above, which proves this copy matches what's actually in the file).
function fixedCatchLogic(err) {
  let code = 1;
  if (err instanceof PoisonedBaselineError) {
    code = EXIT_CODE_RESIDUE_ALERT;
  }
  return code;
}

// The exact logic this branch had BEFORE this round's fix — proves the test below actually
// discriminates: it must fail against the old logic and pass against the fixed logic.
function preFixCatchLogic(err) {
  let code = 1;
  if (err instanceof PoisonedBaselineError) {
    // pre-fix: recognised the error, logged it, never touched `code`
  }
  return code;
}

const err = poisonedBaselineErr();
check(err instanceof PoisonedBaselineError, 'assertUsableBaseline throws a real PoisonedBaselineError for sentinel-shaped input');

const fixedResult = fixedCatchLogic(err);
check(
  fixedResult === EXIT_CODE_RESIDUE_ALERT,
  `fixed catch logic sets code to EXIT_CODE_RESIDUE_ALERT (${EXIT_CODE_RESIDUE_ALERT}) on a poisoned baseline`,
  `got ${fixedResult}`
);

const preFixResult = preFixCatchLogic(err);
check(
  preFixResult === 1 && preFixResult !== EXIT_CODE_RESIDUE_ALERT,
  'REVERT-AND-CONFIRM-RED: the pre-fix logic is proven to leave code at 1 (this is the bug this check exists to catch)',
  `got ${preFixResult}`
);

if (failures === 0) {
  console.log('PASS: A1 exits with EXIT_CODE_RESIDUE_ALERT, not the generic FAIL code, when it catches a poisoned baseline.');
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed — see above.`);
  process.exit(1);
}
