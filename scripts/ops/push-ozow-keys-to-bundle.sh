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
# no BOM, and a value of only [A-Za-z0-9-]. Ozow's documentation does not state the issued
# character set (the operator's values are 11, 32 and 32 characters), so this is the conservative
# choice; a refusal names the key and the character CLASS only. Those exact three values are then
# (1) proven by the probe, scripts/ops/ozow-credential-probe.mts, passed to the child ONLY through
# its environment, overriding any OZOW_SANDBOX_* already exported in the parent shell, and (2)
# merged into the bundle. The probe must exit 0 before anything is read from Secret Manager or
# written.
#
# Secret handling: values live only in non-exported, script-unique shell variables (_ozsw_*, made
# non-exported with `declare +x` even if the operator's shell exports the same name), pipes, and the
# probe child's environment. Nothing is printed, put in argv, exported to gcloud/firebase, or placed
# in a here-string or heredoc (the only heredocs carry code and text). A same-user `ps eww` could
# show the probe child's environment, which is unavoidable for the environment-only hand-off. All
# output is key NAMES, lengths, version numbers and match/mismatch.
#
# Disk: firebase-tools writes everything it logs, including the decoded value printed by
# `apphosting:secrets:access`, to ./firebase-debug.log in its cwd, and deletes that file only on a
# clean exit with DEBUG unset. So EVERY firebase and gcloud call runs with cwd in a private (0700)
# temp directory created before the first call, with DEBUG removed from its environment. The
# EXIT/INT/TERM/HUP trap overwrites the files in that directory with zeros and removes it. gcloud
# runs with file logging disabled and HTTP logging off (it never handles a secret payload here:
# only `versions list` and `versions destroy`). A last check warns, naming the path only, if a
# firebase-debug*.log in the operator's original cwd was created or modified during the run.

set +x
set -euo pipefail
umask 077

readonly PROJECT="saoc-webapp"
readonly BUNDLE="SAOC_PAYMENT_SECRETS"
readonly BACKEND="saoc-prod"
readonly CONFIRM_PHRASE="push ${BUNDLE}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly ROOT
ORIG_CWD="$PWD"
readonly ORIG_CWD
readonly PROBE="scripts/ops/ozow-credential-probe.mts"
readonly VERSION_LIST_CMD="gcloud secrets versions list $BUNDLE --project $PROJECT"

# Secret holders: unique names, never exported even if the parent shell exports the same name.
unset _ozsw_site _ozsw_priv _ozsw_api _ozsw_parsed _ozsw_current _ozsw_bundle _ozsw_readback
declare +x _ozsw_site _ozsw_priv _ozsw_api _ozsw_parsed _ozsw_current _ozsw_bundle _ozsw_readback

TMPD=""
START_MARK=""
STAGE="pre"
OLD_VERSION=""
NEW_VERSION=""

# Overwrite every file in the temp dir with zeros, then remove the directory.
wipe_tmpd() {
  if [ -z "$TMPD" ] || [ ! -d "$TMPD" ]; then return 0; fi
  find "$TMPD" -type f -exec sh -c \
    'for f; do n=$(wc -c < "$f" | tr -d " "); if [ "$n" -gt 0 ]; then head -c "$n" /dev/zero > "$f"; fi; done' \
    sh {} + \
    || printf 'WARNING: could not overwrite temp files before removal\n' >&2
  rm -rf "$TMPD"
}

# Warn (path only, never content) about a firebase debug log in the operator's cwd from this run.
warn_stray_debug_logs() {
  if [ -z "$START_MARK" ] || [ ! -e "$START_MARK" ]; then return 0; fi
  local f
  for f in "$ORIG_CWD"/firebase-debug*.log; do
    # Not older than the start marker (second-granularity mtimes on old bash: equal counts as new).
    if [ -e "$f" ] && [ ! "$START_MARK" -nt "$f" ]; then
      printf 'WARNING: %s was created or modified during this run and may contain secret values.\n' "$f" >&2
      printf '         Overwrite and delete it yourself; its content was never printed.\n' >&2
    fi
  done
}

print_guidance() {
  case "$STAGE" in
    set_started)
      cat >&2 <<EOF

STOPPED after the secrets:set was started and before verification passed.
Known: old version $OLD_VERSION was NOT destroyed. Unknown: whether a new version was created.
Read-only check: $VERSION_LIST_CMD
If a second enabled version exists it is the new one: inspect it or destroy it by hand
(gcloud secrets versions destroy <N> --secret $BUNDLE --project $PROJECT). Do not re-run this script
until you have listed versions; it refuses to start with two enabled versions.
EOF
      ;;
    verified)
      cat >&2 <<EOF

STOPPED after a PASSED verification, before the destroy was requested.
Known: new version ${NEW_VERSION:-unknown} holds the verified values; old version $OLD_VERSION was NOT destroyed.
Read-only check: $VERSION_LIST_CMD
To finish: gcloud secrets versions destroy $OLD_VERSION --secret $BUNDLE --project $PROJECT
Then do the rollout described in docs/ozow-account-swap.md.
EOF
      ;;
    destroy_started)
      cat >&2 <<EOF

