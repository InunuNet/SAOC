#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [ "$expected" != "$actual" ]; then
    fail "$label: expected '$expected', got '$actual'"
  fi
}

assert_no_file() {
  local path="$1"
  local label="$2"
  [ ! -e "$path" ] || fail "$label: unexpected file exists at $path"
}

write_json_array() {
  local count="$1"
  local out="["
  local i
  for i in $(seq 1 "$count"); do
    [ "$i" -eq 1 ] || out="$out,"
    out="$out{\"number\":$((1200 + i)),\"title\":\"Autofix guardrail fixture $i\"}"
  done
  printf '%s]\n' "$out"
}

make_cli_stubs() {
  local bin="$1"
  mkdir -p "$bin"

  cat > "$bin/claude" <<'STUB'
#!/usr/bin/env bash
printf 'claude %s\n' "$*" >> "$AUTOFIX_STUB_LOG"
exit 0
STUB

  cat > "$bin/gemini" <<'STUB'
#!/usr/bin/env bash
printf 'gemini %s\n' "$*" >> "$AUTOFIX_STUB_LOG"
exit 0
STUB

  cat > "$bin/gh" <<'STUB'
#!/usr/bin/env bash
count="${AUTOFIX_GH_ISSUE_COUNT:-3}"
out="["
i=1
while [ "$i" -le "$count" ]; do
  [ "$i" -eq 1 ] || out="$out,"
  n=$((1200 + i))
  out="$out{\"number\":$n,\"title\":\"Autofix guardrail fixture $i\"}"
  i=$((i + 1))
done
printf '%s]\n' "$out"
exit 0
STUB

  chmod +x "$bin/claude" "$bin/gemini" "$bin/gh"
}

copy_harness_fixture() {
  local work="$1"
  local script_dir="$work/.agent/pulse/registry"
  mkdir -p "$script_dir" "$work/.agent/pulse/registry/processing" \
    "$work/.agent/pulse/registry/completed/friction" "$work/comms/codex" \
    "$work/comms/codex/.agent/memory/project/missions" \
    "$work/comms/gemini" "$work/comms/gemini/.agent/memory/project/missions" \
    "$work/comms/anti" "$work/comms/alembic" \
    "$work/comms/saoc/.agent/memory/project" \
    "$work/comms/mlilo/.agent/memory/project"

  cat > "$work/.agent/profile.json" <<'JSON'
{"project_name":"Athanor","autonomy":{"level":"off"}}
JSON
  cat > "$work/comms/codex/.agent/memory/project/missions/active.json" <<'JSON'
{"mission":"fixture-active.md"}
JSON
  cat > "$work/comms/gemini/.agent/memory/project/missions/active.json" <<'JSON'
{"mission":"fixture-active.md"}
JSON
  printf 'queued-one\nqueued-two\nqueued-three\n' > "$work/comms/codex/.agent/mission_queue.txt"
  printf 'queued-one\nqueued-two\nqueued-three\n' > "$work/comms/gemini/.agent/mission_queue.txt"

  cp "$ROOT/.agent/pulse/registry/watch_comms.sh" "$script_dir/watch_comms.sh"
  cp "$ROOT/.agent/pulse/registry/orchestrate.sh" "$script_dir/orchestrate.sh"
  cp "$ROOT/.agent/pulse/registry/auto_fix_issues.sh" "$script_dir/auto_fix_issues.sh"

  python3 - "$work" <<'PY'
import pathlib
import sys

work = pathlib.Path(sys.argv[1])
replacements = {
    "/Users/vetus/ai/Codex Harness/comms.md": str(work / "comms/codex/comms.md"),
    "/Users/vetus/ai/Gemini Harness/comms.md": str(work / "comms/gemini/comms.md"),
    "/Users/vetus/ai/Anti Harness/comms.md": str(work / "comms/anti/comms.md"),
    "/Users/vetus/ai/Alembic/comms.md": str(work / "comms/alembic/comms.md"),
    "/Users/vetus/ai/SAOC/.agent/memory/project/comms.md": str(work / "comms/saoc/.agent/memory/project/comms.md"),
    "/Users/vetus/ai/Mlilo Savant/.agent/memory/project/comms.md": str(work / "comms/mlilo/.agent/memory/project/comms.md"),
    "/Users/vetus/ai/Codex Harness:codex:DEX": f"{work / 'comms/codex'}:codex:DEX",
    "/Users/vetus/ai/Gemini Harness:gemini:GEMENA": f"{work / 'comms/gemini'}:gemini:GEMENA",
}

for name in ("watch_comms.sh", "orchestrate.sh"):
    path = work / ".agent/pulse/registry" / name
    text = path.read_text()
    for old, new in replacements.items():
        text = text.replace(old, new)
    path.write_text(text)
PY

  chmod +x "$script_dir/"*.sh
}

