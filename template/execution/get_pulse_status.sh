#!/usr/bin/env bash
# get_pulse_status.sh — pulse-scoped-health F2: honest health check for the
# Athanor Pulse launchd job.
#
# Previously this script only ever checked whether ITS LABEL was registered
# with launchd (`launchctl list "$SERVICE" | grep`) -- registration only,
# never WHOSE job it actually is, whether it is succeeding, or whether it
# has run recently. That reported "Pulse: RUNNING" for 7 straight weeks
# while the label belonged to a DIFFERENT project's crash-looping job
# (sibling project SAOC silently stole this project's launchd label slot
# via the same unscoped `make install-pulse` target -- see
# pulse-scoped-health F1). Now this script calls `launchctl print
# gui/$(id -u)/$SERVICE` and checks, in priority order: (1) identity --
# does the registered job actually belong to THIS project; (2) exit status
# -- is it succeeding, not merely registered; (3) log freshness -- has it
# actually run recently, not just loaded once and gone silent.
#
# SERVICE is computed by execution/derive_pulse_label.sh (F1) -- the SINGLE
# place a pulse label is derived from project identity. Never hardcode the
# label here; a status checker still querying the old global literal after
# F1 ships scoped labels would silently query the wrong (or no) label
# forever, for every project.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# PROJECT_ROOT_OVERRIDE (testability requirement): an optional first
# positional argument points this script at a fixture project root instead
# of deriving PROJECT_ROOT from this script's own on-disk location. Zero-
# argument behavior (today's only real calling convention, `make
# pulse-status` -> `bash execution/get_pulse_status.sh`) is unchanged.
if [ -n "${1:-}" ]; then
    PROJECT_ROOT="$1"
else
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
fi

LOG_FILE="$PROJECT_ROOT/pulse.log"
PLIST_FILE="$PROJECT_ROOT/execution/com.athanor.pulse.plist"
LABEL_SCRIPT="$SCRIPT_DIR/derive_pulse_label.sh"

SERVICE="$(bash "$LABEL_SCRIPT" "$PROJECT_ROOT")"
UID_NUM="$(id -u)"

PRINT_OUTPUT="$(launchctl print "gui/$UID_NUM/$SERVICE" 2>&1)"
PRINT_RC=$?

if [ "$PRINT_RC" -ne 0 ]; then
    echo "Pulse: NOT INSTALLED"
    # F3 FINDING 1: "NOT INSTALLED" is only the truth about the NEW
    # scoped label -- a workspace that ran Pulse under the OLD, pre-F1
    # unscoped literal still has a real job (possibly reassigned to a
    # foreign project since) that this alone would hide. Fold
    # check_legacy_pulse_label.sh's findings in whenever there are any;
    # stay exactly the original bare message when there are none.
    # `|| true` mirrors this script's own always-informational,
    # never-blocking posture for the legacy check (opposite of F3
    # FINDING 2's collision check, which the Makefile calls unguarded).
    LEGACY_OUTPUT="$(bash "$SCRIPT_DIR/check_legacy_pulse_label.sh" "$PROJECT_ROOT" 2>/dev/null || true)"
    if [ -n "$LEGACY_OUTPUT" ]; then
        echo "   NOTE: a legacy (pre-scoping) Pulse job was found still registered:"
        printf '%s\n' "$LEGACY_OUTPUT" | sed 's/^/   /'
    fi
    echo "   Run: make install-pulse  (to install)"
    echo "   Run: make pulse-start    (to start)"
    if [ -f "$LOG_FILE" ]; then
        echo "Log: $LOG_FILE ($(wc -l < "$LOG_FILE") lines)"
    fi
    exit 1
fi