STOPPED while the destroy of old version $OLD_VERSION was running.
Known: new version ${NEW_VERSION:-unknown} holds the verified values. Unknown: whether the destroy completed.
Read-only check: $VERSION_LIST_CMD
Only if $OLD_VERSION is still listed as enabled: gcloud secrets versions destroy $OLD_VERSION --secret $BUNDLE --project $PROJECT
Then do the rollout described in docs/ozow-account-swap.md.
EOF
      ;;
    destroyed)
      cat >&2 <<EOF

STOPPED after the destroy of old version $OLD_VERSION SUCCEEDED; a later check failed or was interrupted.
Known: new version ${NEW_VERSION:-unknown} holds the verified values and the old version is destroyed.
Read-only check (expect exactly one enabled version, ${NEW_VERSION:-unknown}): $VERSION_LIST_CMD
Then do the rollout described in docs/ozow-account-swap.md.
EOF
      ;;
  esac
}

on_exit() {
  local code=$?
  warn_stray_debug_logs
  wipe_tmpd
  if [ "$code" -ne 0 ]; then print_guidance; fi
}
trap on_exit EXIT
trap 'exit 130' INT TERM
trap 'exit 129' HUP

die() {
  printf 'ERROR: %s\n' "$1" >&2
  exit "${2:-1}"
}

