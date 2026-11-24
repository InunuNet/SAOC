#!/usr/bin/env bash
# Push the three OZOW_SANDBOX_* values from a local env file into the SAOC_PAYMENT_SECRETS bundle.
#
# OPERATOR-RUN ONLY. Follows docs/secret-bundles.md "Add or rotate a value" exactly:
#   read the bundle once, change the three keys in memory, `secrets:set` ONCE (each set adds a
#   billed version), verify by re-reading, destroy the previous version, then roll out.
#
# Usage:   scripts/ops/push-ozow-keys-to-bundle.sh [--dry-run] <env-file>
# Needs:   firebase CLI and gcloud (both logged in to project saoc-webapp), node, and
#          node_modules (pnpm install) for tsx.
# Dry run: does everything except secrets:set and the destroy. It still runs the probe, which
#          makes real calls to Ozow and may leave one abandoned test transaction in the merchant admin.
#
# The env file is parsed by a STRICT parser of our own, not by Node's dotenv parser (which treats
# an unquoted `#` as a comment and trims quotes). For each of the three keys the file must hold
# exactly one `NAME=value` line, no `export`, no indentation, no spaces around `=`, LF endings,
# and a value of only [A-Za-z0-9-]. Ozow's documentation does not state the issued character set
# (the operator's values are 11, 32 and 32 characters), so this is the conservative choice; a
# refusal names the key and the character CLASS only. Those exact three values are then (1) proven
# by the probe, scripts/ops/ozow-credential-probe.mts, passed to the child ONLY through its
# environment, overriding any OZOW_SANDBOX_* already exported in the parent shell, and (2) merged
# into the bundle. The probe must exit 0 before anything is read from Secret Manager or written.
#
# Secret handling: values live only in shell variables, pipes and the probe child's environment.
# Nothing is printed, written to disk, put in argv, exported, or placed in a here-string or heredoc
# (the only heredocs carry code and text). Process substitution and pipes are used for data. A
# same-user `ps eww` could show the probe child's environment, which is unavoidable for the
# environment-only hand-off. All output is key NAMES, lengths, version numbers and match/mismatch.
# No `set -x`. The only temp item is an empty directory (cwd for the firebase call, which
# docs/secret-bundles.md wants outside the repo); the EXIT trap removes it.

set -euo pipefail
umask 077

readonly PROJECT="saoc-webapp"
readonly BUNDLE="SAOC_PAYMENT_SECRETS"
readonly BACKEND="saoc-prod"
readonly CONFIRM_PHRASE="push ${BUNDLE}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly ROOT
readonly PROBE="scripts/ops/ozow-credential-probe.mts"

TMPD=""
STAGE="pre"
OLD_VERSION=""
NEW_VERSION=""

on_exit() {
  local code=$?
  if [ -n "$TMPD" ]; then rm -rf "$TMPD"; fi
  if [ "$code" -ne 0 ]; then
    case "$STAGE" in
      set_started)
        cat >&2 <<EOF

STOPPED between the set and a passed verification. A new version may or may not exist.
Version $OLD_VERSION was NOT destroyed and is still enabled. Run:
  gcloud secrets versions list $BUNDLE --project $PROJECT
If a second enabled version exists, it is the new one: compare it by hand or destroy it
(gcloud secrets versions destroy <N> --secret $BUNDLE --project $PROJECT). Do not re-run this
script until you have listed versions; it refuses to run with two enabled versions.
EOF
        ;;
      verified)
        cat >&2 <<EOF

STOPPED after a PASSED verification but before the destroy finished. New version ${NEW_VERSION:-unknown}
holds the verified values. Old version $OLD_VERSION may still be enabled and billed. Run:
  gcloud secrets versions list $BUNDLE --project $PROJECT
then, if $OLD_VERSION is still enabled:
  gcloud secrets versions destroy $OLD_VERSION --secret $BUNDLE --project $PROJECT
