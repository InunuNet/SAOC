#!/usr/bin/env bash
# check_pulse_label_collision.sh — pulse-scoped-health F3, FINDING 2:
# detect-and-refuse a derived-label collision at install time.
# derive_pulse_label.sh's slugification (F1) is lossy by design --
# distinct project_name strings ("My Project", "my-project",
# "My_Project!!", "MY   PROJECT") can derive the identical label. This
# script closes that gap by checking whether the CANDIDATE label for
# <project_root> already belongs to a DIFFERENT project before install
# writes over it.
#
# Usage: check_pulse_label_collision.sh <project_root> [--heartbeat]
#
# Reuses execution/derive_pulse_label.sh (F1) for the candidate label --
# does not reimplement slugification. READ-ONLY: only ever calls
# `launchctl print`, never load/unload/start/stop/kickstart.
#
# Exit 0: the candidate label is not registered at all, OR it is
#         registered to THIS project's own real working directory (a
#         safe reinstall/upgrade -- must stay idempotent).
# Exit nonzero: the candidate label is registered to a DIFFERENT
#         project's working directory -- refuse, name the foreign
#         owner. install-pulse's Makefile recipe calls this UNGUARDED
#         so Make's own abort-on-nonzero blocks the whole install.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${1:?usage: check_pulse_label_collision.sh <project_root> [--heartbeat]}"
HEARTBEAT_FLAG="${2:-}"

REAL_PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd -P)"

if [ "$HEARTBEAT_FLAG" = "--heartbeat" ]; then
    CANDIDATE_LABEL="$(bash "$SCRIPT_DIR/derive_pulse_label.sh" "$PROJECT_ROOT" --heartbeat)"
else
    CANDIDATE_LABEL="$(bash "$SCRIPT_DIR/derive_pulse_label.sh" "$PROJECT_ROOT")"
fi

UID_NUM="$(id -u)"

OUTPUT="$(launchctl print "gui/$UID_NUM/$CANDIDATE_LABEL" 2>&1)"
RC=$?

if [ "$RC" -ne 0 ]; then
    # Not registered at all -- no collision.
    exit 0
fi

REGISTERED_WORKDIR="$(printf '%s\n' "$OUTPUT" | awk -F'= ' '/^[ \t]*working directory = /{ print $2; exit }')"

if [ "$REGISTERED_WORKDIR" = "$REAL_PROJECT_ROOT" ]; then
    # This IS this project's own already-installed job -- a safe
    # reinstall/upgrade, not a collision.
    exit 0
fi

echo "REFUSE: label '$CANDIDATE_LABEL' is already registered to a DIFFERENT project (working directory: ${REGISTERED_WORKDIR:-<unknown>}) -- refusing to install over it." >&2
echo "   Rename project_name in .agent/profile.json to derive a distinct label, or resolve the collision manually." >&2
exit 1
