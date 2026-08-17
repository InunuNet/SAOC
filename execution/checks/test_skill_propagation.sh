#!/usr/bin/env bash
# Fixture-based discrimination test for F2 (verify_skill_propagation.py). Builds
# throwaway installs under /tmp, runs the check against each, and asserts the check
# produces the expected verdict. Never touches the real repo tree. This script IS
# the contract assertion for F2 — a subcommand exits 0 only if the check behaved
# correctly on that fixture (not merely if the fixture happened to exist).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SELF_DIR/verify_skill_propagation.py"

build_synced() {
    local dir="$1"
    rm -rf "$dir"
    mkdir -p "$dir/.agent/skills" "$dir/.claude/skills" "$dir/.gemini/skills"
    printf -- '---\nalembic_version: 1.68.0\n---\n# Alembic\ncanonical content\n' > "$dir/.agent/skills/alembic.md"
    cp "$dir/.agent/skills/alembic.md" "$dir/.claude/skills/alembic.md"
    cp "$dir/.agent/skills/alembic.md" "$dir/.gemini/skills/alembic.md"
}

build_patched() {
    local dir="$1"
    build_synced "$dir"
    printf -- '---\nalembic_version: 1.68.0\n---\n# Alembic\nHAND-PATCHED, diverged from canonical\n' > "$dir/.claude/skills/alembic.md"
}

build_missing() {
    local dir="$1"
    build_synced "$dir"
    rm -f "$dir/.gemini/skills/alembic.md"
}

case "${1:-all}" in
  synced)
    fixture_root="$(mktemp -d /tmp/f2-propagation-synced.XXXXXX)"
    trap 'rm -rf "$fixture_root"' EXIT
    build_synced "$fixture_root/synced"
    python3 "$CHECK" --root "$fixture_root/synced"
    echo "PASS: fully-synced fixture correctly passes"
    ;;
  patched)
    fixture_root="$(mktemp -d /tmp/f2-propagation-patched.XXXXXX)"
    err_file="$(mktemp /tmp/f2-patched-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    build_patched "$fixture_root/patched"
    if python3 "$CHECK" --root "$fixture_root/patched" 2>"$err_file"; then
      echo "FAIL: hand-patched fixture should have failed but passed" >&2
      cat "$err_file" >&2
      exit 1
    fi
    if ! grep -q "$fixture_root/patched/.claude/skills/alembic.md" "$err_file"; then
      echo "FAIL: failure output did not name the stale path" >&2
      cat "$err_file" >&2
      exit 1
    fi
    echo "PASS: hand-patched fixture correctly fails, naming the stale path"
    ;;
  missing)
    fixture_root="$(mktemp -d /tmp/f2-propagation-missing.XXXXXX)"
    err_file="$(mktemp /tmp/f2-missing-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    build_missing "$fixture_root/missing"
    if python3 "$CHECK" --root "$fixture_root/missing" 2>"$err_file"; then
      echo "FAIL: missing-copy fixture should have failed but passed" >&2
      cat "$err_file" >&2
      exit 1
    fi
    if ! grep -q "$fixture_root/missing/.gemini/skills/alembic.md" "$err_file"; then
      echo "FAIL: failure output did not name the missing path" >&2
      cat "$err_file" >&2
      exit 1
    fi
    echo "PASS: missing-copy fixture correctly fails, naming the missing path"
    ;;
  all)
    "$SELF_DIR/test_skill_propagation.sh" synced
    "$SELF_DIR/test_skill_propagation.sh" patched
    "$SELF_DIR/test_skill_propagation.sh" missing
    ;;
  *)
    echo "usage: $0 {synced|patched|missing|all}" >&2
    exit 2
    ;;
esac