# Every firebase and gcloud call: cwd in the private temp dir, DEBUG removed (firebase also treats
# a --debug argument as DEBUG; we never pass one). gcloud: no log files, no HTTP logging.
fb() {
  ( cd "$TMPD" && exec env -u DEBUG firebase "$@" )
}
gc() {
  ( cd "$TMPD" && CLOUDSDK_CORE_DISABLE_FILE_LOGGING=true CLOUDSDK_CORE_LOG_HTTP=false exec gcloud "$@" )
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

TMPD="$(mktemp -d)"
chmod 700 "$TMPD"
START_MARK="$TMPD/.start-marker"
: > "$START_MARK"

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

function redact(bundlePath) {
  const bundle = parseBundle(fs.readFileSync(bundlePath, 'utf8'), 'bundle');
  let text = fs.readFileSync(0, 'utf8');
  for (const value of Object.values(bundle)) {
    if (value.length >= 4) text = text.split(value).join('[redacted]');
  }
  process.stdout.write(`${text.split('\n').slice(0, 20).join('\n')}\n`);
}

const [mode, arg] = process.argv.slice(1);
if (mode === 'parse') parseEnvFile(arg);
else if (mode === 'merge') merge(arg);
else if (mode === 'verify') verify(arg);
else if (mode === 'redact') redact(arg);
else fail(`unknown helper mode ${mode}`, 2);
JS

# Enabled secret versions, one number per line. Metadata only, never values.
enabled_versions() {
  gc secrets versions list "$BUNDLE" --project "$PROJECT" \
    --filter='state=enabled' --format='value(name.basename())'
}

printf 'Bundle %s in project %s%s\n' "$BUNDLE" "$PROJECT" "$([ "$DRY_RUN" = 1 ] && echo ' (DRY RUN)')"

echo "Step 1: strict-parse the env file (exactly one NAME=value per key, [A-Za-z0-9-] only)"
_ozsw_parsed="$(node -e "$NODE_HELPER" parse "$ENV_FILE")" || die "env file refused (see message above); nothing done" 3
{
  IFS= read -r _ozsw_site
  IFS= read -r _ozsw_priv
  IFS= read -r _ozsw_api
} < <(printf '%s\n' "$_ozsw_parsed")
unset _ozsw_parsed
echo "  parsed 3 values (lengths ${#_ozsw_site}, ${#_ozsw_priv}, ${#_ozsw_api})"

echo "Step 2: run the probe against exactly these three values; it must exit 0"
if [ "$DRY_RUN" = 1 ]; then
  echo "  (the probe makes real calls to Ozow and may leave one abandoned test transaction in the merchant admin)"
fi
# Environment-only hand-off. The assignments override any OZOW_SANDBOX_* exported in this shell.
PROBE_EXIT=0
(
  cd "$ROOT"
  OZOW_SANDBOX_SITE_CODE="$_ozsw_site" OZOW_SANDBOX_PRIVATE_KEY="$_ozsw_priv" \
    OZOW_SANDBOX_API_KEY="$_ozsw_api" node_modules/.bin/tsx "$PROBE"
) || PROBE_EXIT=$?
[ "$PROBE_EXIT" = 0 ] || die "probe exited $PROBE_EXIT (1 = FAIL, 3 = INCONCLUSIVE); nothing was read from or written to Secret Manager" 3

echo "Step 3: enabled versions before the change"
BEFORE="$(enabled_versions)" || die "could not list secret versions"
[[ "$BEFORE" =~ ^[0-9]+$ ]] \
  || die "expected exactly ONE enabled version number of $BUNDLE; found: $(printf '%s' "$BEFORE" | tr '\n' ' ')"
OLD_VERSION="$BEFORE"
echo "  enabled version: $OLD_VERSION"

echo "Step 4: read current bundle and merge the three keys in memory"
_ozsw_current="$(fb apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null)" \
  || die "could not read the current bundle (firebase apphosting:secrets:access failed); nothing was written"
_ozsw_bundle="$(printf '%s' "$_ozsw_current" \
  | node -e "$NODE_HELPER" merge <(printf '%s\n%s\n%s\n' "$_ozsw_site" "$_ozsw_priv" "$_ozsw_api"))" \
  || die "merge refused (see messages above)" 3
unset _ozsw_current _ozsw_site _ozsw_priv _ozsw_api

if [ "$DRY_RUN" = 1 ]; then
  echo "DRY RUN complete: probe passed, nothing was set and no version was destroyed."
  exit 0
fi

printf 'Step 5: type exactly "%s" to set the new bundle (anything else aborts): ' "$CONFIRM_PHRASE"
read -r ANSWER
[ "$ANSWER" = "$CONFIRM_PHRASE" ] || die "confirmation not given; nothing written" 2

echo "Step 6: set the new bundle exactly once"
STAGE="set_started"
SET_RC=0
printf '%s' "$_ozsw_bundle" \
  | fb apphosting:secrets:set "$BUNDLE" --data-file=- --project "$PROJECT" --force \
    > "$TMPD/set.out" 2>&1 || SET_RC=$?
if [ "$SET_RC" != 0 ]; then
  printf 'firebase output (known values redacted, first 20 lines):\n' >&2
  node -e "$NODE_HELPER" redact <(printf '%s' "$_ozsw_bundle") < "$TMPD/set.out" >&2 \
    || printf '(output could not be redacted, so it is not shown)\n' >&2
  die "secrets:set exited $SET_RC; whether a new version was created is UNKNOWN. Read-only check: $VERSION_LIST_CMD (a retry adds another billed version)"
fi

echo "Step 7: verify by re-reading (per-key sha256 compare, names only)"
AFTER="$(enabled_versions)" || die "could not list versions after set; old version $OLD_VERSION NOT destroyed. Read-only check: $VERSION_LIST_CMD"
NEW_VERSION="$(printf '%s\n' "$AFTER" | grep -vx "$OLD_VERSION" || true)"
[[ "$NEW_VERSION" =~ ^[0-9]+$ ]] \
  || die "could not identify the single new version; old version $OLD_VERSION NOT destroyed. Read-only check: $VERSION_LIST_CMD"
echo "  new version: $NEW_VERSION"
_ozsw_readback="$(fb apphosting:secrets:access "$BUNDLE" --project "$PROJECT" 2>/dev/null)" \
  || die "the re-read of the bundle FAILED, so verification was NOT performed; old version $OLD_VERSION NOT destroyed; new version $NEW_VERSION exists. Read-only check: $VERSION_LIST_CMD"
printf '%s' "$_ozsw_readback" | node -e "$NODE_HELPER" verify <(printf '%s' "$_ozsw_bundle") \
  || die "verification FAILED (re-read bundle differs from what was set); old version $OLD_VERSION NOT destroyed; new version $NEW_VERSION exists (destroy it by hand if abandoning)"
unset _ozsw_readback _ozsw_bundle
STAGE="verified"

echo "Step 8: destroy the previous version $OLD_VERSION"
STAGE="destroy_started"
gc secrets versions destroy "$OLD_VERSION" --secret "$BUNDLE" --project "$PROJECT" --quiet \
  > /dev/null || die "the destroy of version $OLD_VERSION FAILED; it is still enabled and billed. Destroy it by hand: gcloud secrets versions destroy $OLD_VERSION --secret $BUNDLE --project $PROJECT"
STAGE="destroyed"
LEFT="$(enabled_versions)" || die "the destroy of version $OLD_VERSION SUCCEEDED, but listing versions afterwards FAILED, so the final state is unconfirmed. Read-only check (expect one enabled version, $NEW_VERSION): $VERSION_LIST_CMD"
[ "$LEFT" = "$NEW_VERSION" ] || die "the destroy of version $OLD_VERSION SUCCEEDED, but the enabled versions are not just $NEW_VERSION (found: $(printf '%s' "$LEFT" | tr '\n' ' ')). Read-only check: $VERSION_LIST_CMD"
STAGE="done"

cat <<EOF
Done. $BUNDLE now has one enabled version ($NEW_VERSION).
Next (docs/secret-corruption-incidents.md: a secret change needs a rollout, the running revision
keeps the old value until then). Confirm the backend id first with
'firebase apphosting:backends:list --project $PROJECT', then:
  firebase apphosting:rollouts:create $BACKEND --project $PROJECT --git-branch main --force
Then run a test-mode checkout on beta (docs/ozow-account-swap.md).
EOF