Then do the rollout described in docs/ozow-account-swap.md.
EOF
        ;;
    esac
  fi
}
trap on_exit EXIT
trap 'exit 130' INT TERM

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit "${2:-1}"
}

DRY_RUN=0
ENV_FILE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) die "unknown option: $arg" 2 ;;
    *) [ -z "$ENV_FILE" ] || die "only one env file path allowed" 2; ENV_FILE="$arg" ;;
  esac
done
[ -n "$ENV_FILE" ] || die "usage: $0 [--dry-run] <env-file>" 2
[ -f "$ENV_FILE" ] && [ -r "$ENV_FILE" ] || die "env file not readable: $ENV_FILE" 2
for tool in firebase gcloud node; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool not found on PATH" 2
done
[ -x "$ROOT/node_modules/.bin/tsx" ] || die "tsx not installed; run pnpm install in $ROOT" 2
if [ "$DRY_RUN" = 0 ]; then
  [ -t 0 ] || die "confirmation needs an interactive terminal (stdin is not a tty); nothing done" 2
fi

# Node helper, passed with -e so it never touches disk. It holds code only; data arrives on stdin
# or through /dev/fd paths.
read -r -d '' NODE_HELPER <<'JS' || true
const fs = require('fs');
const crypto = require('crypto');
const NAMES = ['OZOW_SANDBOX_SITE_CODE', 'OZOW_SANDBOX_PRIVATE_KEY', 'OZOW_SANDBOX_API_KEY'];
const fail = (message, code = 1) => { process.stderr.write(`ERROR: ${message}\n`); process.exit(code); };
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

