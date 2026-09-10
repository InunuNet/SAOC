#!/usr/bin/env bash
# verify_f1_quota_oracle.sh -- sandboxed behavioral + static scenarios for
# mission quota-aware-execution F1 (project-local quota oracle).
#
# Defect under test: the harness already DISPLAYS quota via
# execution/hooks/inject_pressure.sh (reads ~/.claude/MEMORY/STATE/usage-cache.json,
# injects a `[quota: Y% | refresh: Zh]` string into chat) but nothing writes
# that signal anywhere scriptable, and no script exists to read it. Fix under
# test must add TWO things:
#   1. execution/quota.py with a `status [--json] [--mirror-path PATH]`
#      subcommand that reads ONLY a project-local mirror file
#      (default .agent/memory/scratch/.quota_status.json) -- NEVER
#      ~/.claude directly -- and reports state=ok|unknown, degrading to
#      unknown (never fabricating a number) when the mirror is missing,
#      stale (captured_at older than 900s), or malformed.
#   2. execution/hooks/inject_pressure.sh extended to ALSO write that mirror
#      on every UserPromptSubmit turn, honoring ATHANOR_QUOTA_CACHE_OVERRIDE
#      (source cache path override, for reproducible testing without a second
#      global-path reader) and ATHANOR_QUOTA_MIRROR_OVERRIDE (output mirror
#      path override, so tests never write into the real project scratch dir),
#      and must never abort the turn or emit invalid JSON even if the mirror
#      write fails.
#
# All fixtures live under a mktemp sandbox (honors $TMPDIR). Never touches
# ~/.claude, never touches the real .agent/memory/scratch/.quota_status.json,
# never depends on the real machine's live quota values.
#
# Usage: verify_f1_quota_oracle.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"
SANDBOX="$(mktemp -d)"
cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT

QUOTA_PY="execution/quota.py"
HOOK="execution/hooks/inject_pressure.sh"

now_iso() { python3 -c 'import datetime;print(datetime.datetime.now(datetime.timezone.utc).isoformat())'; }
minus_iso() { python3 -c "import datetime,sys;print((datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=int(sys.argv[1]))).isoformat())" "$1"; }

write_mirror() {
    # write_mirror PATH USED_PCT RESETS_AT CAPTURED_AT
    local path="$1" used="$2" resets="$3" captured="$4"
    cat > "$path" <<JSON
{"used_pct": ${used}, "resets_at": "${resets}", "seconds_to_reset": 3600.0, "captured_at": "${captured}"}
JSON
}

case "$CASE" in

  fresh_mirror_reports_ok)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    MIRROR="$SANDBOX/.quota_status.json"
    write_mirror "$MIRROR" 42 "$(now_iso)" "$(now_iso)"
    set +e
    OUT="$(python3 "$QUOTA_PY" status --json --mirror-path "$MIRROR" 2>&1)"
    EXIT_CODE=$?
    set -e
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: exit=$EXIT_CODE (expected 0)"; exit 1; }
    echo "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('state') == 'ok', d
assert d.get('used_pct') == 42, d
assert 'used_pct' in d
print('OK')
" || { echo "FAIL: json shape/state wrong"; exit 1; }
    exit 0
    ;;

  missing_mirror_reports_unknown)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    MIRROR="$SANDBOX/.does_not_exist.json"
    set +e
    OUT="$(python3 "$QUOTA_PY" status --json --mirror-path "$MIRROR" 2>&1)"
    EXIT_CODE=$?
    set -e
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: exit=$EXIT_CODE (expected 0, must fail open)"; exit 1; }
    echo "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('state') == 'unknown', d
assert d.get('reason') == 'missing_mirror', d
assert d.get('used_pct') is None, d
print('OK')
" || { echo "FAIL: expected state=unknown reason=missing_mirror used_pct=null"; exit 1; }
    exit 0
    ;;

  stale_mirror_reports_unknown)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    MIRROR="$SANDBOX/.quota_status.json"
    write_mirror "$MIRROR" 10 "$(now_iso)" "$(minus_iso 1200)"
    set +e
    OUT="$(python3 "$QUOTA_PY" status --json --mirror-path "$MIRROR" 2>&1)"
    EXIT_CODE=$?
    set -e
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: exit=$EXIT_CODE (expected 0)"; exit 1; }
    echo "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('state') == 'unknown', d
assert d.get('reason') == 'stale', d
print('OK')
" || { echo "FAIL: expected state=unknown reason=stale for a 20-minute-old mirror"; exit 1; }
    exit 0
    ;;

  malformed_mirror_reports_unknown)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    MIRROR="$SANDBOX/.quota_status.json"
    printf 'not valid json {{{' > "$MIRROR"
    set +e
    OUT="$(python3 "$QUOTA_PY" status --json --mirror-path "$MIRROR" 2>&1)"
    EXIT_CODE=$?
    set -e
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: exit=$EXIT_CODE (expected 0, no crash/traceback on malformed input)"; exit 1; }
    echo "$OUT" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('state') == 'unknown', d
