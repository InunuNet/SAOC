#!/usr/bin/env bash
# verify_version_sync_1285.sh -- golden-file behavioral check for GitHub issue #1285.
#
# Bug: execution/update_template.py's update_profile_version() reads the fetched
# upstream .agent/version and writes it ONLY into .agent/profile.json's
# template_version field. The standalone .agent/version file at the repo root
# is never updated on the fetch-from-GitHub update path (make update-template /
# make self-update), so it drifts from profile.json and from upstream.
#
# This script drives the REAL execution/update_template.py against isolated
# fixture directories (a fake "source" tree standing in for the fetched
# upstream tarball, and a fake "workspace" tree standing in for a downstream
# project) so no real repo state is touched.
#
# Usage: verify_version_sync_1285.sh <case>
#   drift          - source version differs from local .agent/version AND
#                     profile.json.template_version -> BOTH local files must
#                     end up matching the fetched source version.
#   match           - source version already equals local .agent/version and
#                     profile.json.template_version -> files stay correct AND
#                     no spurious version-change line is logged.
#   missing_local   - local .agent/version does not exist yet (older
#                      workspace) -> must be created with the fetched version,
#                      no crash.
#   missing_source  - source/.agent/version does not exist at all (e.g. a
#                      fetch that produced no version file) -> local
#                      .agent/version and profile.json must be left untouched,
#                      no crash, existing SKIP behavior preserved.
#   local_dir       - local .agent/version is a DIRECTORY, not a file ->
#                      must degrade to a WARN that skips the local-version
#                      sync (directory left untouched), no crash, while
#                      profile.json.template_version still updates normally.
#   empty_source    - source/.agent/version exists but is empty/whitespace
#                      only -> treated as invalid/absent, no writes to
#                      either local .agent/version or profile.json, WARN/SKIP
#                      logged, no crash.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="$REPO_ROOT/execution/update_template.py"
CASE="${1:-}"

WS="$(mktemp -d)"
SRC="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" "$SRC" 2>/dev/null || true; }
trap cleanup EXIT

mkdir -p "$WS/.agent"
printf 'paths: []\n' > "$WS/.agent/update-manifest.yaml"
printf 'GoldenFixtureProject-1285\n' > "$WS/WORKSPACE"

setup_source_version() {
  mkdir -p "$SRC/.agent"
  printf '%s' "$1" > "$SRC/.agent/version"
}

case "$CASE" in
  drift)
    printf '1.2.3' > "$WS/.agent/version"
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "1.2.3", "autonomy": {"level": "high"}}
JSON
    setup_source_version "9.9.9-golden"
    ;;
  match)
    printf '5.5.5' > "$WS/.agent/version"
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "5.5.5", "autonomy": {"level": "high"}}
JSON
    setup_source_version "5.5.5"
    ;;
  missing_local)
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "1.0.0", "autonomy": {"level": "high"}}
JSON
    setup_source_version "9.9.9-golden"
    ;;
  missing_source)
    printf '1.2.3' > "$WS/.agent/version"
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "1.2.3", "autonomy": {"level": "high"}}
JSON
    mkdir -p "$SRC"  # deliberately: no .agent/version in source at all
    ;;
  local_dir)
    rm -rf "$WS/.agent/version"
    mkdir -p "$WS/.agent/version"  # deliberately: a directory, not a file
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "1.2.3", "autonomy": {"level": "high"}}
JSON
    setup_source_version "9.9.9-golden"
    ;;
  empty_source)
    printf '1.2.3' > "$WS/.agent/version"
    cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1285", "template_version": "1.2.3", "autonomy": {"level": "high"}}
JSON
    mkdir -p "$SRC/.agent"
    printf '' > "$SRC/.agent/version"  # deliberately: zero-byte source version
    ;;
  *)
    echo "FAIL: unknown case '$CASE' (expected drift|match|missing_local|missing_source)" >&2
    exit 1
    ;;
esac

OUT="$(cd "$WS" && python3 "$TARGET" --source "$SRC" --apply 2>&1)"
RC=$?

if [ "$RC" -ne 0 ]; then
  echo "FAIL: update_template.py exited $RC for case '$CASE'" >&2
  echo "$OUT" >&2
  exit 1
