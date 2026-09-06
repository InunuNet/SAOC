#!/usr/bin/env bash
# bump_version.sh — Increment the harness semver and dual-write to both version files.
# HARNESS CHECKOUT ONLY: in a downstream workspace this is a no-op that writes
# nothing, because every record it touches is upstream-owned (see the role gate
# below). Usage: bash execution/bump_version.sh [--minor | --major]
# Exits: 0 on success, 0 (no-op) in a downstream workspace, 1 on an unknown
# flag, 2 on semver validation failure.

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

# Which role is this workspace in? Every record this script writes is
# UPSTREAM-OWNED: .agent/version and template/.agent/version name the harness
# release installed here, and .agent/.template_state.template_version is a
# receipt for what upstream last DELIVERED here — the record
# update_template.py's version-regression guard refuses payloads against. A
# downstream workspace that moves them from a local wrap-up ratchets its own
# receipt above anything upstream ships and then permanently refuses every
# future update (version-stamp-provenance-split F32; SAOC locked at 3.7.156, a
# version that never existed upstream).
#
# The answer comes from update_template.py for the same reason the identity
# above does: it is the other writer of these records, and the population
# allowed to bump them must be EXACTLY the population `--apply` refuses to
# serve. Two predicates would drift, and the drift is the ratchet.
#
# Fails CLOSED — anything but a clean "harness" is treated as downstream. A
# bump that did not happen is recoverable; a delivery receipt that should not
# have moved is not.
WORKSPACE_ROLE="$(python3 "$_BUMP_SELF_DIR/update_template.py" --print-workspace-role 2>/dev/null || true)"
case "$WORKSPACE_ROLE" in
    harness) ;;
    *) WORKSPACE_ROLE="downstream" ;;
esac

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

# --- harness-only gate ---
# Placed AFTER every validation and BEFORE the first write, so both roles share
# one set of error paths byte for byte: an unknown flag still exits 1, a missing
# or non-semver version file still exits 2, and a downstream is refused the
# WRITES only. Exit 0 on the skip — a mission wrap-up must not fail over
# bookkeeping it should never have been doing, the same posture as the graceful
# degradation below.
if [ "$WORKSPACE_ROLE" != "harness" ]; then
    echo "bump_version.sh: skipped, nothing written — .agent/version and .agent/.template_state record what UPSTREAM delivered here, not how many missions closed here, and this is a downstream workspace (role from 'update_template.py --print-workspace-role'; would have bumped ${OLD} to ${NEW}). Only 'update_template.py --apply' moves them."
    exit 0
fi

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
