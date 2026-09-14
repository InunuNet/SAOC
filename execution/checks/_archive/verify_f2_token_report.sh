#!/usr/bin/env bash
# QA verification harness for F2 (token-accounting-hardening).
# One subcommand per contract-f2.yaml assertion that needs more than a
# single grep/one-liner (A1, A2, A3, A4, A5, A6, A8).
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORTER="$REPO_ROOT/execution/token_report.py"
GOLDENS="$REPO_ROOT/.agent/memory/project/specs/token-accounting-hardening/goldens"
FIXTURE="$GOLDENS/f2_session_usage_fixture.jsonl"

SUBCMD="${1:-}"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }

case "$SUBCMD" in

  golden_fixture_matches)
    OUT=$(python3 "$REPORTER" "$FIXTURE")
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "reporter exited $EXIT_CODE"

    for needle in \
      "2026-08-20" \
      "2026-08-21" \
      "claude-sonnet-5" \
      "claude-opus-5" \
      "Grand total: 5 sessions, 650,000 tokens"; do
      printf '%s' "$OUT" | grep -qF -- "$needle" || fail "missing substring: $needle"
    done

    # Numeric facts must appear verbatim, thousands-separated.
    printf '%s' "$OUT" | grep -qF "2 sessions" || fail "missing '2 sessions' for 2026-08-20"
    printf '%s' "$OUT" | grep -qF "250,000" || fail "missing 250,000 total for 2026-08-20"
    printf '%s' "$OUT" | grep -qF "125,000" || fail "missing 125,000 avg for 2026-08-20"
    printf '%s' "$OUT" | grep -qF "3 sessions" || fail "missing '3 sessions' for 2026-08-21"
    printf '%s' "$OUT" | grep -qF "400,000" || fail "missing 400,000 total for 2026-08-21"
    printf '%s' "$OUT" | grep -qF "133,333" || fail "missing 133,333 avg for 2026-08-21"
    printf '%s' "$OUT" | grep -qF "370,000" || fail "missing 370,000 for claude-sonnet-5"
    printf '%s' "$OUT" | grep -qF "56.9" || fail "missing 56.9 share for claude-sonnet-5"
    printf '%s' "$OUT" | grep -qF "280,000" || fail "missing 280,000 for claude-opus-5"
    printf '%s' "$OUT" | grep -qF "43.1" || fail "missing 43.1 share for claude-opus-5"

    echo "PASS"
    ;;

  section_order)
    OUT=$(python3 "$REPORTER" "$FIXTURE")
    DAY_LINE=$(printf '%s\n' "$OUT" | grep -n "2026-08-20" | head -1 | cut -d: -f1)
    MODEL_LINE=$(printf '%s\n' "$OUT" | grep -n "claude-sonnet-5" | head -1 | cut -d: -f1)
    [ -n "$DAY_LINE" ] || fail "could not find by-day row in output"
    [ -n "$MODEL_LINE" ] || fail "could not find by-model row in output"
    [ "$DAY_LINE" -lt "$MODEL_LINE" ] || fail "by-day line ($DAY_LINE) is not before by-model line ($MODEL_LINE)"
    echo "PASS"
    ;;

  model_rows_sorted_desc)
    OUT=$(python3 "$REPORTER" "$FIXTURE")
    SONNET_LINE=$(printf '%s\n' "$OUT" | grep -n "claude-sonnet-5" | head -1 | cut -d: -f1)
    OPUS_LINE=$(printf '%s\n' "$OUT" | grep -n "claude-opus-5" | head -1 | cut -d: -f1)
    [ -n "$SONNET_LINE" ] || fail "could not find claude-sonnet-5 row"
    [ -n "$OPUS_LINE" ] || fail "could not find claude-opus-5 row"
    [ "$SONNET_LINE" -lt "$OPUS_LINE" ] || fail "sonnet row ($SONNET_LINE) is not before opus row ($OPUS_LINE)"
    echo "PASS"
    ;;

  missing_file_graceful)
    NONEXISTENT="$WORK/does-not-exist.jsonl"
    OUT=$(python3 "$REPORTER" "$NONEXISTENT")
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "exit $EXIT_CODE, expected 0"
    [ "$OUT" = "No token usage data yet." ] || fail "stdout was $(printf '%q' "$OUT"), expected exactly 'No token usage data yet.'"
    echo "PASS"
    ;;

  empty_file_graceful)
    EMPTY="$WORK/empty.jsonl"
    : > "$EMPTY"
    OUT=$(python3 "$REPORTER" "$EMPTY")
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "exit $EXIT_CODE, expected 0"
    [ "$OUT" = "No token usage data yet." ] || fail "stdout was $(printf '%q' "$OUT"), expected exactly 'No token usage data yet.'"
    echo "PASS"
    ;;

  malformed_line_tolerated)
    CLEAN_OUT=$(python3 "$REPORTER" "$FIXTURE")
    CORRUPT="$WORK/corrupt.jsonl"
    cp "$FIXTURE" "$CORRUPT"
    echo 'not valid json{{{' >> "$CORRUPT"
    CORRUPT_OUT=$(python3 "$REPORTER" "$CORRUPT")
    EXIT_CODE=$?
    [ "$EXIT_CODE" = "0" ] || fail "exit $EXIT_CODE against corrupt fixture, expected 0"
    [ "$CLEAN_OUT" = "$CORRUPT_OUT" ] || fail "output differs when a corrupt line is appended (not byte-identical)"

    # Also probe: corrupt line at the START and in the MIDDLE, not just appended.
    CORRUPT_START="$WORK/corrupt_start.jsonl"
    { echo 'not valid json{{{'; cat "$FIXTURE"; } > "$CORRUPT_START"
    START_OUT=$(python3 "$REPORTER" "$CORRUPT_START")
    [ "$CLEAN_OUT" = "$START_OUT" ] || fail "output differs when a corrupt line is prepended"

    echo "PASS"
    ;;

  default_path_matches_f1)
    HOOK="$REPO_ROOT/execution/hooks/session_token_log.sh"
    F1_PATH=$(grep -o '\.agent/memory/project/telemetry/session_usage\.jsonl' "$HOOK" | head -1)
    F2_PATH=$(grep -o '\.agent/memory/project/telemetry/session_usage\.jsonl' "$REPORTER" | head -1)
    [ -n "$F1_PATH" ] || fail "could not find default log path literal in $HOOK"
    [ -n "$F2_PATH" ] || fail "could not find default log path literal in $REPORTER"
    [ "$F1_PATH" = "$F2_PATH" ] || fail "F1 path '$F1_PATH' != F2 path '$F2_PATH'"
    echo "PASS"
    ;;

  *)
    echo "Usage: $0 {golden_fixture_matches|section_order|model_rows_sorted_desc|missing_file_graceful|empty_file_graceful|malformed_line_tolerated|default_path_matches_f1}" >&2
    exit 2
    ;;
esac
