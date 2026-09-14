#!/usr/bin/env node
// =============================================================
// SAOC — contracts/checks/_shared/run_contract_suite.mjs
// Mission ticketing-complete M1/F7 — general-purpose contract-check runner
// (contract-f7.yaml A22-A29). NOT scoped to this mission's own contracts: its
// default corpus is every contracts/*.yaml file in the repo, the same "whole
// repo's contracts" definition already established by
// execution/checks/verify_f2_baseline_completeness.py's CONTRACTS_DIR.
//
// WHY THIS EXISTS: nothing in this repo runs the contract checks. Ever. A
// contract's assertions run exactly once, when their author invokes them by
// hand, and never again — which is how a check from an earlier mission sits
// red unnoticed, and why backlog.md already records four other failing
// contracts plus a standing "audit for the weak-assertion defect class" item.
// A peer session (NOS) separately found that 7 of 9 Playwright check scripts
// NAMED IN ITS OWN CONTRACT don't exist on disk — a runner that treats a
// missing script the same as a failing one buries real failures in noise; one
// that silently skips it reports green for coverage that was never written,
// which is worse, because it manufactures false confidence. So every
// assertion this runner evaluates is classified into exactly ONE of five
// states — pass / fail / missing / skip / not-evaluated — and "missing" is
// detected BEFORE execution (a check-script path under contracts/checks/ that
// does not exist on disk is never invoked, so it can never accidentally exit 0
// and read as a pass, nor throw a shell error that reads as a generic fail).
// A `kind: shell` checker gets its own real "skip" channel via a dedicated
// exit code (SHELL_SKIP_EXIT_CODE, below) — added 2026-09-10 after a checker
// (contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs)
// was found printing "SKIPPED" and exiting 0, which this runner recorded as
// PASS: exit code was the only signal it read, and 0 always meant pass. See
// SHELL_SKIP_EXIT_CODE's own comment for why an exit code, not stdout text.
//
// USAGE
//   node run_contract_suite.mjs                     scan the default corpus (contracts/*.yaml)
//   node run_contract_suite.mjs <one-contract.yaml>  scan just that one file (bare assertion ids
//                                                     in the output — used by A23's fixture proof)
//   node run_contract_suite.mjs --list-missing       scan the default corpus, print every
//                                                     currently-missing assertion's composite id
//                                                     on its own line (A29 — visible even on a
//                                                     passing/ratcheted run, not just a summary count),
//                                                     plus the "unresolvable" bucket: paths built by
//                                                     shell variable interpolation, printed but never
//                                                     gated (see classifyReferencedCheckScripts)
//   node run_contract_suite.mjs --check-ratchet <baseline.json>
//                                                     the CI gate (A25). Same three buckets printed;
//                                                     only missing-count and parse-error-count
//                                                     exceeding the baseline can fail it.
//   node run_contract_suite.mjs --verify-baseline <baseline.json>
//                                                     fail closed on a missing/corrupt baseline
//                                                     (A28); otherwise re-run the default corpus
//                                                     fresh and confirm every id in the baseline's
//                                                     missingAssertionIds still classifies as
//                                                     missing today (A27) — exit 0 only if so.
//   node run_contract_suite.mjs --write-baseline <baseline.json>
//                                                     (maintenance, not part of the golden
//                                                     contract) regenerate the committed baseline
//                                                     from a real run — never hand-type this file.
//
// SCOPE NOTE: this runner supports the assertion shapes actually present in
// contracts/*.yaml today — the @architect "checks:" dict shape (id/description/
// command/required, always shell) and the plain "assertions:" list shape
// (id/verify:{kind,cmd|path|pattern}) with kinds shell / file_exists /
// file_contains / agent_review (contract.py's own "manual QA, not automatable"
// kind — reported, never counted toward pass/fail/missing). It does not
// implement contract.py's phases-dict-of-embedded-assertions shape or the
// codex_qa/browser_deployed_check/gws_inbox_check triad kinds, because neither
// appears anywhere in contracts/*.yaml as it stands — if one is added later
// and its "script" field points under contracts/checks/, the same
// existsSync-before-exec path used for "shell" below will need extending, not
// reinventing.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
// contracts/checks/_shared/run_contract_suite.mjs -> repo root is three levels up.
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..');
const DEFAULT_CORPUS_DIR = path.join(REPO_ROOT, 'contracts');