dispatch_count() {
  local log="$1"
  grep -E '^(claude|gemini) ' "$log" 2>/dev/null | wc -l | tr -d ' '
}

lock_count() {
  local work="$1"
  find "$work/.agent/pulse/registry/processing" -type f 2>/dev/null | wc -l | tr -d ' '
}

completed_count() {
  local work="$1"
  find "$work/.agent/pulse/registry/completed/friction" -type f 2>/dev/null | wc -l | tr -d ' '
}

run_watch() {
  local work="$1"
  (cd "$work" && ./.agent/pulse/registry/watch_comms.sh >/dev/null)
}

run_orchestrate() {
  local work="$1"
  (cd "$work" && ./.agent/pulse/registry/orchestrate.sh >/dev/null)
}

run_auto_fix_issues() {
  local work="$1"
  (cd "$work" && ./.agent/pulse/registry/auto_fix_issues.sh >/dev/null)
}

export AUTOFIX_STUB_LOG="$TMP/stub.log"
BIN="$TMP/bin"
make_cli_stubs "$BIN"
export PATH="$BIN:$PATH"

# Static guardrails fail fast with clear messages if the implementation has not
# introduced the control knobs the dynamic scenarios depend on.
grep -qF 'ATHANOR_ENABLE_UPSTREAM_AUTOFIX' "$ROOT/.agent/pulse/registry/watch_comms.sh" \
  || fail "watch_comms.sh must require ATHANOR_ENABLE_UPSTREAM_AUTOFIX"
grep -qF 'ATHANOR_ENABLE_UPSTREAM_AUTOFIX' "$ROOT/.agent/pulse/registry/orchestrate.sh" \
  || fail "orchestrate.sh must require ATHANOR_ENABLE_UPSTREAM_AUTOFIX"
grep -qF 'upstream-autofix.global.lock' "$ROOT/.agent/pulse/registry/watch_comms.sh" \
  || fail "watch_comms.sh must use the shared upstream-autofix.global.lock"
grep -qF 'upstream-autofix.global.lock' "$ROOT/.agent/pulse/registry/orchestrate.sh" \
  || fail "orchestrate.sh must use the shared upstream-autofix.global.lock"
grep -qF 'MAX_UPSTREAM_AUTOFIX_PER_RUN=1' "$ROOT/.agent/pulse/registry/watch_comms.sh" \
  || fail "watch_comms.sh must cap upstream autofix dispatches to one per run"
grep -qF 'MAX_UPSTREAM_AUTOFIX_PER_RUN=1' "$ROOT/.agent/pulse/registry/orchestrate.sh" \
  || fail "orchestrate.sh must cap upstream autofix dispatches to one per run"
grep -qF 'ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX' "$ROOT/.agent/pulse/registry/auto_fix_issues.sh" \
  || fail "auto_fix_issues.sh must require ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX"
grep -qF 'MAX_GITHUB_AUTOFIX_PER_RUN=1' "$ROOT/.agent/pulse/registry/auto_fix_issues.sh" \
  || fail "auto_fix_issues.sh must cap GitHub issue autofix dispatches to one per run"
grep -qF 'ATHANOR_ENABLE_ORCHESTRATE_MISSION_GEN' "$ROOT/.agent/pulse/registry/orchestrate.sh" \
  || fail "orchestrate.sh must require ATHANOR_ENABLE_ORCHESTRATE_MISSION_GEN for mission generation"