fi

if echo "$OUT" | grep -qi "Traceback"; then
  echo "FAIL: update_template.py raised an unhandled exception for case '$CASE'" >&2
  echo "$OUT" >&2
  exit 1
fi

LOCAL_VERSION=""
[ -f "$WS/.agent/version" ] && LOCAL_VERSION="$(cat "$WS/.agent/version")"
PROFILE_VERSION="$(python3 -c "import json; print(json.load(open('$WS/.agent/profile.json')).get('template_version',''))")"

case "$CASE" in
  drift)
    if [ "$LOCAL_VERSION" != "9.9.9-golden" ]; then
      echo "FAIL: local .agent/version is '$LOCAL_VERSION', expected '9.9.9-golden' (drift not synced)" >&2
      exit 1
    fi
    if [ "$PROFILE_VERSION" != "9.9.9-golden" ]; then
      echo "FAIL: profile.json template_version is '$PROFILE_VERSION', expected '9.9.9-golden'" >&2
      exit 1
    fi
    echo "PASS: drift case -- local .agent/version and profile.json both synced to 9.9.9-golden"
    ;;
  match)
    if [ "$LOCAL_VERSION" != "5.5.5" ]; then
      echo "FAIL: local .agent/version changed unexpectedly to '$LOCAL_VERSION' in already-matching case" >&2
      exit 1
    fi
    if [ "$PROFILE_VERSION" != "5.5.5" ]; then
      echo "FAIL: profile.json template_version changed unexpectedly to '$PROFILE_VERSION'" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qiE "agent/version.*(→|->)"; then
      echo "FAIL: spurious version-change log line emitted when source already matched local" >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: match case -- no drift, no spurious write/log noise"
    ;;
  missing_local)
    if [ "$LOCAL_VERSION" != "9.9.9-golden" ]; then
      echo "FAIL: local .agent/version was not created (got '$LOCAL_VERSION'), expected '9.9.9-golden'" >&2
      exit 1
    fi
    echo "PASS: missing_local case -- .agent/version created fresh, no crash"
    ;;
  missing_source)
    if [ "$LOCAL_VERSION" != "1.2.3" ]; then
      echo "FAIL: local .agent/version was modified to '$LOCAL_VERSION' even though source had no version file" >&2
      exit 1
    fi
    if [ "$PROFILE_VERSION" != "1.2.3" ]; then
      echo "FAIL: profile.json template_version was modified to '$PROFILE_VERSION' even though source had no version file" >&2
      exit 1
    fi
    echo "PASS: missing_source case -- no write attempted, no crash, existing SKIP behavior preserved"
    ;;
  local_dir)
    if [ ! -d "$WS/.agent/version" ]; then
      echo "FAIL: local .agent/version directory was removed/replaced; expected it left untouched as a directory" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qiE "warn.*(directory|not a file)|(directory|not a file).*warn"; then
      echo "FAIL: no WARN log line about local .agent/version being a directory (got: $OUT)" >&2
      exit 1
    fi
    if [ "$PROFILE_VERSION" != "9.9.9-golden" ]; then
      echo "FAIL: profile.json template_version is '$PROFILE_VERSION', expected '9.9.9-golden' (local-dir WARN should not block the rest of the update)" >&2
      exit 1
    fi
    echo "PASS: local_dir case -- no crash, WARN logged, local-version sync skipped, profile.json still updated"
    ;;
  empty_source)
    if [ "$LOCAL_VERSION" != "1.2.3" ]; then
      echo "FAIL: local .agent/version was modified to '$LOCAL_VERSION' even though source version was empty" >&2
      exit 1
    fi
    if [ "$PROFILE_VERSION" != "1.2.3" ]; then
      echo "FAIL: profile.json template_version was modified to '$PROFILE_VERSION' even though source version was empty" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qiE "(skip|warn).*empty|empty.*(skip|warn)"; then
      echo "FAIL: no SKIP/WARN log line about the empty source .agent/version (got: $OUT)" >&2
      exit 1
    fi
    echo "PASS: empty_source case -- empty source version treated as absent, no writes, no crash"
    ;;
esac
