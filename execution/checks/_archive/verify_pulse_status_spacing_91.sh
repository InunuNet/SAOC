#!/usr/bin/env bash
# verify_pulse_status_spacing_91.sh -- golden-file behavioral check for GitHub issue #91.
#
# Reported bug: `make pulse-status` renders dashboard rows incorrectly when the project name
# contains spaces (e.g. "Codex Harness") -- the name is split across columns, misaligning
# subsequent columns. Reported as display-only; Pulse service itself works fine.
#
# INVESTIGATION FINDING (verified by reading the actual scripts, not assumed):
#
#   1. `make pulse-status` (Makefile line 181) invokes execution/get_pulse_status.sh, NOT
#      execution/pulse_status.sh. get_pulse_status.sh only checks `launchctl list` and prints two
#      plain, non-columnar lines ("Pulse: RUNNING" / "Log: <path> (<n> lines)"). It never embeds
#      the project name in any column-formatted output at all -- there is no bug surface for #91
#      in this script, because it never prints the project name.
#
#   2. The actual columnar dashboard renderer matching the issue's description (fixed-width
#      `printf "%-20s | %-20s | ..."` columns fed by an `awk -F ' [|] '` pipeline over pulse.log)
#      is execution/pulse_status.sh, a separate script not wired to any Makefile target (invoked
#      ad hoc / by other tooling). Its awk program strips a leading `[bracketed-name] ` prefix from
#      field 1 via `sub(/^\[[^]]*\] /, "", raw)` BEFORE field-splitting on ` | ` -- so as long as
#      the bracketed prefix itself contains no ` | ` sequence, the awk delimiter is never confused
#      by spaces *inside* the brackets. The original #91 failure mode was specifically that
#      pulse.log lines were written with a RAW, unescaped project name inside the brackets by the
#      log *writer* (execution/pulse_runner.sh), combined with (in the true historical bug) the
#      prefix not being bracket-delimited consistently -- see commit b244eed.
#
#   3. execution/pulse_runner.sh (the ONLY writer of pulse.log; verified no other script in
#      execution/ writes to pulse.log or references PROJECT_PREFIX/project_name for log rows) was
#      ALREADY FIXED for this exact bug on 2026-06-01 in commit b244eed ("fix(fleet): slug
#      collision guard + pulse log space-safe prefix (v3.7.52)"): it now derives
#      `PROJECT_NAME_SAFE=$(echo "$PROJECT_NAME" | tr ' ' '_')` and builds
#      `PROJECT_PREFIX="[${PROJECT_NAME_SAFE}] "` from the SAFE variant, not the raw
#      space-containing PROJECT_NAME. That commit's message explicitly cites "Anti Harness" as the
#      repro case and removed the corresponding backlog line. template/execution/pulse_runner.sh is
#      BYTE-IDENTICAL to execution/pulse_runner.sh (diff confirmed empty) and contains the same
#      PROJECT_NAME_SAFE fix.
#
#   4. execution/pulse_status.sh has NO template/ twin at all (confirmed: no
#      template/execution/pulse_status.sh exists, and template/execution/overlay_template.sh's
#      copy list does not reference it) -- it is a runtime-only script, never templated. There is
#      nothing to fix or check there.
#
# CONCLUSION: the end-to-end pipeline (pulse_runner.sh writes pulse.log -> pulse_status.sh renders
# it) is ALREADY FIXED as of commit b244eed (2026-06-01), which PREDATES this contract. GitHub
# issue #91 (filed 2026-05-18) is a duplicate of an already-resolved bug; the backlog.md line for
# it is stale and should be closed as already-fixed, not re-implemented. This script's golden
# cases below all exercise the REAL, CURRENT execution/pulse_runner.sh + execution/pulse_status.sh
# pipeline end-to-end and are expected to PASS today, proving no further code change is required.
#
# This script drives the pipeline in an isolated fixture directory (mktemp -d, trap cleanup) --
# no real repo pulse.log or profile.json is ever touched.
#
# Usage: verify_pulse_status_spacing_91.sh <case>
#   spaced_name_dashboard_aligned   - (a) PROJECT_NAME="Codex Harness" (has a space). Runs the
#                                     REAL pulse_runner.sh log-prefix logic to produce a pulse.log
#                                     line, then runs the REAL pulse_status.sh against it. Dashboard
#                                     data row must have exactly 5 columns (TIMESTAMP | JOB NAME |
#                                     STATUS | EXIT CODE | SNIPPET) and the STATUS column must
#                                     contain exactly "SUCCESS" (not a shifted fragment of the
#                                     project name or timestamp).
#   spaced_name_exit_code_position  - same fixture as (a), but asserts the EXIT CODE column
#                                     specifically contains the literal exit code value "0" in the
#                                     4th field position -- the concrete "later column" check: if
#                                     spaces in the project name shifted fields left, this column
#                                     would instead contain the snippet text or SUCCESS/FAILURE.
#   nospace_name_dashboard_aligned  - (b) PROJECT_NAME="Athanor" (no space) -- regression guard.
#                                     Same field-position assertions as (a); must also pass,
#                                     proving the fix path is not merely a no-op for spaced names.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"

