#!/usr/bin/env bash
# verify_f2_scratch_purge_exempt.sh — assertions A1-A3 for
# .agent/memory/project/specs/quota-mirror-partial-write/contract-f2.yaml
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BRAIN_PY="$REPO_ROOT/execution/brain.py"

_tmpdir=""
_cleanup() { [ -n "$_tmpdir" ] && rm -rf "$_tmpdir"; }
trap _cleanup EXIT

_setup_fixture_repo() {
  _tmpdir="$(mktemp -d /tmp/f2-scratch-purge.XXXXXX)"
  mkdir -p "$_tmpdir/.agent/memory/scratch"
  mkdir -p "$_tmpdir/.agent/memory/project/missions"
  mkdir -p "$_tmpdir/.agent/memory/project/handoff"
  mkdir -p "$_tmpdir/.agent/memory/brain"
  touch "$_tmpdir/.agent/memory/scratch/.keep"
  echo '{"used_pct": 42, "resets_at": null, "seconds_to_reset": null, "captured_at": "2026-08-21T19:56:04.192322+00:00"}' \
    > "$_tmpdir/.agent/memory/scratch/.quota_status.json"
  echo 'not exempt' > "$_tmpdir/.agent/memory/scratch/some_other_file.tmp"
}

case "${1:-}" in

mirror_survives_wrapup_others_purged)
  _setup_fixture_repo
  before_hash="$(shasum -a 256 "$_tmpdir/.agent/memory/scratch/.quota_status.json" | awk '{print $1}')"
  ( cd "$_tmpdir" && PYTHONPATH="$REPO_ROOT/execution" python3 -c "
import sys
sys.path.insert(0, '$REPO_ROOT/execution')
import brain
brain.wrap_up('f2 test wrap-up', tags='test')
" ) >/dev/null 2>&1
  if [ ! -f "$_tmpdir/.agent/memory/scratch/.quota_status.json" ]; then
    echo "FAIL: .quota_status.json was deleted by wrap_up()"; exit 1
  fi
  after_hash="$(shasum -a 256 "$_tmpdir/.agent/memory/scratch/.quota_status.json" | awk '{print $1}')"
  if [ "$before_hash" != "$after_hash" ]; then
    echo "FAIL: .quota_status.json content changed"; exit 1
  fi
  if [ -f "$_tmpdir/.agent/memory/scratch/some_other_file.tmp" ]; then
    echo "FAIL: non-exempt fixture file was NOT purged"; exit 1
  fi
  echo "PASS: mirror_survives_wrapup_others_purged"
  ;;

mirror_survives_wrapup_force)
  _setup_fixture_repo
  before_hash="$(shasum -a 256 "$_tmpdir/.agent/memory/scratch/.quota_status.json" | awk '{print $1}')"
  ( cd "$_tmpdir" && python3 -c "
import sys
sys.path.insert(0, '$REPO_ROOT/execution')
import brain
brain.wrap_up('f2 test wrap-up force', tags='test', force=True)
" ) >/dev/null 2>&1
  if [ ! -f "$_tmpdir/.agent/memory/scratch/.quota_status.json" ]; then
    echo "FAIL: .quota_status.json was deleted by wrap_up(force=True)"; exit 1
  fi
  after_hash="$(shasum -a 256 "$_tmpdir/.agent/memory/scratch/.quota_status.json" | awk '{print $1}')"
  if [ "$before_hash" != "$after_hash" ]; then
    echo "FAIL: .quota_status.json content changed under force=True"; exit 1
  fi
  if [ -f "$_tmpdir/.agent/memory/scratch/some_other_file.tmp" ]; then
    echo "FAIL: non-exempt fixture file was NOT purged under force=True"; exit 1
  fi
  echo "PASS: mirror_survives_wrapup_force"
  ;;

*)
  echo "usage: $0 {mirror_survives_wrapup_others_purged|mirror_survives_wrapup_force}" >&2
  exit 2
  ;;
esac
