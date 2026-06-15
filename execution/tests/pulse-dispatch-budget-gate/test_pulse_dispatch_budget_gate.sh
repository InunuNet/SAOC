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

assert_file_executable() {
  local path="$1"
  [ -x "$path" ] || fail "$path must exist and be executable"
}

provider_call_count() {
  local log="$1"
  grep -E '^(claude|codex|gemini|agy|sdk-cli) ' "$log" 2>/dev/null | wc -l | tr -d ' '
}

ticket_occurrences() {
  local project="$1"
  local id="$2"
  grep -R "$id" "$project/.agent/pulse" 2>/dev/null | wc -l | tr -d ' '
}

make_provider_stubs() {
  local bin="$1"
  mkdir -p "$bin"

  for name in claude codex gemini agy sdk-cli; do
    cat > "$bin/$name" <<'STUB'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >> "$PULSE_PROVIDER_STUB_LOG"
exit 0
STUB
    chmod +x "$bin/$name"
  done
}

make_project_fixture() {
  local project="$1"
  mkdir -p "$project/.agent" "$project/.agent/pulse"
  printf 'Athanor\n' > "$project/WORKSPACE"
  cat > "$project/.agent/profile.json" <<'JSON'
{"project_name":"Athanor","onboarding_complete":true,"autonomy":{"level":"high"}}
JSON
}

enqueue_ticket() {
  local project="$1"
  local id="$2"
  local requires_model="$3"
  local dedupe_key="$4"
  local prompt="$5"

  (
    cd "$project"
    python3 "$ROOT/execution/pulse_ticket.py" enqueue \
      --id "$id" \
      --source "pulse-dispatch-budget-gate-test" \
      --kind "regression" \
      --project-path "$project" \
      --provider "codex" \
      --requires-model "$requires_model" \
      --prompt "$prompt" \
      --dedupe-key "$dedupe_key" \
      --max-turns 1 \
      --max-tokens 1000 >/dev/null
  )
}

run_dispatcher_once() {
  local project="$1"
  shift
  (
    cd "$project"
    env "$@" python3 "$ROOT/execution/pulse_dispatcher.py" --once --max-launches 10 >/dev/null
  )
}

assert_file_executable "$ROOT/execution/pulse_dispatcher.py"
assert_file_executable "$ROOT/execution/pulse_ticket.py"

BIN="$TMP/bin"
LOG="$TMP/provider.log"
make_provider_stubs "$BIN"
export PATH="$BIN:$PATH"
export PULSE_PROVIDER_STUB_LOG="$LOG"

# Idle Pulse work must stay cheap: no ticket means no model launch.
IDLE_PROJECT="$TMP/idle"
make_project_fixture "$IDLE_PROJECT"
: > "$LOG"
run_dispatcher_once "$IDLE_PROJECT"
assert_eq 0 "$(provider_call_count "$LOG")" "idle dispatcher provider calls"

# Notification/update tickets are provider-neutral facts, not launch requests.
NO_MODEL_PROJECT="$TMP/no-model"
make_project_fixture "$NO_MODEL_PROJECT"
: > "$LOG"
enqueue_ticket "$NO_MODEL_PROJECT" "ticket-no-model" "false" "notice-1" "status-only notification"
assert_eq 0 "$(provider_call_count "$LOG")" "ticket helper provider calls"
run_dispatcher_once "$NO_MODEL_PROJECT"
assert_eq 0 "$(provider_call_count "$LOG")" "requires_model=false provider calls"

# Duplicate dedupe_key tickets must collapse to one launch even with a high per-run cap.
DEDUP_PROJECT="$TMP/dedup"
make_project_fixture "$DEDUP_PROJECT"
: > "$LOG"
enqueue_ticket "$DEDUP_PROJECT" "ticket-dup-a" "true" "same-work-item" "first duplicate prompt"
enqueue_ticket "$DEDUP_PROJECT" "ticket-dup-b" "true" "same-work-item" "second duplicate prompt"
assert_eq 0 "$(provider_call_count "$LOG")" "enqueue duplicate provider calls"
run_dispatcher_once "$DEDUP_PROJECT"
assert_eq 1 "$(provider_call_count "$LOG")" "duplicate dedupe_key provider calls"

# The global model kill switch fails closed and preserves queued work.
DISABLE_PROJECT="$TMP/disabled"
make_project_fixture "$DISABLE_PROJECT"
: > "$LOG"
enqueue_ticket "$DISABLE_PROJECT" "ticket-disabled-valid" "true" "disabled-valid" "valid prompt kept queued"
run_dispatcher_once "$DISABLE_PROJECT" ATHANOR_PULSE_MODEL_DISABLE=1
assert_eq 0 "$(provider_call_count "$LOG")" "ATHANOR_PULSE_MODEL_DISABLE provider calls"
if [ "$(ticket_occurrences "$DISABLE_PROJECT" "ticket-disabled-valid")" -eq 0 ]; then
  fail "ATHANOR_PULSE_MODEL_DISABLE must keep the valid ticket queued"
fi

# Positive path: a valid ticket launches through dispatcher-controlled stub bins.
LAUNCH_PROJECT="$TMP/launch"
make_project_fixture "$LAUNCH_PROJECT"
: > "$LOG"
enqueue_ticket "$LAUNCH_PROJECT" "ticket-launch-valid" "true" "launch-valid" "valid prompt"
assert_eq 0 "$(provider_call_count "$LOG")" "provider calls before dispatcher"
run_dispatcher_once "$LAUNCH_PROJECT"
assert_eq 1 "$(provider_call_count "$LOG")" "dispatcher provider calls"

echo "PASS pulse dispatch budget gate regression coverage"
