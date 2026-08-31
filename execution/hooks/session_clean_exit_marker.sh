#!/usr/bin/env bash
# session_clean_exit_marker.sh — SessionEnd command hook
# Records "a clean session exit happened at time T", consulted by
# full_boot.sh to distinguish a proactive quota-checkpoint (session lived
# on and exited cleanly) from a genuine crash (checkpoint written, no
# subsequent clean exit). Never fatal.
set -uo pipefail
MARKER="${ATHANOR_SESSION_CLEAN_EXIT_MARKER_PATH:-.agent/memory/scratch/.session_clean_exit_at}"
mkdir -p "$(dirname "$MARKER")" 2>/dev/null || exit 0
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MARKER_TMP="${MARKER}.tmp.$$"
printf '%s\n' "$TS" > "$MARKER_TMP" 2>/dev/null \
  && mv -f "$MARKER_TMP" "$MARKER" 2>/dev/null \
  || { rm -f "$MARKER_TMP" 2>/dev/null; exit 0; }
exit 0