// Matches a check-SCRIPT path referenced literally inside a shell command
// string, e.g. `node contracts/checks/foo-f1/bar.mjs --flag` or
// `python3 contracts/checks/foo-f1/bar.py`. Stops at whitespace or a quote so
// it doesn't swallow trailing shell operators/arguments. Deliberately limited
// to executable-script extensions (mjs/js/ts/py/sh) — NOT .json or other data
// extensions. A real corpus scan found this matters: this mission's own
// contract-f7.yaml passes `contracts/checks/does-not-exist/nope.json` to
// --verify-baseline as a NEGATIVE-CONTROL argument for A28 (the path is
// deliberately never supposed to exist), and separately references its own
// not-yet-written `missing-baseline.json` output file inside A25-A27's
// commands — neither is "a check that was declared but never implemented",
// which is what "missing" is supposed to mean. Matching only script
// extensions avoids both false positives without hand-listing exceptions.
const CHECK_SCRIPT_PATH_PATTERN = /contracts\/checks\/[^\s'"]+\.(?:mjs|cjs|js|ts|py|sh)\b/g;

// A shell checker has exactly one channel to report "I measured nothing" and
// have it land as anything other than a pass: this exit code. Before this, a
// `kind: shell` assertion was classified purely on exit code, with 0 => pass
// and anything else => fail — no third state existed at all, unlike
// `agent_review`, which gets 'skip' for free because THIS runner hardcodes it
// at the call site (see the agent_review branch below). A checker that prints
// "SKIPPED" and exits 0 (the pre-existing, real shape of
// contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs,
// reproduced during authoring: `GIT_DIR=/nonexistent node
// check-descriptor-provenance.mjs ...` prints SKIPPED and exits 0) is recorded
// PASS — the exact "the check ran, the property was or was not measured, and
// the reporting layer collapsed the distinction" shape this repo has now hit
// three times independently (this file, m2-next16-upgrade/check-routes.mjs,
// and the NOS lane's own PASS|FAIL-typed verifier).
//
// A dedicated exit code, not stdout sniffing: stdout text is free-form prose a
// checker author can phrase any way ("SKIPPED", "skipped:", "N/A", a differently
// worded sentence tomorrow) — a regex over it is one rewording away from
// silently breaking, and it can't be shared across languages without every
// checker agreeing on exact wording. An exit code is a fixed, structural
// contract every language's process model already has a channel for (Python
// sys.exit(3), a shell script's own `exit 3`, Node process.exit(3)) — no
// parsing, no wording to keep in sync. This repo already uses exit codes as
// the state-communication channel for a third state elsewhere (workflow.md:
// execution/codex_qa.sh — 0 pass / 1 fail / 2 wrapper-usage-error), so this
// follows an established local convention rather than inventing a new one.
// Picked 3, not 2, to stay clear of that existing convention (exit 2 already
// means "usage error", a distinct concept from "ran fine, nothing to measure")
// and clear of the near-universal shell convention that 1 means a generic
// failure.
const SHELL_SKIP_EXIT_CODE = 3;

function relToRoot(absPath) {
  return path.relative(REPO_ROOT, absPath);
}

const SPECS_DIR = path.join(REPO_ROOT, '.agent', 'memory', 'project', 'specs');

/**
 * Every contract this repo actually carries — NOT scoped to this mission's own
 * contracts (A22's explicit requirement). Two roots, both real:
 *   - contracts/*.yaml — the "shipped" contracts registry (the established
 *     corpus definition execution/checks/verify_f2_baseline_completeness.py
 *     already uses for its own CONTRACTS_DIR).
 *   - .agent/memory/project/specs/**\/contract*.yaml — in-flight mission specs.
 *     This root matters concretely, not hypothetically: the motivating "7 of 9
 *     Playwright check scripts missing" case this whole feature exists to catch
 *     (goldens/f7-README.md §9) lives in a mission's own spec contract, not in
 *     the shipped contracts/ registry — a corpus that only scanned contracts/
 *     would never have caught it.
 * Nothing else is reached — .claude/worktrees/** in particular. There is no
 * exclusion filter in this function and never was: the shipped-contracts read is
 * a NON-RECURSIVE readdir of contracts/ itself, and the specs read is rooted at
 * the fixed SPECS_DIR path, so a worktree checkout is simply never walked. The
 * outcome is the one we want (ephemeral checkouts of other branches/missions are
 * not canonical content of this repo, and scanning them would make the baseline
 * depend on whichever stale worktrees happen to exist on this machine right now)
 * — but it is a consequence of where these two reads look, not a guard the code
 * performs. Describing it as a deliberate exclusion would claim more than the
 * code delivers, which is the exact defect class contract-f7.yaml A30 pins.
 */
async function defaultCorpusFiles() {
  const shipped = await readdir(DEFAULT_CORPUS_DIR, { withFileTypes: true });
  const shippedFiles = shipped
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => path.join(DEFAULT_CORPUS_DIR, e.name));

  const specEntries = await readdir(SPECS_DIR, { withFileTypes: true, recursive: true });
  const specFiles = specEntries
    .filter((e) => e.isFile() && /^contract.*\.yaml$/.test(e.name))
    .map((e) => path.join(e.parentPath ?? e.path, e.name));

  return [...shippedFiles, ...specFiles].sort();
}

