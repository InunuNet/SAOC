// A2/A3 — F1: mechanical proof that the lock/timeout invariant (contract.py's kill
// ceiling must exceed _shared.mjs's suite-lock wait) holds for every assertion whose
// command transitively imports ticketing-hardening/_shared.mjs, and stays proven as the
// suite changes (no hand-maintained ID list). See
// contracts/golden/payfast-m1-lock-cleanup-fix/lock-timeout-invariant.golden.md and its
// README ("Decision on point 1").
//
// Two halves:
//   1. Pure comparator self-test (always runs, no credentials, no I/O).
//   2. Live check: parses contracts/contract-payfast-m1.yaml (or a --fixture stand-in),
//      resolves each assertion's command to the script path(s) it invokes, then walks
//      each script's import graph TEXTUALLY and RECURSIVELY (static source-text parse —
//      it never resolves or loads a module through Node's module resolver, so a fixture
//      whose import specifier does not actually resolve on disk, by design — see
//      fixtures/stand-in-lock-waiting-script.mjs's own header comment — is still
//      classified correctly) until it either reaches ticketing-hardening/_shared.mjs
//      through any chain of static imports, side-effect imports, `export * from`,
//      `export { x } from`, or literal-string dynamic `import(...)`, or exhausts the
//      graph. See the "Import-graph walk" section below for exactly what it can and
//      cannot follow, and CEILING.md-equivalent notes in the golden for the honestly
//      remaining limits. Fails loudly if any assertion whose command transitively
//      imports _shared.mjs declares a timeout_seconds below MIN_ASSERTION_TIMEOUT_MS,
//      and also fails loudly (never silently passes) when the walk cannot fully resolve
//      part of the graph — see "UNRESOLVED handling" below.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LOCK_WAIT_MS, ASSERTION_TIMEOUT_SAFETY_MARGIN_MS, MIN_ASSERTION_TIMEOUT_MS } from '../ticketing-hardening/_shared.mjs';

const ASSERTION_ID = 'A2';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_CONTRACT_PATH = path.join(REPO_ROOT, 'contracts/contract-payfast-m1.yaml');
const SHARED_MODULE_SUFFIX = 'ticketing-hardening/_shared.mjs';

// ---------------------------------------------------------------------------
// 1. Pure comparator (self-tested below, then used for real)
// ---------------------------------------------------------------------------

/**
 * Returns null when `timeoutSeconds` covers `lockWaitingScriptCount` full lock waits
 * (each with its own network safety margin) run sequentially in one command, a
 * descriptive problem string otherwise. Covering a single lock wait with zero margin is
 * still a fail — the margin is not optional (see golden's "do not shrink the margin"
 * note).
 *
 * `lockWaitingScriptCount` defaults to 1 (the common case: one script per command). For
 * a multi-script command (e.g. `scriptA.mts && scriptB.mjs`), pass the number of those
 * scripts that independently import _shared.mjs — contract.py's timeout applies to the
 * WHOLE command, and each lock-waiting script run sequentially inside it can
 * independently need up to a full lock wait plus its own post-wait network round trips,
 * so the required budget scales linearly with that count. See "Multi-script commands"
 * below for how the live check derives this count.
 */
export function checkTimeoutCovers(lockWaitMs, marginMs, timeoutSeconds, lockWaitingScriptCount = 1) {
  const requiredMs = lockWaitingScriptCount * (lockWaitMs + marginMs);
  const actualMs = timeoutSeconds * 1000;
  if (actualMs >= requiredMs) return null;
  return `timeout_seconds ${timeoutSeconds} (${actualMs}ms) is below the required ${requiredMs}ms (${lockWaitingScriptCount} lock-waiting script(s) x [LOCK_WAIT_MS ${lockWaitMs}ms + margin ${marginMs}ms])`;
}

