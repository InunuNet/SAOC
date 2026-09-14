// F2 (ticketing-complete, M1) contract self-defence — A13, redesigned 2026-09-08.
//
// WHAT THIS REPLACES
// The prior A13 was a two-stage grep pipe (grep -rlE '--apply' | xargs grep -l
// 'migrate-f2-ticket-taxonomy') scoped repo-wide across contracts/checks/. It went vacuous once
// (wrong directory, always empty, GREEN by construction — see A13's description history) and
// then over-broad once it was rescoped: it matched the literal string '--apply' ANYWHERE in a
// file, including safety comments. Two legitimate checks that call the migration's pure,
// network-free buildMigrationPlan() and DOCUMENT in a comment that they never reach --apply
// (check-vip-migration-plan-cutoff.mjs, check-vip-fix-scope-containment.mjs) tripped it. That
// made the cheapest way to pass GREEN delete the safety comment — a perverse incentive this rewrite
// removes.
//
// THE PROPERTY THIS PROVES
// No file under contracts/checks/ actually INVOKES the migration with --apply — i.e. no file
// combines (a) a reference to migrate-f2-ticket-taxonomy, (b) the --apply flag, and (c) a
// process-execution construct (execSync/spawn/exec/execFile and their Sync variants, or an
// import of node:child_process), all outside of comments. Mentioning --apply in prose (a
// safety note explaining a check never reaches it) does not trip this; actually shelling out
// to the migration with --apply does.
//
// WHY COMMENT-STRIPPING, NOT LINE CO-OCCURRENCE
// The three signals can legitimately live on different lines/array elements of one exec call
// (e.g. execSync(['npx', 'tsx', 'scripts/migrate-f2-ticket-taxonomy.ts', '--apply'].join(' '))
// or a multi-line template literal), so this requires all three to exist ANYWHERE in the
// file's non-comment text, not co-located on one line. Comment stripping is what keeps prose
// from tripping it; the execution-construct requirement is what keeps a bare string-literal
// mention (e.g. a parser-argument test like `expectApply('--apply present', ['--apply'], true)`
// against a DIFFERENT migration's CLI parser — see ticketing-f4-roles-claim's
// check-migration-dry-run-default.mjs, a real precedent in this repo) from tripping it either:
// testing that a flag parses is not invoking anything.
//
// TRADEOFFS OF THE COMMENT STRIPPER
// It removes /* ... */ blocks (incl. multi-line) and // line comments, but does NOT parse
// JS string/template literals — a // or /* that appears inside a string would be
// (incorrectly) treated as a comment start. No file in this repo does that today (checked:
// no check script embeds a URL or comment-token inside a string literal), and it is the same
// class of simplification this contract already accepts elsewhere (A15's runtime-read
// preferred over pure grep specifically to avoid text-matching fragility, but a full JS
// parser is out of proportion for a contract guard). A code review that ever adds such a
// string should route the exec-construct + --apply + migration-name combination through a
// second script rather than defeat this one via string-embedded comment syntax.
//
// SAFETY: this script only reads files under contracts/checks/ and does string inspection.
// It never imports or executes anything from scripts/, never touches Sanity, no network.
//
// Run as: node contracts/checks/ticketing-complete-f2/check-no-migration-apply-invocation.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CHECKS_ROOT = resolve('contracts/checks');
const SELF_PATH = resolve('contracts/checks/ticketing-complete-f2/check-no-migration-apply-invocation.mjs');
const MIGRATION_NAME = 'migrate-f2-ticket-taxonomy';
const APPLY_FLAG = '--apply';
const EXEC_CONSTRUCT_RE = /\b(execSync|spawnSync|execFileSync|spawn|execFile|exec)\s*\(|from\s+['"]node:child_process['"]|require\(\s*['"](node:)?child_process['"]\s*\)/;

function stripComments(src) {
  // Block comments first (non-greedy, spans newlines), then line comments.
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function listFiles(dir) {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out = out.concat(listFiles(full));
    } else if (st.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];

for (const file of listFiles(CHECKS_ROOT)) {
  if (resolve(file) === SELF_PATH) continue; // detector excludes itself from its own scan
  const raw = readFileSync(file, 'utf8');
  const stripped = stripComments(raw);

  const mentionsMigration = stripped.includes(MIGRATION_NAME);
  const mentionsApply = stripped.includes(APPLY_FLAG);
  const hasExecConstruct = EXEC_CONSTRUCT_RE.test(stripped);

  if (mentionsMigration && mentionsApply && hasExecConstruct) {
    failures.push(
      `${file}: outside comments, references '${MIGRATION_NAME}', the '${APPLY_FLAG}' flag, ` +
      `and a process-execution construct together — this looks like a real invocation of the ` +
      `migration with --apply, which would mutate the live Sanity dataset.`
    );
  }
}

if (failures.length > 0) {
  console.error('FAIL: check-no-migration-apply-invocation.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('PASS: no check script under contracts/checks/ invokes migrate-f2-ticket-taxonomy with --apply.');
process.exit(0);