function loadContract(absPath) {
  const text = readFileSync(absPath, 'utf8');
  return parseYaml(text);
}

/**
 * Normalizes one contract's assertions into a flat list of
 * { id, kind, cmd, filePath, pattern }, regardless of which of the two shapes
 * actually present in contracts/*.yaml today it was written in.
 */
function extractAssertions(contract) {
  const out = [];
  const assertionsRaw = contract?.assertions;

  if (assertionsRaw && !Array.isArray(assertionsRaw) && typeof assertionsRaw === 'object' && Array.isArray(assertionsRaw.checks)) {
    // @architect "checks:" dict shape — every check in contracts/*.yaml today
    // is implicitly shell (no check declares its own `type:`).
    for (const check of assertionsRaw.checks) {
      out.push({
        id: String(check.id ?? ''),
        kind: 'shell',
        cmd: String(check.command ?? ''),
      });
    }
    return out;
  }

  if (Array.isArray(assertionsRaw)) {
    for (const a of assertionsRaw) {
      const verify = a?.verify ?? {};
      const kind = typeof verify === 'string' ? 'shell' : String(verify.kind ?? 'shell');
      if (kind === 'shell') {
        const cmd = typeof verify === 'string' ? verify : String(verify.cmd ?? a.cmd ?? a.command ?? '');
        out.push({ id: String(a.id ?? ''), kind, cmd });
      } else if (kind === 'file_exists') {
        out.push({ id: String(a.id ?? ''), kind, filePath: String(verify.path ?? '') });
      } else if (kind === 'file_contains') {
        out.push({
          id: String(a.id ?? ''),
          kind,
          filePath: String(verify.path ?? ''),
          pattern: String(verify.pattern ?? ''),
        });
      } else if (kind === 'agent_review') {
        out.push({ id: String(a.id ?? ''), kind });
      } else {
        // Anything else (json_path, handoff_field, the triad kinds, or a kind
        // this corpus hasn't used yet) — reported as an unsupported shape
        // rather than silently ignored. See the SCOPE NOTE at the top of this
        // file for why the triad kinds aren't implemented here.
        out.push({ id: String(a.id ?? ''), kind: 'unsupported', rawKind: kind });
      }
    }
    return out;
  }

  return out;
}

/**
 * Splits the contracts/checks/ script paths a shell command references into the
 * classes this runner can and cannot statically resolve:
 *
 *   literal       — a plain path existsSync() can check. The only class that can
 *                   ever produce a "missing" classification.
 *   interpolated  — a path built by shell variable expansion (`"$c.mjs"`, from
 *                   e.g. `for c in a b c; do ... "contracts/checks/x/$c.mjs"`).
 *                   NOT statically checkable: the real path only exists once the
 *                   shell expands the variable at run time.
 *   globbed       — a path containing a shell glob (`check-*.mjs`). Also not
 *                   statically checkable, and left unreported (see below).
 *
 * Treating an interpolated or globbed path as a literal missing file produces a
 * false "missing" — seen for real in contract-show-visitor-info.yaml: A70 and A73
 * loop with a shell variable, A76 loops with a shell glob, and all three run
 * against files that DO exist, doing their own existence checking inside the loop
 * (grep -q, etc.).
 * That false-positive risk is why they are excluded from the missing count, and
 * that exclusion stays.
 *
 * WHY `interpolated` IS RETURNED RATHER THAN DISCARDED (QA finding, 2026-09-08):
 * discarding it silently meant an assertion like `F=x; node
 * "contracts/checks/nope/${F}.mjs"`, whose script genuinely does not exist, was
 * reported NOWHERE in corpus/ratchet mode — not missing, not fail, just bucketed
 * as not-evaluated, which nothing gates on. A declared check that will never run
 * was invisible to CI forever. .github/workflows/ci.yml's own comment for this
 * step states the design principle it violated: "Output is NEVER suppressed (no
 * /dev/null, no --quiet) so every currently-missing id and every currently-
 * unparseable file is visible in this step's own log even when it passes — a
 * count alone tells nobody which coverage is imaginary." A silently-dropped third
 * class of debt is that principle broken, so it is now PRINTED as its own
 * labelled bucket — but deliberately NOT gated, because gating it would fail CI
 * on show-visitor-info.yaml's legitimate loops, the exact false positive the
 * exclusion exists to prevent. See goldens/f7-README.md §10.
 *
 * Globs stay unreported: no QA-proven blind spot was demonstrated for them, and
 * widening the bucket beyond the proven case is scope this feature did not take.
 * It is the same shape of hole — stated plainly in f7-README.md §10 rather than
 * papered over.
 */