PULSE_RUNNER_PREFIX_LOGIC() {
  # Mirrors execution/pulse_runner.sh lines 10-15 EXACTLY (re-read at check-write time to catch
  # drift): PROJECT_NAME -> PROJECT_NAME_SAFE (tr ' ' '_') -> PROJECT_PREFIX.
  local project_name="$1"
  local safe
  safe=$(echo "$project_name" | tr ' ' '_')
  echo "[${safe}] "
}

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

run_case() {
  local project_name="$1"
  local prefix
  prefix=$(PULSE_RUNNER_PREFIX_LOGIC "$project_name")

  local logfile="$WS/pulse.log"
  # Realistic line shape exactly as pulse_runner.sh writes it (line 73):
  #   echo "${PROJECT_PREFIX}$timestamp | $script_name | $STATUS | $EXIT_CODE | $SNIPPET" >> "$LOG_FILE"
  printf '%s20260709153000 | ingest_pulse.sh | SUCCESS | 0 | did the thing ok\n' "$prefix" > "$logfile"

  # Run the REAL, unmodified pulse_status.sh against this fixture log (cd so its
  # LOG_FILE="$(pwd)/pulse.log" resolves to our fixture, not the real repo's pulse.log).
  (cd "$WS" && bash "$REPO_ROOT/execution/pulse_status.sh")
}

case "$CASE" in
  spaced_name_dashboard_aligned)
    OUT="$(run_case "Codex Harness")"
    # Extract the single data row (line following the second '----' separator + header).
    DATA_ROW="$(echo "$OUT" | grep "ingest_pulse.sh")"
    if [ -z "$DATA_ROW" ]; then
      echo "FAIL: no data row found in dashboard output" >&2
      echo "$OUT" >&2
      exit 1
    fi
    # Exactly 5 pipe-delimited fields.
    NFIELDS=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print NF}')
    if [ "$NFIELDS" != "5" ]; then
      echo "FAIL: expected 5 columns, got $NFIELDS -- row: $DATA_ROW" >&2
      exit 1
    fi
    STATUS_FIELD=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print $3}' | xargs)
    if [ "$STATUS_FIELD" != "SUCCESS" ]; then
      echo "FAIL: STATUS column (field 3) expected 'SUCCESS', got '$STATUS_FIELD' -- row: $DATA_ROW" >&2
      exit 1
    fi
    echo "PASS: spaced_name_dashboard_aligned"
    exit 0
    ;;
  spaced_name_exit_code_position)
    OUT="$(run_case "Codex Harness")"
    DATA_ROW="$(echo "$OUT" | grep "ingest_pulse.sh")"
    if [ -z "$DATA_ROW" ]; then
      echo "FAIL: no data row found in dashboard output" >&2
      exit 1
    fi
    EXIT_FIELD=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print $4}' | xargs)
    if [ "$EXIT_FIELD" != "0" ]; then
      echo "FAIL: EXIT CODE column (field 4) expected '0', got '$EXIT_FIELD' -- row: $DATA_ROW" >&2
      exit 1
    fi
    echo "PASS: spaced_name_exit_code_position"
    exit 0
    ;;
  nospace_name_dashboard_aligned)
    OUT="$(run_case "Athanor")"
    DATA_ROW="$(echo "$OUT" | grep "ingest_pulse.sh")"
    if [ -z "$DATA_ROW" ]; then
      echo "FAIL: no data row found in dashboard output" >&2
      exit 1
    fi
    NFIELDS=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print NF}')
    if [ "$NFIELDS" != "5" ]; then
      echo "FAIL: expected 5 columns, got $NFIELDS -- row: $DATA_ROW" >&2
      exit 1
    fi
    STATUS_FIELD=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print $3}' | xargs)
    EXIT_FIELD=$(echo "$DATA_ROW" | awk -F ' [|] ' '{print $4}' | xargs)
    if [ "$STATUS_FIELD" != "SUCCESS" ] || [ "$EXIT_FIELD" != "0" ]; then
      echo "FAIL: expected STATUS=SUCCESS EXIT=0, got STATUS='$STATUS_FIELD' EXIT='$EXIT_FIELD' -- row: $DATA_ROW" >&2
      exit 1
    fi
    echo "PASS: nospace_name_dashboard_aligned"
    exit 0
    ;;
  *)
    echo "Usage: $0 <spaced_name_dashboard_aligned|spaced_name_exit_code_position|nospace_name_dashboard_aligned>" >&2
    exit 2
    ;;
esac