# The registered "program" field is often just an interpreter (/bin/bash)
# and proves nothing about identity -- the actually-invoked script is the
# LAST entry of the "arguments" array (confirmed empirically against a
# real hijacked job on this machine, see contract-f2.yaml). Handles both
# the multi-line rendering (each argument on its own indented line, the
# documented real/stub format) and a same-line "{ a b c }" rendering.
REGISTERED_PROGRAM="$(printf '%s\n' "$PRINT_OUTPUT" | awk '
    /arguments = \{/ {
        in_args = 1
        rest = $0
        sub(/^.*arguments = \{/, "", rest)
        if (rest ~ /\}/) {
            sub(/\}.*$/, "", rest)
            n = split(rest, toks, /[ \t]+/)
            for (i = 1; i <= n; i++) if (toks[i] != "") last = toks[i]
            in_args = 0
        }
        next
    }
    in_args && /\}/ {
        line = $0
        sub(/\}.*$/, "", line)
        gsub(/^[ \t]+/, "", line); gsub(/[ \t]+$/, "", line)
        if (line != "") last = line
        in_args = 0
        next
    }
    in_args {
        line = $0
        gsub(/^[ \t]+/, "", line); gsub(/[ \t]+$/, "", line)
        if (line != "") last = line
    }
    END { print last }
')"

REGISTERED_WORKDIR="$(printf '%s\n' "$PRINT_OUTPUT" | awk -F'= ' '/^[ \t]*working directory = /{ print $2; exit }')"
LAST_EXIT_CODE="$(printf '%s\n' "$PRINT_OUTPUT" | awk -F'= ' '/^[ \t]*last exit code = /{ print $2; exit }')"

EXPECTED_PROGRAM="$PROJECT_ROOT/execution/pulse_runner.sh"

if [ "$REGISTERED_PROGRAM" != "$EXPECTED_PROGRAM" ] || [ "$REGISTERED_WORKDIR" != "$PROJECT_ROOT" ]; then
    echo "Pulse: UNHEALTHY (hijacked)"
    echo "   Registered program:           ${REGISTERED_PROGRAM:-<none>}"
    echo "   Expected program:              $EXPECTED_PROGRAM"
    echo "   Registered working directory: ${REGISTERED_WORKDIR:-<none>}"
    echo "   Expected working directory:    $PROJECT_ROOT"
    exit 1
fi

if [ "${LAST_EXIT_CODE:-0}" != "0" ]; then
    echo "Pulse: UNHEALTHY (crash-looping)"
    echo "   Last exit code: $LAST_EXIT_CODE"
    exit 1
fi

# Staleness: pulse.log's mtime must be within 3x the plist's OWN
# StartInterval -- read from the real plist on disk, never hardcoded, so
# the threshold tracks whatever interval this project actually ships.
START_INTERVAL="$(awk '
    /<key>StartInterval<\/key>/ { getline; gsub(/[^0-9]/, "", $0); print $0; exit }
' "$PLIST_FILE" 2>/dev/null)"
if [ -z "$START_INTERVAL" ]; then
    START_INTERVAL=300
fi
STALE_THRESHOLD=$((START_INTERVAL * 3))

if [ ! -f "$LOG_FILE" ]; then
    echo "Pulse: UNHEALTHY (stale)"
    echo "   $LOG_FILE does not exist"
    exit 1
fi

LOG_MTIME="$(stat -f %m "$LOG_FILE" 2>/dev/null || stat -c %Y "$LOG_FILE" 2>/dev/null)"
NOW="$(date +%s)"
LOG_AGE=$(( NOW - LOG_MTIME ))

if [ "$LOG_AGE" -gt "$STALE_THRESHOLD" ]; then
    echo "Pulse: UNHEALTHY (stale)"
    echo "   $LOG_FILE last modified ${LOG_AGE}s ago (threshold: ${STALE_THRESHOLD}s = 3x StartInterval ${START_INTERVAL}s)"
    exit 1
fi

echo "Pulse: HEALTHY"
echo "Log: $LOG_FILE ($(wc -l < "$LOG_FILE") lines, last modified ${LOG_AGE}s ago)"
exit 0
