#!/usr/bin/env node
// =============================================================
// SAOC — contracts/checks/ticketing-complete-f7/verify_unresolvable_bucket.mjs
// Mission ticketing-complete M4/F7 — runtime pin for the "unresolvable" bucket
// (contract-f7.yaml A32 and A33).
//
// WHAT IT PINS
// run_contract_suite.mjs cannot statically resolve a check-script path that the
// shell builds by variable interpolation, so such a path is excluded from the
// "missing" count on purpose (excluding it is not optional — real, correct
// contracts loop over check scripts that way). QA proved that exclusion had also
// made the debt INVISIBLE: an interpolated path pointing at a genuinely absent
// script was reported nowhere at all, in no bucket CI gates on. The fix prints an
// "unresolvable" bucket in both --list-missing and --check-ratchet WITHOUT
// feeding it into the ratchet's fail condition. Prose in goldens/f7-README.md §10
// records that as an accepted limitation; this script is what stops the behaviour
// itself from silently drifting back out.
//
// TWO MODES, TWO SEPARATE PROPERTIES — deliberately not one assertion:
//   print       (A32) the bucket is actually printed, by BOTH entry points.
//   not-gated   (A33) a non-empty bucket does not make the ratchet exit nonzero.
// A single combined check could pass while one of the two properties was broken.
// They are independent and are proven independently.
//
// ACCEPTED COUPLING TO ANOTHER MISSION'S CONTRACT
// KNOWN_IDS names two assertions in contracts/contract-show-visitor-info.yaml
// (A70, A73), which is another mission's file, not this one's. That is a real
// coupling and it was taken deliberately. The alternative — a purpose-built
// fixture contract carrying an interpolated path — cannot work here: the runner's
// default corpus is every contracts/ yaml file plus every specs contract yaml,
// so any fixture that this script could point the corpus at would permanently
// alter the --list-missing and --check-ratchet output every other mission reads,
// adding a permanent fake entry to a shared coverage report. A dependency on two
// real, long-lived assertions costs less than polluting the shared corpus.
//
// WHAT HAPPENS IF A70/A73 CHANGE
// If either is rewritten to stop interpolating its check-script path, this script
// goes red and must be re-pointed at whatever real interpolated assertions exist
// then (or retired if none do). That red is USEFUL SIGNAL, not mere breakage: it
// says the only live examples this pin was standing on are gone, and that a human
// has to decide what the bucket is still protecting — exactly the review a silent
// pass would skip.
//
// KNOWN CONFOUND, stated rather than hidden: not-gated mode reads the ratchet's
// real exit code, which is also driven by the missing-count and parse-error-count
// ratchets. If genuinely new missing/parse-error debt ever pushes those over
// baseline, this script reports red for that unrelated reason. Its error message
// names the ratchet's own summary line so the real cause is visible immediately.
//
// EXIT CODES: 0 pass, 1 the pinned property does not hold, 2 wrapper/usage error
// (bad argv, or the runner could not be spawned at all) — never conflated.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
// contracts/checks/ticketing-complete-f7/<this file> -> repo root is three levels up.
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const RUNNER = 'contracts/checks/_shared/run_contract_suite.mjs';
const BASELINE = 'contracts/checks/_shared/missing-baseline.json';

// The real, permanently-present assertions whose check-script path is built by
// shell variable interpolation. See ACCEPTED COUPLING above.
const KNOWN_IDS = [
  'contracts/contract-show-visitor-info.yaml::A70',
  'contracts/contract-show-visitor-info.yaml::A73',
];

const BUCKET_SUMMARY_PATTERN = /^unresolvable: (\d+) —/m;

const USAGE =
  'usage: node contracts/checks/ticketing-complete-f7/verify_unresolvable_bucket.mjs <print|not-gated>';

/**
 * Invokes the runner as a real child process. spawnSync's own `status` is the
 * child's true exit code — never a pipeline's status, which is what a shell
 * `node ... | grep ...` would report instead and is exactly how a gate ends up
 * scoring the wrong process.
 */