function selfTest() {
  const failures = [];
  if (checkTimeoutCovers(90_000, 30_000, 120) !== null) {
    failures.push('checkTimeoutCovers(90_000, 30_000, 120) must accept a covering timeout (120s == 90s + 30s)');
  }
  if (!checkTimeoutCovers(90_000, 30_000, 10)) {
    failures.push('checkTimeoutCovers(90_000, 30_000, 10) must reject a timeout far below the threshold');
  }
  if (!checkTimeoutCovers(90_000, 30_000, 90)) {
    failures.push(
      'checkTimeoutCovers(90_000, 30_000, 90) must reject a timeout that covers LOCK_WAIT_MS with zero margin'
    );
  }
  if (checkTimeoutCovers(90_000, 30_000, 240, 2) !== null) {
    failures.push('checkTimeoutCovers(90_000, 30_000, 240, 2) must accept a timeout covering 2 sequential lock waits (240s == 2 x 120s)');
  }
  if (!checkTimeoutCovers(90_000, 30_000, 150, 2)) {
    failures.push(
      'checkTimeoutCovers(90_000, 30_000, 150, 2) must reject 150s when 2 lock-waiting scripts require 240s'
    );
  }
  if (failures.length > 0) {
    console.error(`FAIL: ${ASSERTION_ID} self-test — checkTimeoutCovers() can no longer discriminate`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`PASS: ${ASSERTION_ID} self-test — checkTimeoutCovers() discriminates covering vs. inadequate timeouts`);
}

selfTest();

// ---------------------------------------------------------------------------
// 2. Contract-YAML parsing (text-based, not a full YAML parser — see header comment)
// ---------------------------------------------------------------------------

const SCRIPT_PATH_PATTERN = /[\w./-]+\.(?:mjs|mts|ts|sh)\b/g;

/** Splits the checks: list into one text block per assertion (from one "- id:" line up
 * to, but not including, the next one). */
function splitIntoBlocks(yamlText) {
  const lines = yamlText.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const idMatch = /^\s*-\s*id:\s*(\S+)/.exec(line);
    if (idMatch) {
      if (current) blocks.push(current);
      current = { id: idMatch[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

/** Extracts the `command:` field's raw text (up to the next sibling key, or end of
 * block) from one assertion block, so script-path extraction never accidentally reads
 * paths mentioned only in `description:`. */
function extractCommandText(blockText) {
  const match = /command:\s*([\s\S]*?)(?=\n\s{2,8}\w+:\s|$)/.exec(blockText);
  return match ? match[1] : '';
}

function extractTimeoutSeconds(blockText) {
  const match = /timeout_seconds:\s*(\d+)/.exec(blockText);
  return match ? Number(match[1]) : 60; // contract.py's own default (execution/contract.py)
}

/** Parses one contract YAML file into {id, timeoutSeconds, scriptPaths}[]. */
function parseAssertions(yamlText) {
  return splitIntoBlocks(yamlText).map((block) => {
    const blockText = block.lines.join('\n');
    const commandText = extractCommandText(blockText);
    const scriptPaths = [...new Set(commandText.match(SCRIPT_PATH_PATTERN) ?? [])];
    return { id: block.id, timeoutSeconds: extractTimeoutSeconds(blockText), scriptPaths };
  });
}

// ---------------------------------------------------------------------------
// Import-graph walk (text-based — see header comment on why this never resolves modules
// through Node's actual module resolver)
// ---------------------------------------------------------------------------
//
// Matches, on one line each (no multi-line import statements in this codebase):
//   - static `import ... from '<spec>'` (including `import x, { y } from '<spec>'`)
//   - static side-effect `import '<spec>'`
//   - `export * from '<spec>'` and `export { x } from '<spec>'` (both contain `from`,
//     so the same pattern catches them — this is exactly the barrel/re-export shape the
//     regression fixture below exercises)
//   - dynamic `import('<spec>')` / `await import('<spec>')` with a LITERAL string
//     specifier — A18-A21's scripts each load ticketing-hardening/_shared.mjs this way.
const LITERAL_IMPORT_SPECIFIER_PATTERN = /(?:\bfrom\s+|^\s*import\s+|\bimport\s*\(\s*)['"]([^'"]+)['"]/gm;

// A dynamic `import(` call whose argument is NOT a string literal (a variable, template
// expression, etc. — see _itn-harness.mts:116's `import(/* @vite-ignore */ override)`).
// The specifier is not present as text at all, so it can never be resolved by a static
// parse. Any file containing one of these contributes to the UNRESOLVED set below.
const COMPUTED_DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(?!['"])/g;

function extractImportSpecifiers(sourceText) {
  return [...sourceText.matchAll(LITERAL_IMPORT_SPECIFIER_PATTERN)].map((m) => m[1]);
}

function hasComputedDynamicImport(sourceText) {
  return COMPUTED_DYNAMIC_IMPORT_PATTERN.test(sourceText);
}

// Candidate suffixes tried, in order, when a relative specifier has no extension of its
// own (e.g. `../lib/payfast` resolving to `lib/payfast.ts`) — this is TEXTUAL path
// probing (trying candidate file paths on disk), never Node's module resolution
// algorithm (no package.json "main"/"exports" lookup, no directory-with-index beyond
// the one literal `/index.<ext>` guess below). If none of these exist either, the
// specifier is genuinely unresolved (see walkImportsForShared's UNRESOLVED handling).
const EXTENSIONLESS_CANDIDATE_SUFFIXES = ['.ts', '.mts', '.tsx', '.mjs', '.js', '.jsx'];

function readSourceIfPresent(relativePath) {
  const resolved = path.join(REPO_ROOT, relativePath);
  try {
    return readFileSync(resolved, 'utf8');
  } catch {
    // fall through to extension probing below
  }
  if (/\.\w+$/.test(relativePath)) return null; // already had an extension; no probing to do
  for (const suffix of EXTENSIONLESS_CANDIDATE_SUFFIXES) {
    try {
      return readFileSync(resolved + suffix, 'utf8');
    } catch {
      // try the next candidate
    }
  }
  for (const suffix of EXTENSIONLESS_CANDIDATE_SUFFIXES) {
    try {
      return readFileSync(path.join(resolved, 'index' + suffix), 'utf8');
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** A specifier not starting with '.' or '/' is a bare package name (`dotenv`,
 * `node:dns`) or a bundler/tsconfig path alias (`@/lib/payfast`). _shared.mjs is always
 * reached through this codebase's own relative-path tree under contracts/checks/ — it
 * is never published as a package and never referenced through an alias anywhere in
 * this suite (verified by inspection at the time this walk was written) — so these are
 * safely skipped rather than treated as unresolved. This is a stated assumption, not a
 * structural guarantee: if this suite ever grows a path alias that could plausibly
 * reach _shared.mjs, this assumption must be revisited. */
function isExternalOrAliasedSpecifier(specifier) {
  return !(specifier.startsWith('.') || specifier.startsWith('/'));
}

/** Resolves a relative/absolute-from-repo-root specifier found inside `fromRelPath` to
 * another repo-root-relative path — pure string/path-segment math, never touches the
 * filesystem itself (that happens in readSourceIfPresent when the caller tries to read
 * it). `fromRelPath` and the returned path are both repo-root-relative, exactly as they
 * appear in contract command text, so the recursion stays in one consistent coordinate
 * system at every depth. */
function resolveLocalSpecifier(fromRelPath, specifier) {
  if (specifier.startsWith('/')) return specifier.replace(/^\/+/, '');
  const fromDirAbs = path.dirname(path.join(REPO_ROOT, fromRelPath));
  const resolvedAbs = path.resolve(fromDirAbs, specifier);
  return path.relative(REPO_ROOT, resolvedAbs);
}

/**
 * Recursively walks the import graph starting at `entryRelPath` (repo-root-relative)
 * looking for a specifier that reaches ticketing-hardening/_shared.mjs.
 *
 * Returns { found, unresolved }:
 *   - found: true once any specifier in the chain literally ends with
 *     SHARED_MODULE_SUFFIX. This check is done on the specifier TEXT itself, before any
 *     attempt to resolve/open the target file — so a specifier that is textually
 *     correct but does not actually resolve on disk (fixtures/stand-in-lock-waiting-
 *     script.mjs's deliberately-broken relative path, kept exactly as-is for A3) is
 *     still classified correctly, per this file's header comment.
 *   - unresolved: true if the walk hit a part of the graph it could not follow to a
 *     conclusion — a local specifier whose resolved path is not a readable file, or a
 *     computed dynamic import() with no literal specifier to follow. UNRESOLVED HANDLING
 *     (point 2 of the hardening task): the live check below treats `unresolved` the
 *     SAME as `found` for the purpose of requiring the timeout floor — an assertion is
 *     never allowed to silently read as "not lock-waiting" just because part of its
 *     import graph could not be followed. This is the conservative, fail-safe choice;
 *     it can produce a false positive (an assertion forced to the floor even though the
 *     unresolved branch never actually reaches _shared.mjs) but can never produce the
 *     false negative this hardening pass exists to close.
 *   External/aliased specifiers (isExternalOrAliasedSpecifier) are skipped outright —
 *   see that function's comment for why that is not an instance of "cannot follow".
 *
 * Cycle-safe: `visited` is a set of repo-root-relative paths already entered in this
 * walk; a specifier pointing back into it is treated as already-explored (neither found
 * nor unresolved from this edge) rather than re-descended into.
 */
function walkImportsForShared(entryRelPath, visited) {
  if (visited.has(entryRelPath)) return { found: false, unresolved: false };
  visited.add(entryRelPath);

  const source = readSourceIfPresent(entryRelPath);
  if (source === null) {
    // The entry itself doesn't resolve to a readable file. At the top level this is
    // filtered out by the SCRIPT_PATH_PATTERN/readSourceIfPresent check in
    // transitivelyImportsShared (e.g. `pnpm`, `node` are never matched as script
    // paths). Reached only for an internal hop whose resolved local path has no file on
    // disk — an unresolved edge, not "safely not lock-waiting".
    return { found: false, unresolved: true };
  }

  let unresolved = hasComputedDynamicImport(source);
  for (const specifier of extractImportSpecifiers(source)) {
    if (specifier.endsWith(SHARED_MODULE_SUFFIX)) return { found: true, unresolved: false };
    if (isExternalOrAliasedSpecifier(specifier)) continue;
    const nextRelPath = resolveLocalSpecifier(entryRelPath, specifier);
    const sub = walkImportsForShared(nextRelPath, visited);
    if (sub.found) return { found: true, unresolved: false };
    if (sub.unresolved) unresolved = true;
  }
  return { found: false, unresolved };
}

/** True/conservative-true if the script at `scriptPath` (repo-root-relative, as it
 * appears literally in the contract's command string) transitively imports
 * ticketing-hardening/_shared.mjs, walking the full import graph (see
 * walkImportsForShared above) rather than one hardcoded hop. Returns `unresolved: true`
 * alongside `affected: false` when the walk could not fully resolve the graph, so the
 * caller can still require the timeout floor without claiming the script is definitely
 * lock-waiting. */
function transitivelyImportsShared(scriptPath) {
  if (readSourceIfPresent(scriptPath) === null) {
    return { affected: false, unresolved: false }; // not a script file this walk can reason about
  }
  const result = walkImportsForShared(scriptPath, new Set());
  return { affected: result.found, unresolved: !result.found && result.unresolved };
}

// ---------------------------------------------------------------------------
// Live check
// ---------------------------------------------------------------------------

function parseFixtureArg(argv) {
  const flagIndex = argv.indexOf('--fixture');
  if (flagIndex === -1) return undefined;
  const value = argv[flagIndex + 1];
  if (!value) throw new Error('--fixture requires a path argument.');
  return value;
}

function runLiveCheck() {
  const fixtureArg = parseFixtureArg(process.argv.slice(2));
  const contractPath = fixtureArg ? path.resolve(fixtureArg) : DEFAULT_CONTRACT_PATH;
  const yamlText = readFileSync(contractPath, 'utf8');
  const assertions = parseAssertions(yamlText);

  // Multi-script commands (e.g. A30/A31's `scriptA.mts && scriptB.mjs`): each script
  // path extracted from the command is walked independently. contract.py's timeout
  // applies to the WHOLE command, and scripts run sequentially, so the number of
  // lock-waiting (found OR unresolved — see walkImportsForShared's doc comment) scripts
  // in one command determines how many multiples of the floor that command's single
  // declared timeout_seconds must cover.
  const offenders = [];
  const notes = [];
  for (const assertion of assertions) {
    let lockWaitingScriptCount = 0;
    let anyUnresolved = false;
    for (const scriptPath of assertion.scriptPaths) {
      const { affected, unresolved } = transitivelyImportsShared(scriptPath);
      if (affected || unresolved) lockWaitingScriptCount += 1;
      if (unresolved) anyUnresolved = true;
    }
    if (lockWaitingScriptCount === 0) continue;
    if (anyUnresolved) {
      notes.push(
        `${assertion.id}: import graph could not be fully resolved for at least one script — conservatively requiring the timeout floor (see check-lock-timeout-invariant.mjs's "UNRESOLVED HANDLING" doc comment)`
      );
    }
    const problem = checkTimeoutCovers(
      LOCK_WAIT_MS,
      ASSERTION_TIMEOUT_SAFETY_MARGIN_MS,
      assertion.timeoutSeconds,
      lockWaitingScriptCount
    );
    if (problem) offenders.push({ id: assertion.id, problem });
  }

  for (const note of notes) console.warn(`NOTE: ${ASSERTION_ID} — ${note}`);

  if (offenders.length > 0) {
    console.error(
      `FAIL: ${ASSERTION_ID} — ${offenders.length} assertion(s) transitively import ticketing-hardening/_shared.mjs (or the import graph could not be fully resolved) but declare an inadequate timeout_seconds:`
    );
    for (const offender of offenders) console.error(`  - ${offender.id}: ${offender.problem}`);
    process.exit(1);
  }
  console.log(
    `PASS: ${ASSERTION_ID} — every lock-waiting assertion in ${path.relative(REPO_ROOT, contractPath)} declares timeout_seconds >= ${MIN_ASSERTION_TIMEOUT_MS / 1000}s`
  );
}

runLiveCheck();