function classifyReferencedCheckScripts(cmd) {
  const matches = [...new Set(cmd.match(CHECK_SCRIPT_PATH_PATTERN) ?? [])];
  const literal = matches.filter((m) => !m.includes('*') && !m.includes('$'));
  const interpolated = matches.filter((m) => m.includes('$'));
  return { literal, interpolated };
}

/**
 * Best-effort, honestly-labelled triage of ONE interpolated path. The literal
 * text before the first `$` always contains at least `contracts/checks/`, so its
 * directory portion is a real, checkable prefix: if that directory doesn't
 * exist, no expansion of the variable can ever resolve to a real file and the
 * reference is certainly dead. If it does exist, the path MAY be a legitimate
 * loop over files that are really there — this runner cannot tell, and says so
 * rather than guessing.
 */
function describeInterpolatedPath(rel) {
  const literalPrefix = rel.slice(0, rel.indexOf('$'));
  const prefixDir = literalPrefix.slice(0, literalPrefix.lastIndexOf('/') + 1);
  const prefixDirExists = existsSync(path.join(REPO_ROOT, prefixDir));
  return {
    rel,
    prefixDir,
    prefixDirExists,
    detail: prefixDirExists
      ? `prefix directory ${prefixDir} exists — MAY be a legitimate loop over real files`
      : `prefix directory ${prefixDir} does NOT exist — no expansion can resolve to a real file`,
  };
}

// Minimal POSIX-bracket-expression translation, mirroring contract.py's own
// file_contains handling closely enough for the patterns this corpus uses.
const POSIX_TO_JS = {
  '[[:space:]]': '\\s',
  '[[:alpha:]]': '[a-zA-Z]',
  '[[:digit:]]': '\\d',
  '[[:alnum:]]': '[a-zA-Z0-9]',
};

function translatePosixPattern(pattern) {
  let out = pattern;
  for (const [posix, replacement] of Object.entries(POSIX_TO_JS)) {
    out = out.split(posix).join(replacement);
  }
  return out;
}

/**
 * Evaluates one already-extracted assertion. Returns
 * { status: 'pass'|'fail'|'missing'|'skip'|'not-evaluated', detail: string }.
 * Never executes a shell command that references a check-script path which
 * doesn't exist on disk — that's the whole point of this runner.
 *
 * `evaluateFully: false` (used only by the corpus-wide scans behind
 * --list-missing/--verify-baseline/--write-baseline) skips actually invoking a
 * shell command once it's known NOT to reference a missing check script —
 * those three commands only need the "missing" classification to be correct
 * (that's the entire thing the ratchet baseline tracks), and the corpus
 * contains dozens of assertions that shell out to `pnpm build`, `tsc
 * --noEmit`, or `curl` against a live origin. Actually running all of those,
 * repeatedly, on every baseline check would make the CI step in A29 minutes
 * slower for zero effect on what A25-A28 verify. Single-file mode (the
 * default `node run_contract_suite.mjs <file>` invocation A23's fixture proof
 * uses, and what a developer reaches for to check one contract by hand)
 * always evaluates fully — one file's assertions are cheap, and a real
 * pass/fail is genuinely useful there.
 */
