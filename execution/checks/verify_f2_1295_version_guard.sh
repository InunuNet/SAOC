#!/usr/bin/env bash
# verify_f2_1295_version_guard.sh -- golden-file behavioral check for mission
# harness-integrity-hardening F2 (GH #1295, adversarial review Finding 1).
#
# Bug: this repo's own .agent/version (3.7.109, source of truth) and
# .agent/profile.json's template_version (3.7.107) had drifted apart in the
# TEMPLATE repo itself -- a template that lies about its own currency.
#
# Fix contract this script enforces:
#   (a) THIS repo's .agent/version and .agent/profile.json.template_version
#       must match (checked directly by contract assertion A1, not by this
#       script).
#   (b) A NEW guard script, execution/checks/verify_version_fields_match.py,
#       must exist and:
#         - exit 0, no error output, when .agent/version ==
#           profile.json.template_version (read relative to CWD).
#         - exit non-zero with BOTH version values named in its output when
#           they differ.
#         - exit non-zero with a clear "cannot verify" style message (never
#           a silent pass) when either file is missing/unparseable -- safe
#           default is to BLOCK, not to wave divergence through.
#       It must NOT touch/modify bump_version.sh or the is_template_repo
#       self-update guard in execution/update_template.py.
#
# This script is a TEST HARNESS for that guard script: it copies the (not
# yet existing, pre-fix) execution/checks/verify_version_fields_match.py
# into isolated fixture directories with controlled .agent/version +
# profile.json pairs and asserts its exit code / output. No real repo state
# is touched.
#
# Usage: verify_f2_1295_version_guard.sh <case>
#   match             -- fixture goldens/f2_match (.agent/version ==
#                         profile.json.template_version) -> guard exits 0.
#   mismatch          -- fixture goldens/f2_mismatch (versions differ) ->
#                         guard exits non-zero, output names both values.
#   missing_profile   -- profile.json absent entirely -> guard exits
#                         non-zero with a clear message (safe default: block
#                         on doubt, never silently pass).
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
GUARD="$REPO_ROOT/execution/checks/verify_version_fields_match.py"

if [ ! -f "$GUARD" ]; then
  echo "FAIL: guard script not found -- @dev must implement execution/checks/verify_version_fields_match.py (mission F2/b): $GUARD" >&2
  exit 1
fi

run_case() {
  local fixture_dir="$1"
  local sandbox
  sandbox="$(mktemp -d)"
  mkdir -p "$sandbox/.agent"
  [ -f "$fixture_dir/.agent/version" ] && cp "$fixture_dir/.agent/version" "$sandbox/.agent/version"
  [ -f "$fixture_dir/.agent/profile.json" ] && cp "$fixture_dir/.agent/profile.json" "$sandbox/.agent/profile.json"
  ( cd "$sandbox" && python3 "$GUARD" ) >"$sandbox/out.log" 2>&1
  echo "$?" > "$sandbox/rc"
  echo "$sandbox"
}

case "$CASE" in
  match)
    SB="$(run_case "$REPO_ROOT/.agent/memory/project/specs/harness-integrity-hardening/goldens/f2_match")"
    RC="$(cat "$SB/rc")"
    if [ "$RC" != "0" ]; then
      echo "FAIL: match -- guard exited $RC on matching version fields (expected 0)" >&2
      cat "$SB/out.log" >&2
      rm -rf "$SB"
      exit 1
    fi
    echo "PASS: match -- guard exits 0 when .agent/version == profile.json.template_version"
    rm -rf "$SB"
    ;;

  mismatch)
    SB="$(run_case "$REPO_ROOT/.agent/memory/project/specs/harness-integrity-hardening/goldens/f2_mismatch")"
    RC="$(cat "$SB/rc")"
    OUT="$(cat "$SB/out.log")"
    if [ "$RC" = "0" ]; then
      echo "FAIL: mismatch -- guard exited 0 on divergent version fields (3.7.109 vs 3.7.107) -- must fail loud" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "3.7.109"; then
      echo "FAIL: mismatch -- guard output does not name the .agent/version value (3.7.109)" >&2
      echo "$OUT" >&2
      rm -rf "$SB"
      exit 1
    fi
    if ! echo "$OUT" | grep -q "3.7.107"; then
      echo "FAIL: mismatch -- guard output does not name the profile.json template_version value (3.7.107)" >&2
      echo "$OUT" >&2
      rm -rf "$SB"
      exit 1
    fi
    echo "PASS: mismatch -- guard exits non-zero and names both diverging values"
    rm -rf "$SB"
    ;;

  missing_profile)
    sandbox="$(mktemp -d)"
    mkdir -p "$sandbox/.agent"
    printf '3.7.109\n' > "$sandbox/.agent/version"
    ( cd "$sandbox" && python3 "$GUARD" ) >"$sandbox/out.log" 2>&1
    RC=$?
    if [ "$RC" = "0" ]; then
      echo "FAIL: missing_profile -- guard exited 0 when profile.json is entirely absent (must block on doubt, not silently pass)" >&2
      cat "$sandbox/out.log" >&2
      rm -rf "$sandbox"
      exit 1
    fi
    if [ ! -s "$sandbox/out.log" ]; then
      echo "FAIL: missing_profile -- guard produced no output explaining the failure" >&2
      rm -rf "$sandbox"
      exit 1
    fi
    echo "PASS: missing_profile -- guard blocks with a clear message when profile.json is absent"
    rm -rf "$sandbox"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected match|mismatch|missing_profile)" >&2
    exit 1
    ;;
esac
