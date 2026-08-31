#!/usr/bin/env bash
# bump_version.sh — Increment the harness semver and dual-write to both version files.
# Usage: bash execution/bump_version.sh [--minor | --major]
# Exits: 0 on success, 2 on semver validation failure.

set -uo pipefail

CANON=".agent/version"
TPL="template/.agent/version"

# Provenance for the .agent/.template_state write below (delivery-integrity
# F4b). Obtained from update_template.py rather than recomputed here: it is the
# other writer of that file, and two writers computing workspace identity two
# ways is precisely the drift that would turn a local bump into a stamp the
# updater reads as foreign. Resolved relative to THIS script so it works from
# any cwd. Degrades to empty on any failure — a bump must never fail over
# bookkeeping — in which case the stamp is written without identity and simply
# reads as not-from-here until the next --apply restamps it.
_BUMP_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_IDENTITY_JSON="$(python3 "$_BUMP_SELF_DIR/update_template.py" --print-workspace-identity 2>/dev/null || echo '{}')"

# --- parse flags ---
BUMP="patch"
for arg in "$@"; do
    case "$arg" in
        --minor) BUMP="minor" ;;
        --major) BUMP="major" ;;
        *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
done

# --- read and validate current version ---
if [ ! -f "$CANON" ]; then
    echo "ERROR: $CANON not found" >&2
    exit 2
fi
if [ ! -f "$TPL" ]; then
    echo "ERROR: $TPL not found" >&2
    exit 2
fi

OLD="$(tr -d '[:space:]' < "$CANON")"

if ! echo "$OLD" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: '$OLD' is not valid semver (expected MAJOR.MINOR.PATCH)" >&2
    exit 2
fi

MAJOR="$(echo "$OLD" | cut -d. -f1)"
MINOR="$(echo "$OLD" | cut -d. -f2)"
PATCH="$(echo "$OLD" | cut -d. -f3)"

# --- compute new version ---
case "$BUMP" in
    patch)
        PATCH=$((PATCH + 1))
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
esac

NEW="${MAJOR}.${MINOR}.${PATCH}"

# --- dual-write ---
printf '%s\n' "$NEW" > "$CANON"
printf '%s\n' "$NEW" > "$TPL"

echo "${OLD} -> ${NEW}"

# --- reconcile bookkeeping (.agent/.template_state, .agent/profile.json) ---
# Mirrors write_template_state()/update_profile_version() in update_template.py:
# same applied_at format, same symlink refusal, same key-preserving profile.json
# rewrite. Athanor never runs update_template.py --apply against itself (it is
# the template source), so these two files would otherwise drift forever and
# full_boot.sh would keep printing a false "HARNESS UPDATE AVAILABLE" banner.
# Degrades gracefully: never fails the bump on missing/unparseable bookkeeping.
python3 - "$NEW" "$WORKSPACE_IDENTITY_JSON" <<'PYEOF' || true
import json
import sys
import time
from pathlib import Path

new_version = sys.argv[1]
try:
    identity = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    if not isinstance(identity, dict):
        identity = {}
except Exception:
    identity = {}
state_path = Path(".agent/.template_state")
profile_path = Path(".agent/profile.json")


def warn(msg):
    print("WARN: %s" % msg, file=sys.stderr)


# --- .agent/.template_state ---
try:
    if state_path.is_symlink():
        warn(".agent/.template_state is a symlink — refusing to write through it, "
             "skipping .template_state reconciliation")
    elif state_path.is_dir():
        warn(".agent/.template_state is a directory — skipping .template_state reconciliation")
    else:
        write_state = True
        if state_path.exists():
            try:
                json.loads(state_path.read_text())
            except Exception:
                warn(".agent/.template_state is not valid JSON — skipping "
                     ".template_state reconciliation")
                write_state = False
        if write_state:
            applied_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            state_path.parent.mkdir(parents=True, exist_ok=True)
            state_record = {"template_version": new_version, "applied_at": applied_at}
            state_record.update(identity)
            state_path.write_text(
                json.dumps(state_record, indent=2) + "\n"
            )
except Exception as exc:
    warn(".agent/.template_state reconciliation failed unexpectedly: %s" % exc)

# --- .agent/profile.json ---
try:
    if profile_path.is_symlink():
        warn(".agent/profile.json is a symlink — refusing to write through it, "
             "skipping profile.json reconciliation")
    elif profile_path.exists():
        profile = None
        try:
            profile = json.loads(profile_path.read_text())
        except Exception:
            warn(".agent/profile.json is not valid JSON — skipping profile.json "
                 "reconciliation")
        if profile is not None:
            profile["template_version"] = new_version
            profile_path.write_text(json.dumps(profile, indent=2) + "\n")
    # else: profile.json absent — nothing to reconcile, not an error.
except Exception as exc:
    warn(".agent/profile.json reconciliation failed unexpectedly: %s" % exc)
PYEOF