function evaluateAssertion(assertion, { evaluateFully }) {
  if (assertion.kind === 'shell') {
    const { literal, interpolated } = classifyReferencedCheckScripts(assertion.cmd);
    // Reported alongside whatever status this assertion ends up with — an
    // assertion can both reference a missing literal script AND build another
    // path by interpolation, and both facts are worth printing.
    const unresolvableScripts = interpolated.map(describeInterpolatedPath);
    const missingScript = literal.find((rel) => !existsSync(path.join(REPO_ROOT, rel)));
    if (missingScript) {
      return { status: 'missing', detail: `script not found: ${missingScript}`, unresolvableScripts };
    }
    if (!evaluateFully) {
      return {
        status: 'not-evaluated',
        detail: 'shell command not executed in corpus-scan mode',
        unresolvableScripts,
      };
    }
    try {
      execFileSync('/bin/bash', ['-c', assertion.cmd], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
      return { status: 'pass', detail: 'pass', unresolvableScripts };
    } catch (err) {
      const code = typeof err.status === 'number' ? err.status : 'error';
      if (code === SHELL_SKIP_EXIT_CODE) {
        // The checker measured nothing (e.g. its source data wasn't
        // resolvable) and said so structurally, via exit code — never via
        // stdout text this runner would have to parse. Must land in the same
        // 'skip' bucket agent_review uses below: excluded from pass/fail/
        // missing counts, but never silently absorbed into a pass either.
        const stderrText = err.stderr ? err.stderr.toString('utf8').split('\n')[0] : '';
        const stdoutText = err.stdout ? err.stdout.toString('utf8').split('\n')[0] : '';
        return {
          status: 'skip',
          detail: `exit ${SHELL_SKIP_EXIT_CODE}: ${stdoutText || stderrText || '(no output)'}`,
          unresolvableScripts,
        };
      }
      return { status: 'fail', detail: `fail (exit ${code})`, unresolvableScripts };
    }
  }

  if (assertion.kind === 'file_exists') {
    const abs = path.join(REPO_ROOT, assertion.filePath);
    return existsSync(abs)
      ? { status: 'pass', detail: `path exists: ${assertion.filePath}` }
      : { status: 'fail', detail: `path does not exist: ${assertion.filePath}` };
  }

  if (assertion.kind === 'file_contains') {
    const abs = path.join(REPO_ROOT, assertion.filePath);
    if (!existsSync(abs)) {
      return { status: 'fail', detail: `file not found: ${assertion.filePath}` };
    }
    const content = readFileSync(abs, 'utf8');
    const re = new RegExp(translatePosixPattern(assertion.pattern));
    return re.test(content)
      ? { status: 'pass', detail: `pattern found in ${assertion.filePath}` }
      : { status: 'fail', detail: `pattern not found in ${assertion.filePath}` };
  }

  if (assertion.kind === 'agent_review') {
    // Manual QA, not automatable — contract.py itself treats this as "skip",
    // never as a pass or a fail. Reported, but excluded from the
    // pass/fail/missing counts the ratchet baseline tracks.
    return { status: 'skip', detail: 'agent_review — manual verification required' };
  }

  return { status: 'fail', detail: `unsupported verify kind: ${assertion.rawKind ?? 'unknown'}` };
}

/**
 * Runs every assertion in one contract file. `bareIds` controls whether
 * printed/returned ids are the assertion's own id (single-file mode, needed
 * verbatim by A23's fixture proof) or prefixed with the file path (multi-file
 * corpus scan, needed because assertion ids like "A1" repeat across nearly
 * every contract in this repo and are not unique on their own).
 */
function runContractFile(absPath, { bareIds, evaluateFully }) {
  const relPath = relToRoot(absPath);
  let contract;
  try {
    contract = loadContract(absPath);
  } catch (err) {
    // A single malformed contract file (real example found in this corpus:
    // gate-timeout-fix/contract-f1.yaml uses a YAML shape the `yaml` package
    // rejects as an ambiguous compact mapping, though other parsers tolerate
    // it) must never take down the whole corpus scan — that would make one
    // messy file in someone else's mission block every other contract's
    // missing-detection. Reported distinctly so it isn't silently invisible
    // either.
    return [
      {
        file: relPath,
        id: '(file)',
        compositeId: bareIds ? '(file)' : `${relPath}::(file)`,
        status: 'parse-error',
        detail: `failed to parse YAML: ${err.message.split('\n')[0]}`,
        // Kept uniform with every other result object: an unparseable file has no
        // assertions to inspect, so its unresolvable-script list is empty, not absent.
        // Leaving it undefined here crashed printUnresolvableBucket's filter.
        unresolvableScripts: [],
      },
    ];
  }
  const assertions = extractAssertions(contract);
  const results = [];
  for (const assertion of assertions) {
    if (!assertion.id) continue;
    const { status, detail, unresolvableScripts } = evaluateAssertion(assertion, { evaluateFully });
    const compositeId = bareIds ? assertion.id : `${relPath}::${assertion.id}`;
    results.push({
      file: relPath,
      id: assertion.id,
      compositeId,
      status,
      detail,
      unresolvableScripts: unresolvableScripts ?? [],
    });
  }
  return results;
}

function printResultLine(result) {
  const statusWord = result.status.toUpperCase();
  console.log(`${statusWord} ${result.compositeId} (${result.file}): ${result.status} (${result.detail})`);
}

/**
 * Prints the third bucket of coverage debt: assertions whose check-script path is
 * built by shell variable interpolation, so this runner cannot statically decide
 * whether the script exists. Printed by BOTH --list-missing and --check-ratchet,
 * in the same per-id shape as currently-missing ids and unparseable files, and
 * for the same stated reason (ci.yml: "a count alone tells nobody which coverage
 * is imaginary"). Deliberately does NOT feed the ratchet's fail condition — see
 * classifyReferencedCheckScripts' doc comment. Returns the number of assertions
 * reported, for the caller's summary line only.
 */
function printUnresolvableBucket(results) {
  const withUnresolvable = results.filter((r) => r.unresolvableScripts.length > 0);
  for (const r of withUnresolvable) {
    for (const u of r.unresolvableScripts) {
      console.log(`UNRESOLVABLE ${r.compositeId} (${r.file}): ${u.rel} — ${u.detail}`);
    }
  }
  console.log(
    `unresolvable: ${withUnresolvable.length} — check-script path(s) built by shell variable ` +
      'interpolation, which cannot be statically checked for existence. NOT gated: some of these ' +
      'are legitimate loops over files that really exist (each line says whether its literal ' +
      'prefix directory is there), so a hard failure here would be a false positive. Read them ' +
      'as coverage this runner cannot vouch for either way.',
  );
  return withUnresolvable.length;
}

async function runCorpus({ bareIds, files, evaluateFully = true }) {
  const targets = files ?? (await defaultCorpusFiles());
  const all = [];
  for (const file of targets) {
    all.push(...runContractFile(file, { bareIds, evaluateFully }));
  }
  return all;
}

function summarize(results) {
  const counts = { pass: 0, fail: 0, missing: 0, skip: 0, 'not-evaluated': 0 };
  for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return counts;
}

async function cmdDefault(singleFilePath) {
  // Single-file mode (a path was given, e.g. A23's fixture proof, or a
  // developer checking one contract by hand) evaluates fully — one file's
  // assertions are cheap and a real pass/fail is genuinely useful. A bare,
  // no-args invocation scans the WHOLE corpus and only needs "missing" to be
  // correct (see evaluateAssertion's evaluateFully doc comment) — running
  // every contract's `pnpm build`/`curl`/etc for real there would make this
  // needlessly slow for no benefit any of A22-A29 actually rely on.
  const bareIds = Boolean(singleFilePath);
  const evaluateFully = Boolean(singleFilePath);
  const files = singleFilePath ? [path.resolve(process.cwd(), singleFilePath)] : undefined;
  const results = await runCorpus({ bareIds, files, evaluateFully });
  for (const r of results) printResultLine(r);
  const counts = summarize(results);
  console.log(
    `\nSUMMARY: ${counts.pass} pass, ${counts.fail} fail, ${counts.missing} missing, ` +
      `${counts.skip} skip, ${counts['not-evaluated']} not-evaluated (${results.length} total)`,
  );
  process.exit(counts.fail > 0 ? 1 : 0);
}

async function cmdListMissing() {
  const results = await runCorpus({ bareIds: false, evaluateFully: false });
  const missing = results.filter((r) => r.status === 'missing');
  for (const r of missing) printResultLine(r);
  console.log('');
  printUnresolvableBucket(results);
  console.log(`\nSUMMARY: ${missing.length} missing (of ${results.length} total)`);
  process.exit(0);
}

function loadBaselineOrExit(baselinePath) {
  const abs = path.resolve(process.cwd(), baselinePath);
  if (!existsSync(abs)) {
    console.error(
      `run_contract_suite.mjs: baseline file not found: ${baselinePath} — the ratchet ` +
        'cannot verify against a baseline that does not exist. This is a deliberate ' +
        'fail-closed error, not "no ratchet, anything goes".',
    );
    process.exit(1);
  }
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`run_contract_suite.mjs: baseline file could not be read: ${baselinePath} (${err.message})`);
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(
      `run_contract_suite.mjs: baseline file is invalid — failed to parse ${baselinePath} as JSON ` +
        `(${err.message}). A corrupt baseline must never be silently read as "no baseline, ` +
        'unlimited missing allowed" — this is a deliberate fail-closed error.',
    );
    process.exit(1);
  }
}

