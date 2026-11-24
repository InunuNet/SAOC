#!/usr/bin/env bash
# Push the three OZOW_SANDBOX_* values from a local env file into the SAOC_PAYMENT_SECRETS bundle.
#
# OPERATOR-RUN ONLY. Follows docs/secret-bundles.md "Add or rotate a value" exactly:
#   read the bundle once, change the three keys in memory, `secrets:set` ONCE (each set adds a
#   billed version), verify by re-reading, destroy the previous version, then roll out.
#
# Usage:   scripts/ops/push-ozow-keys-to-bundle.sh [--dry-run] <env-file>
# Needs:   firebase CLI and gcloud (both logged in to project saoc-webapp), node >= 20.12.
# Dry run: does every read and the full merge and summary, then stops before any write/destroy.
#
# Secret handling: values live only in shell variables and pipes. No value is printed, written
# to disk, put in argv, or exported to a child environment. All output is key NAMES, lengths,
# version numbers and match/mismatch. No `set -x`. The only temp item is an empty directory
# (cwd for the firebase call, which docs/secret-bundles.md wants outside the repo); a trap
# removes it on every exit path.

set -euo pipefail
umask 077

readonly PROJECT="saoc-webapp"
readonly BUNDLE="SAOC_PAYMENT_SECRETS"
readonly BACKEND="saoc-prod"
readonly CONFIRM_PHRASE="push ${BUNDLE}"

TMPD=""
cleanup() {
  if [ -n "$TMPD" ]; then rm -rf "$TMPD"; fi
}
trap cleanup EXIT
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

# Node helper, passed with -e so it never touches disk. Data arrives on stdin or /dev/fd paths.
read -r -d '' NODE_HELPER <<'JS' || true
const fs = require('fs');
const crypto = require('crypto');
const util = require('util');
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

function shapeProblems(value) {
  if (value === undefined) return ['missing'];
  const problems = [];
  if (value.length === 0) problems.push('empty');
  if (value !== value.trim()) problems.push('leading or trailing whitespace');
  if (/^["'`]|["'`]$/.test(value)) problems.push('surrounding quotes');
  if (/[\r\n]/.test(value)) problems.push('contains CR or LF');
  return problems;
}

function merge(envFile) {
  const bundle = parseBundle(fs.readFileSync(0, 'utf8'), 'current bundle');
  const env = util.parseEnv(fs.readFileSync(envFile, 'utf8'));
  const bad = NAMES.filter((name) => shapeProblems(env[name]).length > 0);
  for (const name of NAMES) {
    process.stderr.write(`  ${name}: new length ${(env[name] ?? '').length}` +
      `${shapeProblems(env[name]).length ? ` SHAPE PROBLEM: ${shapeProblems(env[name]).join(', ')}` : ''}\n`);
  }
  if (bad.length) fail(`shape check failed for ${bad.join(', ')}`, 3);
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
if (mode === 'merge') merge(arg);
else if (mode === 'verify') verify(arg);
else fail(`unknown helper mode ${mode}`, 2);
JS

# Enabled secret versions, one number per line. Metadata only, never values.
enabled_versions() {
  gcloud secrets versions list "$BUNDLE" --project "$PROJECT" \
    --filter='state=enabled' --format='value(name.basename())'
}

printf 'Bundle %s in project %s%s\n' "$BUNDLE" "$PROJECT" "$([ "$DRY_RUN" = 1 ] && echo ' (DRY RUN)')"

echo "Step 1: enabled versions before the change"
BEFORE="$(enabled_versions)" || die "could not list secret versions"
[ -n "$BEFORE" ] && [ "$(printf '%s\n' "$BEFORE" | wc -l | tr -d ' ')" = 1 ] \
  || die "expected exactly ONE enabled version of $BUNDLE; found: $(printf '%s' "$BEFORE" | tr '\n' ' ')"
OLD_VERSION="$BEFORE"
echo "  enabled version: $OLD_VERSION"

echo "Step 2: read current bundle and merge the three keys in memory"
CURRENT="$(firebase apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null)" \
  || die "could not read the current bundle (firebase apphosting:secrets:access failed)"
NEW_BUNDLE="$(printf '%s' "$CURRENT" | node -e "$NODE_HELPER" merge "$ENV_FILE")" \
  || die "merge refused (see messages above)" 3
unset CURRENT

if [ "$DRY_RUN" = 1 ]; then
  echo "DRY RUN complete: no secret was set and no version was destroyed."
  exit 0
fi

[ -t 0 ] || die "confirmation needs an interactive terminal" 2
printf 'Step 3: type exactly "%s" to set the new bundle (anything else aborts): ' "$CONFIRM_PHRASE"
read -r ANSWER
[ "$ANSWER" = "$CONFIRM_PHRASE" ] || die "confirmation not given; nothing written" 2

echo "Step 4: set the new bundle exactly once"
TMPD="$(mktemp -d)"
printf '%s' "$NEW_BUNDLE" | (
  cd "$TMPD" \
    && firebase apphosting:secrets:set "$BUNDLE" --data-file=- --project "$PROJECT" --force
) >/dev/null 2>&1 || die "secrets:set failed; check 'gcloud secrets versions list $BUNDLE --project $PROJECT' before retrying (a retry adds another billed version)"

echo "Step 5: verify by re-reading (per-key sha256 compare, names only)"
AFTER="$(enabled_versions)" || die "could not list versions after set; old version $OLD_VERSION NOT destroyed"
NEW_VERSION="$(printf '%s\n' "$AFTER" | grep -vx "$OLD_VERSION" || true)"
[ -n "$NEW_VERSION" ] && [ "$(printf '%s\n' "$NEW_VERSION" | wc -l | tr -d ' ')" = 1 ] \
  || die "could not identify the single new version; old version $OLD_VERSION NOT destroyed"
echo "  new version: $NEW_VERSION"
firebase apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null \
  | node -e "$NODE_HELPER" verify <(printf '%s' "$NEW_BUNDLE") \
  || die "verification FAILED; old version $OLD_VERSION NOT destroyed; new version $NEW_VERSION exists (destroy it by hand if abandoning)"

echo "Step 6: destroy the previous version $OLD_VERSION"
gcloud secrets versions destroy "$OLD_VERSION" --secret "$BUNDLE" --project "$PROJECT" --quiet \
  >/dev/null || die "destroy of version $OLD_VERSION failed; destroy it by hand (it is billed while it exists)"
LEFT="$(enabled_versions)" || die "could not list versions after destroy"
[ "$LEFT" = "$NEW_VERSION" ] || die "expected only version $NEW_VERSION enabled; found: $LEFT"

cat <<EOF
Done. $BUNDLE now has one enabled version ($NEW_VERSION).
Next (docs/secret-corruption-incidents.md: a secret change needs a rollout, the running revision
keeps the old value until then). Confirm the backend id first with
'firebase apphosting:backends:list --project $PROJECT', then:
  firebase apphosting:rollouts:create $BACKEND --project $PROJECT --git-branch main --force
Then run a test-mode checkout on beta (docs/ozow-account-swap.md).
EOF