assert d.get('reason') == 'malformed', d
print('OK')
" || { echo "FAIL: expected clean state=unknown reason=malformed, got: $OUT"; exit 1; }
    exit 0
    ;;

  no_global_read_static)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    if grep -Eq '(HOME.*\.claude|usage-cache\.json|MEMORY/STATE)' "$QUOTA_PY"; then
        echo "FAIL: $QUOTA_PY references the global ~/.claude cache path -- it must be a second global-path reader-free script, mirror-only"
        exit 1
    fi
    echo "OK: no global-path reference found in $QUOTA_PY"
    exit 0
    ;;

  used_pct_field_naming_static)
    [ -f "$QUOTA_PY" ] || { echo "FAIL: $QUOTA_PY missing"; exit 1; }
    grep -q '"used_pct"' "$QUOTA_PY" || grep -q "'used_pct'" "$QUOTA_PY" || {
        echo "FAIL: $QUOTA_PY does not emit a used_pct field -- rules.md flags the reversed-convention risk (Y% is percent USED); field name must be unambiguous"
        exit 1
    }
    if grep -Eq '"(quota_pct|remaining_pct)"' "$QUOTA_PY"; then
        echo "FAIL: $QUOTA_PY emits an ambiguous field name (quota_pct/remaining_pct) alongside or instead of used_pct"
        exit 1
    fi
    echo "OK: used_pct present, no ambiguous alias field"
    exit 0
    ;;

  hook_writes_mirror_on_turn)
    [ -x "$HOOK" ] || [ -f "$HOOK" ] || { echo "FAIL: $HOOK missing"; exit 1; }
    FAKE_CACHE="$SANDBOX/usage-cache.json"
    FAKE_MIRROR="$SANDBOX/.quota_status.json"
    cat > "$FAKE_CACHE" <<JSON
{"five_hour": {"utilization": 37, "resets_at": "$(now_iso)"}}
JSON
    FAKE_TRANSCRIPT="$SANDBOX/transcript.jsonl"
    echo '{}' > "$FAKE_TRANSCRIPT"
    set +e
    OUT="$(echo "{\"transcript_path\": \"$FAKE_TRANSCRIPT\"}" | \
        ATHANOR_QUOTA_CACHE_OVERRIDE="$FAKE_CACHE" \
        ATHANOR_QUOTA_MIRROR_OVERRIDE="$FAKE_MIRROR" \
        timeout 10 bash "$HOOK" 2>&1)"
    EXIT_CODE=$?
    set -e
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: hook exit=$EXIT_CODE (must always exit 0)"; exit 1; }
    [ -f "$FAKE_MIRROR" ] || { echo "FAIL: hook did not write mirror file at ATHANOR_QUOTA_MIRROR_OVERRIDE path"; exit 1; }
    python3 -c "
import json
d = json.load(open('$FAKE_MIRROR'))
for k in ('used_pct','resets_at','seconds_to_reset','captured_at'):
    assert k in d, f'missing field {k}: {d}'
assert d['used_pct'] == 37, d
print('OK')
" || { echo "FAIL: mirror file missing required fields or wrong used_pct"; exit 1; }
    exit 0
    ;;

  hook_degrades_when_mirror_write_fails)
    # Non-regression / safety-net case: this may legitimately PASS
    # pre-fix-by-coincidence, since a hook that never attempts to write a
    # mirror also can't fail to write one. It is retained to lock in the
    # post-fix degrade-silently guarantee, not as the falsifiable core of F1.
    [ -x "$HOOK" ] || [ -f "$HOOK" ] || { echo "FAIL: $HOOK missing"; exit 1; }
    FAKE_CACHE="$SANDBOX/usage-cache.json"
    cat > "$FAKE_CACHE" <<JSON
{"five_hour": {"utilization": 12, "resets_at": "$(now_iso)"}}
JSON
    UNWRITABLE_DIR="$SANDBOX/unwritable"
    mkdir -p "$UNWRITABLE_DIR"
    chmod 500 "$UNWRITABLE_DIR"
    FAKE_MIRROR="$UNWRITABLE_DIR/nested/.quota_status.json"
    FAKE_TRANSCRIPT="$SANDBOX/transcript.jsonl"
    echo '{}' > "$FAKE_TRANSCRIPT"
    set +e
    OUT="$(echo "{\"transcript_path\": \"$FAKE_TRANSCRIPT\"}" | \
        ATHANOR_QUOTA_CACHE_OVERRIDE="$FAKE_CACHE" \
        ATHANOR_QUOTA_MIRROR_OVERRIDE="$FAKE_MIRROR" \
        timeout 10 bash "$HOOK" 2>&1)"
    EXIT_CODE=$?
    set -e
    chmod 700 "$UNWRITABLE_DIR"
    echo "$OUT"
    [ "$EXIT_CODE" -eq 0 ] || { echo "FAIL: hook exit=$EXIT_CODE when mirror write target is unwritable (must always exit 0)"; exit 1; }
    echo "$OUT" | python3 -c "
import json,sys
d = json.loads(sys.stdin.read())
assert 'hookSpecificOutput' in d, d
print('OK')
" || { echo "FAIL: hook did not emit valid additionalContext JSON when mirror write failed"; exit 1; }
    exit 0
    ;;

  *)
    echo "Usage: $0 <fresh_mirror_reports_ok|missing_mirror_reports_unknown|stale_mirror_reports_unknown|malformed_mirror_reports_unknown|no_global_read_static|used_pct_field_naming_static|hook_writes_mirror_on_turn|hook_degrades_when_mirror_write_fails>"
    exit 2
    ;;
esac