async function cmdVerifyBaseline(baselinePath) {
  const baseline = loadBaselineOrExit(baselinePath);
  const ids = Array.isArray(baseline.missingAssertionIds) ? baseline.missingAssertionIds : null;
  if (!ids) {
    console.error(
      `run_contract_suite.mjs: baseline file is invalid — ${baselinePath} has no ` +
        '"missingAssertionIds" array. A corrupt baseline must never be silently treated ' +
        'as "no baseline, unlimited missing allowed".',
    );
    process.exit(1);
  }
  const parseErrorFiles = Array.isArray(baseline.parseErrorFiles) ? baseline.parseErrorFiles : null;
  if (!parseErrorFiles) {
    console.error(
      `run_contract_suite.mjs: baseline file is invalid — ${baselinePath} has no ` +
        '"parseErrorFiles" array. A corrupt baseline must never be silently treated ' +
        'as "no baseline, unlimited parse-error growth allowed".',
    );
    process.exit(1);
  }

  const results = await runCorpus({ bareIds: false, evaluateFully: false });
  const currentlyMissing = new Set(results.filter((r) => r.status === 'missing').map((r) => r.compositeId));
  const currentlyParseError = new Set(results.filter((r) => r.status === 'parse-error').map((r) => r.compositeId));

  const staleMissing = ids.filter((id) => !currentlyMissing.has(id));
  const staleParseError = parseErrorFiles.filter((id) => !currentlyParseError.has(id));
  if (staleMissing.length > 0 || staleParseError.length > 0) {
    console.error(
      'run_contract_suite.mjs: baseline is stale — the following baseline entries no longer ' +
        'reproduce in a fresh run today (either fixed, or never real):\n  ' +
        [...staleMissing, ...staleParseError].join('\n  '),
    );
    process.exit(1);
  }

  console.log(
    `PASS --verify-baseline: all ${ids.length} missing id(s) and ${parseErrorFiles.length} ` +
      'parse-error file(s) independently reproduced in a fresh run over the full corpus.',
  );
  process.exit(0);
}

