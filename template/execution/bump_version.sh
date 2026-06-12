#!/usr/bin/env bash
# bump_version.sh — Increment the harness semver and dual-write to both version files.
# Usage: bash execution/bump_version.sh [--minor | --major]
# Exits: 0 on success, 2 on semver validation failure.

set -uo pipefail

CANON=".agent/version"
TPL="template/.agent/version"

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