function run(args) {
  const result = spawnSync('node', [RUNNER, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (result.error) {
    console.error(`verify_unresolvable_bucket.mjs: could not spawn the runner: ${result.error.message}`);
    process.exit(2);
  }
  return { stdout: result.stdout ?? '', status: result.status };
}

/**
 * Returns a list of problem descriptions (empty means the bucket was printed
 * properly by this entry point). Checks BOTH the per-assertion lines and the
 * labelled summary line: a summary count alone would be satisfied by a run that
 * printed a number and no ids, which is the very "a count alone tells nobody
 * which coverage is imaginary" failure this bucket exists to prevent.
 */
function assertBucketPrinted(stdout, label) {
  const problems = [];
  for (const id of KNOWN_IDS) {
    if (!stdout.includes(`UNRESOLVABLE ${id} `)) {
      problems.push(`${label}: no "UNRESOLVABLE ${id}" line in the output`);
    }
  }
  const match = stdout.match(BUCKET_SUMMARY_PATTERN);
  if (!match) {
    problems.push(`${label}: no "unresolvable: <n> —" summary line in the output`);
  } else if (Number(match[1]) < KNOWN_IDS.length) {
    problems.push(
      `${label}: summary line reports ${match[1]} unresolvable, below the ${KNOWN_IDS.length} ` +
        'known interpolated assertion(s) that must always be counted',
    );
  }
  return problems;
}

/** A32: both entry points print the bucket. */
function cmdPrint() {
  const problems = [];
  problems.push(...assertBucketPrinted(run(['--list-missing']).stdout, '--list-missing'));
  problems.push(...assertBucketPrinted(run(['--check-ratchet', BASELINE]).stdout, '--check-ratchet'));

  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL ${problem}`);
    console.error(
      'FAIL the unresolvable bucket is no longer printed by every entry point — interpolated ' +
        'check-script paths are invisible again, the exact blind spot A32 pins closed.',
    );
    process.exit(1);
  }
  console.log(
    `PASS the unresolvable bucket is printed by both --list-missing and --check-ratchet, naming ` +
      `all ${KNOWN_IDS.length} known interpolated assertion(s).`,
  );
  process.exit(0);
}

/** A33: a NON-EMPTY bucket still does not gate the ratchet. */
function cmdNotGated() {
  const ratchet = run(['--check-ratchet', BASELINE]);

  // ORDER MATTERS, and it is the whole point of this mode. Asserting only "exit
  // code is 0" would pass VACUOUSLY if the bucket were ever silently empty — an
  // empty bucket cannot gate anything, so a green result would prove nothing
  // about decoupling. The nonzero floor is checked FIRST, so a pass here always
  // means "the bucket had real content AND the ratchet still exited 0",
  // never "there was nothing to gate on".
  const match = ratchet.stdout.match(BUCKET_SUMMARY_PATTERN);
  if (!match) {
    console.error(
      'FAIL --check-ratchet printed no "unresolvable: <n> —" summary line, so this mode cannot ' +
        'prove the bucket is ungated — there is nothing shown to be ungated. (A32 covers the ' +
        'printing itself.)',
    );
    process.exit(1);
  }
  const bucketCount = Number(match[1]);
  if (bucketCount < KNOWN_IDS.length) {
    console.error(
      `FAIL --check-ratchet reported only ${bucketCount} unresolvable path(s), below the ` +
        `${KNOWN_IDS.length} known one(s). A green exit code against an empty bucket would be a ` +
        'vacuous pass, so this is failed deliberately rather than read as decoupling.',
    );
    process.exit(1);
  }

  if (ratchet.status !== 0) {
    const summaryLine = ratchet.stdout.split('\n').find((line) => line.startsWith('SUMMARY:')) ?? '(no SUMMARY line)';
    console.error(
      `FAIL --check-ratchet exited ${ratchet.status} with ${bucketCount} unresolvable path(s) ` +
        'present. Either the unresolvable bucket now feeds the ratchet fail condition (it must ' +
        'not — gating it would fail CI on legitimate loops over files that really exist), or the ' +
        `missing/parse-error ratchets are genuinely over baseline. Runner said: ${summaryLine}`,
    );
    process.exit(1);
  }

  console.log(
    `PASS --check-ratchet exited 0 with ${bucketCount} unresolvable path(s) reported — the bucket ` +
      'is visible and does not gate.',
  );
  process.exit(0);
}

const mode = process.argv[2];
if (mode === 'print') {
  cmdPrint();
} else if (mode === 'not-gated') {
  cmdNotGated();
} else {
  console.error(`verify_unresolvable_bucket.mjs: unknown mode ${mode ?? '(none given)'}\n${USAGE}`);
  process.exit(2);
}