async function cmdWriteBaseline(baselinePath) {
  const results = await runCorpus({ bareIds: false, evaluateFully: false });
  const missingIds = [...new Set(results.filter((r) => r.status === 'missing').map((r) => r.compositeId))].sort();
  // parse-error is tracked in its own baseline fields, never folded into
  // missingAssertionIds — a file that fails to parse has an unknown number of
  // real assertions inside it (possibly zero if the shape is otherwise
  // trivial), so it is not "one more missing check script"; it's a whole
  // file whose assertions never ran and never will until someone fixes the
  // YAML. See cmdCheckRatchet's doc comment for why this must fail closed.
  const parseErrorIds = [...new Set(results.filter((r) => r.status === 'parse-error').map((r) => r.compositeId))].sort();
  const baseline = {
    count: missingIds.length,
    missingAssertionIds: missingIds,
    parseErrorCount: parseErrorIds.length,
    parseErrorFiles: parseErrorIds,
  };
  const abs = path.resolve(process.cwd(), baselinePath);
  const fs = await import('node:fs/promises');
  await fs.writeFile(abs, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote baseline (${missingIds.length} missing, ${parseErrorIds.length} parse-error) to ${baselinePath}`,
  );
  process.exit(0);
}

/**
 * The actual CI ratchet gate (A25): fails when a fresh run's missing-check-
 * script count EXCEEDS the committed baseline's count, OR its parse-error
 * count exceeds the baseline's, passes at or below both. Distinct from
 * --verify-baseline (A27), which proves the *baseline itself* is accurate
 * (every id/file it lists still reproduces today) — a pre-commit/maintenance
 * check, not the thing CI runs on every push. Always prints every currently-
 * missing id and every currently-parse-erroring file first (A29 — visible
 * even when this passes, so a ratchet held "at or below baseline" never
 * reads as "nothing missing").
 *
 * IMPORTANT — this step calls runCorpus with evaluateFully: false (see that
 * option's doc comment: executing every shell assertion in the full corpus,
 * including ones that run `pnpm build` or hit live endpoints, is not viable
 * in CI). That means this function can NEVER produce a `fail` status and
 * NEVER catches a real, currently-failing contract assertion — it is a
 * coverage-inventory ratchet (missing check scripts + unparseable contract
 * files), not an assertion-execution gate. Do not describe it as anything
 * else in a comment, a step name, or a log line; contract-f7.yaml A30 pins
 * this file's own honesty about that limit — see verify_ratchet_honesty.mjs.
 *
 * A parse-error is worse than a missing check script and must never be
 * silently absorbed: a file that fails to parse has an unknown number of
 * assertions inside it that have never run and never will until someone
 * fixes the YAML, and unlike "missing" it produces no per-assertion id to
 * even print — so its own count is tracked and ratcheted independently, not
 * folded into the missing count where it would be invisible.
 */
async function cmdCheckRatchet(baselinePath) {
  const baseline = loadBaselineOrExit(baselinePath);
  const count = baseline.count;
  if (typeof count !== 'number') {
    console.error(
      `run_contract_suite.mjs: baseline file is invalid — ${baselinePath} has no numeric "count". ` +
        'A corrupt baseline must never be silently treated as "no baseline, unlimited missing allowed".',
    );
    process.exit(1);
  }
  const parseErrorCount = baseline.parseErrorCount;
  if (typeof parseErrorCount !== 'number') {
    console.error(
      `run_contract_suite.mjs: baseline file is invalid — ${baselinePath} has no numeric ` +
        '"parseErrorCount". A corrupt baseline must never be silently treated as "no baseline, ' +
        'unlimited parse-error growth allowed".',
    );
    process.exit(1);
  }

  const results = await runCorpus({ bareIds: false, evaluateFully: false });
  const missing = results.filter((r) => r.status === 'missing');
  const parseErrors = results.filter((r) => r.status === 'parse-error');
  for (const r of missing) printResultLine(r);
  for (const r of parseErrors) printResultLine(r);
  console.log('');
  printUnresolvableBucket(results);

  console.log(
    `\nSUMMARY: ${missing.length} missing today vs. baseline of ${count}; ` +
      `${parseErrors.length} parse-error today vs. baseline of ${parseErrorCount}.`,
  );
  const failures = [];
  if (missing.length > count) {
    failures.push(
      `missing-check-script count increased (${missing.length} > ${count}) — new coverage was ` +
        'declared without being written. Either implement the referenced check script(s), or if ' +
        'this growth is deliberate and reviewed, regenerate the baseline with --write-baseline ' +
        '(never hand-edit it).',
    );
  }
  if (parseErrors.length > parseErrorCount) {
    failures.push(
      `parse-error count increased (${parseErrors.length} > ${parseErrorCount}) — a contract file ` +
        'is unparseable and every assertion inside it has silently never run. Fix the YAML, or if ' +
        'this growth is deliberate and reviewed, regenerate the baseline with --write-baseline ' +
        '(never hand-edit it).',
    );
  }
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.join(' ')}`);
    process.exit(1);
  }
  console.log(
    `PASS: missing (${missing.length}) and parse-error (${parseErrors.length}) counts are both at ` +
      `or below baseline (${count}, ${parseErrorCount}).`,
  );
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list-missing') {
    await cmdListMissing();
    return;
  }
  if (args[0] === '--verify-baseline') {
    await cmdVerifyBaseline(args[1]);
    return;
  }
  if (args[0] === '--write-baseline') {
    await cmdWriteBaseline(args[1]);
    return;
  }
  if (args[0] === '--check-ratchet') {
    await cmdCheckRatchet(args[1]);
    return;
  }
  await cmdDefault(args[0]);
}

main().catch((err) => {
  console.error(`run_contract_suite.mjs: unexpected error: ${err.stack ?? err}`);
  process.exit(1);
});
