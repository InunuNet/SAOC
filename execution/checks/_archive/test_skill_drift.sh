#!/usr/bin/env bash
# Fixture-based discrimination test for F3 (verify_skill_drift.py). Spins up a mock
# Alembic health endpoint under /tmp for the match/mismatch cases, and points at an
# unreachable port for the proxy-down case. Never depends on a real Alembic proxy
# being up. This script IS the contract assertion for F3 — a subcommand exits 0
# only if the check behaved correctly on that fixture.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SELF_DIR/verify_skill_drift.py"
MOCK_SERVER="$SELF_DIR/_mock_alembic_server.py"

MOCK_PID=""
kill_mock() {
  if [ -n "$MOCK_PID" ]; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
    MOCK_PID=""
  fi
}

build_skill() {
    local dir="$1" version="$2"
    rm -rf "$dir"
    mkdir -p "$dir/.agent/skills"
    printf -- '---\nalembic_version: %s\n---\n# Alembic\ncontent\n' "$version" > "$dir/.agent/skills/alembic.md"
}

start_mock() {
    local port="$1" version="$2"
    python3 "$MOCK_SERVER" "$port" "$version" &
    MOCK_PID=$!
    for _ in $(seq 1 30); do
        if curl -s -o /dev/null "http://127.0.0.1:$port/"; then
            return 0
        fi
        sleep 0.1
    done
    echo "FAIL: mock server never came up" >&2
    exit 1
}

assert_exit_code() {
    # assert_exit_code <actual> <expected> <label>
    if [ "$1" != "$2" ]; then
        echo "FAIL: $3 — expected exit $2, got $1" >&2
        exit 1
    fi
}

case "${1:-all}" in
  match)
    fixture_root="$(mktemp -d /tmp/f3-drift-match.XXXXXX)"
    trap 'rm -rf "$fixture_root"; kill_mock' EXIT
    build_skill "$fixture_root/match" "1.68.0"
    start_mock 8771 "1.68.0"
    rc=0
    python3 "$CHECK" --root "$fixture_root/match" --endpoint "http://127.0.0.1:8771/" || rc=$?
    kill_mock
    assert_exit_code "$rc" 0 "matching version must PASS with exit 0"
    echo "PASS: matching version passes with exit 0"
    ;;
  mismatch)
    fixture_root="$(mktemp -d /tmp/f3-drift-mismatch.XXXXXX)"
    err_file="$(mktemp /tmp/f3-mismatch-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"; kill_mock' EXIT
    build_skill "$fixture_root/mismatch" "1.0.0"
    start_mock 8772 "1.68.0"
    rc=0
    python3 "$CHECK" --root "$fixture_root/mismatch" --endpoint "http://127.0.0.1:8772/" 2>"$err_file" || rc=$?
    kill_mock
    assert_exit_code "$rc" 1 "version mismatch must FAIL with exit 1 (not 3 — a real mismatch is not a SKIP)"
    if ! grep -q "audited against Alembic 1.0.0" "$err_file" || ! grep -q "running proxy is 1.68.0" "$err_file"; then
      echo "FAIL: failure message missing the 'audited against' semantic" >&2
      cat "$err_file" >&2
      exit 1
    fi
    echo "PASS: mismatch correctly fails with exit 1 and 'audited against' semantic in the message"
    ;;
  unreachable)
    fixture_root="$(mktemp -d /tmp/f3-drift-unreachable.XXXXXX)"
    err_file="$(mktemp /tmp/f3-unreachable-err.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$err_file"' EXIT
    build_skill "$fixture_root/unreachable" "1.68.0"
    # Port 1 is unassigned/reserved — connection is refused immediately, no daemon needed.
    rc=0
    python3 "$CHECK" --root "$fixture_root/unreachable" --endpoint "http://127.0.0.1:1/" 2>"$err_file" || rc=$?
    assert_exit_code "$rc" 77 "proxy-unreachable (connection refused) must SKIP with exit 77 (Athanor's reserved skip code), not 0 (0 would be indistinguishable from a real PASS) and not 1 (unreachable is not evidence of drift)"
    echo "PASS: proxy-unreachable fixture correctly SKIPs with exit 77, never 0 or 1"
    ;;
  garbled)
    fixture_root="$(mktemp -d /tmp/f3-drift-garbled.XXXXXX)"
    trap 'rm -rf "$fixture_root"; kill_mock' EXIT
    build_skill "$fixture_root/garbled" "1.68.0"
    start_mock 8773 "GARBLED"
    rc=0
    python3 "$CHECK" --root "$fixture_root/garbled" --endpoint "http://127.0.0.1:8773/" || rc=$?
    kill_mock
    assert_exit_code "$rc" 77 "proxy reachable but non-JSON reply must also SKIP with exit 77 (same code as connection-refused — both are 'unknown', distinguished only by message text)"
    echo "PASS: proxy-reachable-but-unusable-reply fixture correctly SKIPs with exit 77"
    ;;
  badflag)
    rc=0
    python3 "$CHECK" --this-flag-does-not-exist 2>/dev/null || rc=$?
    assert_exit_code "$rc" 2 "a bad CLI invocation must exit 2 (argparse default), never remapped into PASS/FAIL/SKIP — a typo'd flag must fail loud"
    echo "PASS: bad invocation correctly exits 2, distinct from PASS/FAIL/SKIP"
    ;;
  all)
    "$SELF_DIR/test_skill_drift.sh" match
    "$SELF_DIR/test_skill_drift.sh" mismatch
    "$SELF_DIR/test_skill_drift.sh" unreachable
    "$SELF_DIR/test_skill_drift.sh" garbled
    "$SELF_DIR/test_skill_drift.sh" badflag
    ;;
  *)
    echo "usage: $0 {match|mismatch|unreachable|garbled|badflag|all}" >&2
    exit 2
    ;;
esac
