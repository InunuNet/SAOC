#!/usr/bin/env bash
# derive_pulse_label.sh — pulse-scoped-health F1: the SINGLE place a pulse
# launchd label is computed from a project's own identity. Both
# install-pulse (Makefile) and get_pulse_status.sh (F2) MUST call this
# script rather than reimplementing the derivation independently — two
# independently maintained decision paths is the exact root-cause class
# that let this incident happen (see template-update-actually-updates F10).
#
# Usage: derive_pulse_label.sh <project_root> [--heartbeat]
#   project_root  path to the project root (its .agent/profile.json is read)
#   --heartbeat   if given, print the heartbeat variant of the label
#
# Prints one line to stdout: "com.athanor.pulse.<slug>", or
# "com.athanor.pulse.heartbeat.<slug>" with --heartbeat. Pure and
# side-effect-free — never writes anything, never touches launchd.
set -euo pipefail

PROJECT_ROOT="${1:?usage: derive_pulse_label.sh <project_root> [--heartbeat]}"
HEARTBEAT_INFIX=""
if [ "${2:-}" = "--heartbeat" ]; then
    HEARTBEAT_INFIX="heartbeat."
fi

PROFILE_JSON="$PROJECT_ROOT/.agent/profile.json"

# Missing file, missing key, null value, or unparseable JSON all degrade
# identically to "no name recorded" -- jq's own `// empty` already
# collapses the missing-key/null cases; `2>/dev/null || true` additionally
# absorbs a missing/unparseable file (jq exit != 0) rather than aborting
# under `set -e`, since none of these four cases should ever block
# installation.
PROJECT_NAME=""
if [ -f "$PROFILE_JSON" ]; then
    PROJECT_NAME=$(jq -r '.project_name // empty' "$PROFILE_JSON" 2>/dev/null || true)
fi

if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME=$(basename "$PROJECT_ROOT")
fi

# Slugify: lowercase; every run of non-[a-z0-9] characters collapses to a
# single '-'; strip leading/trailing '-'. Must be launchd-label-safe,
# plist-XML-safe, and safe as a sed replacement token (no '|', the
# delimiter install-pulse's existing sed commands already use).
SLUG=$(printf '%s' "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')

if [ -z "$SLUG" ]; then
    SLUG="unnamed"
fi

echo "com.athanor.pulse.${HEARTBEAT_INFIX}${SLUG}"
