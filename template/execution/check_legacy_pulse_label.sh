#!/usr/bin/env bash
# check_legacy_pulse_label.sh — pulse-scoped-health F3, FINDING 1:
# read-only visibility into the two PRE-F1 unscoped launchd labels
# ("com.athanor.pulse", "com.athanor.pulse.heartbeat"). Detect and
# report ONLY -- doctrine established by this mission's own history
# (learned.md 2026-08-16: a hijacked slot was found and deliberately
# NOT reclaimed). This script NEVER calls launchctl load/unload/start/
# stop/kickstart, and never judges whether the registered owner is this
# project or a foreign one -- it reports either way.
#
# Usage: check_legacy_pulse_label.sh <project_root>
#
# For each of the two legacy labels that IS registered, prints one line
# naming the label and its registered working directory. Prints nothing
# for a label that is not registered. Exits 0 UNCONDITIONALLY --
# informational only; must never cause a caller to abort or change its
# own exit code because of what this script finds.
set -uo pipefail

PROJECT_ROOT="${1:?usage: check_legacy_pulse_label.sh <project_root>}"
UID_NUM="$(id -u)"

for LABEL in com.athanor.pulse com.athanor.pulse.heartbeat; do
    OUTPUT="$(launchctl print "gui/$UID_NUM/$LABEL" 2>&1)"
    RC=$?
    if [ "$RC" -eq 113 ]; then
        # Genuinely not registered -- nothing to report for this label.
        continue
    fi
    if [ "$RC" -ne 0 ]; then
        # Ambiguous failure (not 113) -- do NOT silently treat as absent.
        # Report it so a caller folding this output in (get_pulse_status.sh)
        # surfaces the ambiguity instead of showing a clean not-installed.
        echo "WARNING: label=$LABEL launchctl print exited $RC (ambiguous -- not confirmed absent, expected 113 for not-registered)"
        continue
    fi
    WORKDIR="$(printf '%s\n' "$OUTPUT" | awk -F'= ' '/^[ \t]*working directory = /{ print $2; exit }')"
    echo "Legacy job detected: label=$LABEL working_directory=${WORKDIR:-<unknown>}"
done

exit 0