function parseBundle(raw, label) {
  let parsed;
  try { parsed = JSON.parse(raw.endsWith('\n') ? raw.slice(0, -1) : raw); }
  catch { return fail(`${label} is not valid JSON`); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail(`${label} is not a JSON object`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') fail(`${label} key ${key} is not a string`);
  }
  return parsed;
}

// Acceptance is ONE positive test. The class list below is only for the message (character
// CLASSES, never the character itself), so a classification gap can never become an acceptance
// gap: a value that fails the test but matches no named class is reported as "other".
const VALUE_PATTERN = /^[A-Za-z0-9-]+$/;
function valueProblems(value) {
  if (VALUE_PATTERN.test(value)) return [];
  const problems = [];
  if (value.length === 0) problems.push('empty');
  if (/[\r\n\u2028\u2029]/.test(value)) problems.push('line break');
  if (/\s/.test(value)) problems.push('whitespace');
  if (/["'`]/.test(value)) problems.push('quote');
  if (/#/.test(value)) problems.push('hash');
  if (/[^\x00-\x7F]/.test(value)) problems.push('non-ASCII');
  if (problems.length === 0) problems.push('other');
  return problems;
}

function parseEnvFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) fail('env file starts with a UTF-8 BOM; re-save it without a BOM and retry', 3);
  if (raw.includes('\r')) fail('env file contains CR (CRLF line endings); convert it to LF and retry', 3);
  const lines = raw.split('\n');
  const values = [];
  for (const name of NAMES) {
    const assign = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`);
    const hits = lines.filter((line) => assign.test(line));
    if (hits.length === 0) fail(`${name} not found in the env file`, 3);
    if (hits.length > 1) fail(`${name} appears ${hits.length} times in the env file; keep exactly one`, 3);
    const exact = new RegExp(`^${name}=([\\s\\S]*)$`).exec(hits[0]);
    if (!exact) fail(`${name} line has an export prefix, indentation or spaces around "="; use exactly ${name}=value`, 3);
    const problems = valueProblems(exact[1]);
    if (problems.length) fail(`${name} value refused (${problems.join(', ')}); allowed characters are A-Z a-z 0-9 and "-"`, 3);
    values.push(exact[1]);
  }
  process.stdout.write(`${values.join('\n')}\n`);
}

function merge(valuesPath) {
  const bundle = parseBundle(fs.readFileSync(0, 'utf8'), 'current bundle');
  const lines = fs.readFileSync(valuesPath, 'utf8').split('\n');
  const env = {};
  NAMES.forEach((name, index) => { env[name] = lines[index] ?? ''; });
  for (const name of NAMES) {
    const problems = valueProblems(env[name]);
    process.stderr.write(`  ${name}: new length ${env[name].length}${problems.length ? ` REFUSED (${problems.join(', ')})` : ''}\n`);
    if (problems.length) fail(`value check failed for ${name}`, 3);
  }
  const next = { ...bundle };
  let changed = 0;
  for (const name of NAMES) {
    const state = !(name in bundle) ? 'ADDED (key was not in the bundle)'
      : bundle[name] === env[name] ? 'unchanged (identical)'
      : `replaced (length ${bundle[name].length} -> ${env[name].length})`;
    if (!(name in bundle) || bundle[name] !== env[name]) changed += 1;
    next[name] = env[name];
    process.stderr.write(`  ${name}: ${state}\n`);
  }
  const others = Object.keys(bundle).filter((key) => !NAMES.includes(key));
  process.stderr.write(`  other keys left byte-identical (${others.length}): ${others.join(', ')}\n`);
  if (changed === 0) fail('nothing to change; refusing to create a billed secret version', 4);
  process.stdout.write(JSON.stringify(next));
}

function verify(expectedPath) {
  const expected = parseBundle(fs.readFileSync(expectedPath, 'utf8'), 'expected bundle');
  const actual = parseBundle(fs.readFileSync(0, 'utf8'), 're-read bundle');
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  let ok = true;
  for (const key of [...keys].sort()) {
    const match = key in expected && key in actual && sha(expected[key]) === sha(actual[key]);
    if (!match) ok = false;
    process.stdout.write(`  ${key} ${match ? 'match' : 'mismatch'}\n`);
  }
  process.exit(ok ? 0 : 1);
}

const [mode, arg] = process.argv.slice(1);
if (mode === 'parse') parseEnvFile(arg);
else if (mode === 'merge') merge(arg);
else if (mode === 'verify') verify(arg);
else fail(`unknown helper mode ${mode}`, 2);
JS

# Enabled secret versions, one number per line. Metadata only, never values.
enabled_versions() {
  gcloud secrets versions list "$BUNDLE" --project "$PROJECT" \
    --filter='state=enabled' --format='value(name.basename())'
}

printf 'Bundle %s in project %s%s\n' "$BUNDLE" "$PROJECT" "$([ "$DRY_RUN" = 1 ] && echo ' (DRY RUN)')"

echo "Step 1: strict-parse the env file (exactly one NAME=value per key, [A-Za-z0-9-] only)"
PARSED="$(node -e "$NODE_HELPER" parse "$ENV_FILE")" || die "env file refused (see message above); nothing done" 3
{
  IFS= read -r SITE_CODE
  IFS= read -r PRIVATE_KEY
  IFS= read -r API_KEY
} < <(printf '%s\n' "$PARSED")
unset PARSED
echo "  parsed 3 values (lengths ${#SITE_CODE}, ${#PRIVATE_KEY}, ${#API_KEY})"

echo "Step 2: run the probe against exactly these three values; it must exit 0"
if [ "$DRY_RUN" = 1 ]; then
  echo "  (the probe makes real calls to Ozow and may leave one abandoned test transaction in the merchant admin)"
fi
# Environment-only hand-off. The assignments override any OZOW_SANDBOX_* exported in this shell.
PROBE_EXIT=0
(
  cd "$ROOT"
  OZOW_SANDBOX_SITE_CODE="$SITE_CODE" OZOW_SANDBOX_PRIVATE_KEY="$PRIVATE_KEY" \
    OZOW_SANDBOX_API_KEY="$API_KEY" node_modules/.bin/tsx "$PROBE"
) || PROBE_EXIT=$?
[ "$PROBE_EXIT" = 0 ] || die "probe exited $PROBE_EXIT (1 = FAIL, 3 = INCONCLUSIVE); nothing was read from or written to Secret Manager" 3

echo "Step 3: enabled versions before the change"
BEFORE="$(enabled_versions)" || die "could not list secret versions"
[ -n "$BEFORE" ] && [ "$(printf '%s\n' "$BEFORE" | wc -l | tr -d ' ')" = 1 ] \
  || die "expected exactly ONE enabled version of $BUNDLE; found: $(printf '%s' "$BEFORE" | tr '\n' ' ')"
OLD_VERSION="$BEFORE"
echo "  enabled version: $OLD_VERSION"

echo "Step 4: read current bundle and merge the three keys in memory"
CURRENT="$(firebase apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null)" \
  || die "could not read the current bundle (firebase apphosting:secrets:access failed)"
NEW_BUNDLE="$(printf '%s' "$CURRENT" \
  | node -e "$NODE_HELPER" merge <(printf '%s\n%s\n%s\n' "$SITE_CODE" "$PRIVATE_KEY" "$API_KEY"))" \
  || die "merge refused (see messages above)" 3
unset CURRENT SITE_CODE PRIVATE_KEY API_KEY

if [ "$DRY_RUN" = 1 ]; then
  echo "DRY RUN complete: probe passed, nothing was set and no version was destroyed."
  exit 0
fi

printf 'Step 5: type exactly "%s" to set the new bundle (anything else aborts): ' "$CONFIRM_PHRASE"
read -r ANSWER
[ "$ANSWER" = "$CONFIRM_PHRASE" ] || die "confirmation not given; nothing written" 2

echo "Step 6: set the new bundle exactly once"
TMPD="$(mktemp -d)"
STAGE="set_started"
printf '%s' "$NEW_BUNDLE" | (
  cd "$TMPD" \
    && firebase apphosting:secrets:set "$BUNDLE" --data-file=- --project "$PROJECT" --force
) >/dev/null 2>&1 || die "secrets:set failed; check 'gcloud secrets versions list $BUNDLE --project $PROJECT' before retrying (a retry adds another billed version)"

echo "Step 7: verify by re-reading (per-key sha256 compare, names only)"
AFTER="$(enabled_versions)" || die "could not list versions after set; old version $OLD_VERSION NOT destroyed"
NEW_VERSION="$(printf '%s\n' "$AFTER" | grep -vx "$OLD_VERSION" || true)"
[ -n "$NEW_VERSION" ] && [ "$(printf '%s\n' "$NEW_VERSION" | wc -l | tr -d ' ')" = 1 ] \
  || die "could not identify the single new version; old version $OLD_VERSION NOT destroyed"
echo "  new version: $NEW_VERSION"
firebase apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null \
  | node -e "$NODE_HELPER" verify <(printf '%s' "$NEW_BUNDLE") \
  || die "verification FAILED; old version $OLD_VERSION NOT destroyed; new version $NEW_VERSION exists (destroy it by hand if abandoning)"
STAGE="verified"

echo "Step 8: destroy the previous version $OLD_VERSION"
gcloud secrets versions destroy "$OLD_VERSION" --secret "$BUNDLE" --project "$PROJECT" --quiet \
  >/dev/null || die "destroy of version $OLD_VERSION failed; destroy it by hand (it is billed while it exists)"
LEFT="$(enabled_versions)" || die "could not list versions after destroy"
[ "$LEFT" = "$NEW_VERSION" ] || die "expected only version $NEW_VERSION enabled; found: $LEFT"
STAGE="done"

cat <<EOF
Done. $BUNDLE now has one enabled version ($NEW_VERSION).
Next (docs/secret-corruption-incidents.md: a secret change needs a rollout, the running revision
keeps the old value until then). Confirm the backend id first with
'firebase apphosting:backends:list --project $PROJECT', then:
  firebase apphosting:rollouts:create $BACKEND --project $PROJECT --git-branch main --force
Then run a test-mode checkout on beta (docs/ozow-account-swap.md).
EOF
