#!/usr/bin/env bash
# verify_openrouter.sh — verification harness for setup_openrouter_config() in init.sh
#
# Sources init.sh (functions only; main() is guarded by BASH_SOURCE) and exercises
# the OpenRouter config writer in an isolated temp project.
#
# Usage: bash execution/checks/verify_openrouter.sh <mode>
#   mode = generate | idempotent | skip | merge | all   (default: all)
#
# Exit 0 = pass, non-zero = fail. Prints PASS/FAIL per case.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INIT="$REPO_ROOT/init.sh"
GOLDEN="$REPO_ROOT/.agent/memory/scratch/golden_settings_local.json"
CMP="$REPO_ROOT/execution/checks/json_equal.py"

fail() { echo "FAIL: $1" >&2; exit 1; }
[ -f "$INIT" ] || fail "init.sh not found at $INIT"
[ -f "$GOLDEN" ] || fail "golden not found at $GOLDEN"

run_case() {
  local mode="$1" tmp
  tmp="$(mktemp -d)"
  (
    # shellcheck disable=SC1090
    source "$INIT"          # defines functions; main() skipped via BASH_SOURCE guard
    PROJECT_PATH="$tmp"     # must be set AFTER source (init.sh resets it to $PWD)
    case "$mode" in
      generate|idempotent|merge) export OPENROUTER_API_KEY="sk-or-test123" ;;
      skip) unset OPENROUTER_API_KEY 2>/dev/null || true ;;
    esac
    if [ "$mode" = "merge" ]; then
      mkdir -p "$tmp/.claude"
      printf '%s' '{"env":{"FOO":"bar"}}' > "$tmp/.claude/settings.local.json"
    fi
    setup_openrouter_config
    [ "$mode" = "idempotent" ] && setup_openrouter_config   # second run must stay safe
    true
  ) || fail "$mode: function errored under set -e"

  local f="$tmp/.claude/settings.local.json"
  case "$mode" in
    skip)
      [ -f "$f" ] && fail "skip: file created when OPENROUTER_API_KEY unset"
      ;;
    generate|idempotent)
      [ -f "$f" ] || fail "$mode: settings.local.json not created"
      python3 "$CMP" "$f" "$GOLDEN" || fail "$mode: JSON does not match golden"
      ;;
    merge)
      [ -f "$f" ] || fail "merge: settings.local.json missing"
      python3 "$REPO_ROOT/execution/checks/verify_merge.py" "$f" || fail "merge: keys not merged / pre-existing key lost"
      ;;
  esac
  rm -rf "$tmp"
  echo "PASS: $mode"
}

MODE="${1:-all}"
if [ "$MODE" = "all" ]; then
  for m in generate idempotent skip merge; do run_case "$m"; done
  echo "ALL OPENROUTER CHECKS PASSED"
else
  run_case "$MODE"
fi