# Default opt-in off: upstream issue scanners and GitHub issue autofix must be
# inert without explicit environment switches.
WORK_DEFAULT="$TMP/default-off"
copy_harness_fixture "$WORK_DEFAULT"
printf 'UPSTREAM ISSUE: Real bug | This should not dispatch by default\n' > "$WORK_DEFAULT/comms/codex/comms.md"
: > "$AUTOFIX_STUB_LOG"
unset ATHANOR_ENABLE_UPSTREAM_AUTOFIX ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX
export AUTOFIX_GH_ISSUE_COUNT=3
run_watch "$WORK_DEFAULT"
run_orchestrate "$WORK_DEFAULT"
run_auto_fix_issues "$WORK_DEFAULT"
assert_eq 0 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "default opt-in off dispatch count"

# Even when an agent is idle with low queue depth, orchestrate must not invent
# missions unless mission generation is explicitly enabled.
WORK_MISSION_GEN="$TMP/mission-gen-off"
copy_harness_fixture "$WORK_MISSION_GEN"
printf '{"mission":"null"}\n' > "$WORK_MISSION_GEN/comms/codex/.agent/memory/project/missions/active.json"
printf 'queued-one\n' > "$WORK_MISSION_GEN/comms/codex/.agent/mission_queue.txt"
: > "$AUTOFIX_STUB_LOG"
unset ATHANOR_ENABLE_UPSTREAM_AUTOFIX ATHANOR_ENABLE_ORCHESTRATE_MISSION_GEN
run_orchestrate "$WORK_MISSION_GEN"
assert_eq 0 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "orchestrate mission generation default dispatch count"

# Duplicate upstream issue lines across both consumers should produce at most
# one dispatch when explicitly enabled.
WORK_DUP="$TMP/duplicate"
copy_harness_fixture "$WORK_DUP"
{
  printf 'UPSTREAM ISSUE: Shared DEX finding | Same detail from two Pulse jobs\n'
  printf 'UPSTREAM ISSUE: Shared DEX finding | Same detail from two Pulse jobs\n'
} > "$WORK_DUP/comms/codex/comms.md"
: > "$AUTOFIX_STUB_LOG"
export ATHANOR_ENABLE_UPSTREAM_AUTOFIX=1
run_watch "$WORK_DUP"
run_orchestrate "$WORK_DUP"
assert_eq 1 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "duplicate upstream issue dispatch count"
assert_eq 1 "$(completed_count "$WORK_DUP")" "duplicate upstream issue completion ledger count"

# Sentinel placeholders must not dispatch or create locks.
WORK_SENTINEL="$TMP/sentinel"
copy_harness_fixture "$WORK_SENTINEL"
printf 'UPSTREAM ISSUE: [any harness friction] | placeholder only\n' > "$WORK_SENTINEL/comms/codex/comms.md"
: > "$AUTOFIX_STUB_LOG"
export ATHANOR_ENABLE_UPSTREAM_AUTOFIX=1
run_watch "$WORK_SENTINEL"
run_orchestrate "$WORK_SENTINEL"
assert_eq 0 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "sentinel dispatch count"
assert_eq 0 "$(lock_count "$WORK_SENTINEL")" "sentinel lock count"

# auto_fix_issues must be disabled by default and bounded to one issue per run
# when explicitly enabled, even if gh returns several open issues.
WORK_GH="$TMP/github-issues"
copy_harness_fixture "$WORK_GH"
: > "$AUTOFIX_STUB_LOG"
unset ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX
export AUTOFIX_GH_ISSUE_COUNT=4
run_auto_fix_issues "$WORK_GH"
assert_eq 0 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "auto_fix_issues default dispatch count"

: > "$AUTOFIX_STUB_LOG"
export ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX=1
run_auto_fix_issues "$WORK_GH"
assert_eq 1 "$(dispatch_count "$AUTOFIX_STUB_LOG")" "auto_fix_issues enabled dispatch count"

echo "PASS: upstream/autofix guardrail regression scenarios"
