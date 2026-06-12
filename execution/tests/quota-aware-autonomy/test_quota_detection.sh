#!/usr/bin/env bash
# Golden test for quota detection logic in pulse_mission_loop.sh
# Mission: quota-aware-autonomy M2
# Validates the is_quota_error function (or equivalent inline logic) classifies
# Gemini stdout+stderr output correctly into quota vs non-quota failures.

set -u

PULSE_SCRIPT="${PULSE_SCRIPT:-execution/pulse_mission_loop.sh}"

# Resolve to absolute path relative to repo root
if [[ ! -f "$PULSE_SCRIPT" ]]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
  PULSE_SCRIPT="$REPO_ROOT/execution/pulse_mission_loop.sh"
fi

if [[ ! -f "$PULSE_SCRIPT" ]]; then
  echo "FAIL: cannot locate pulse_mission_loop.sh (tried: $PULSE_SCRIPT)"
  exit 1
fi

# Try to source is_quota_error from the pulse loop. We extract only the function
# definition to avoid running the rest of the script.
TMP_FN="$(mktemp -t quota_fn.XXXXXX.sh)"
trap 'rm -f "$TMP_FN"' EXIT

awk '
  /^is_quota_error[[:space:]]*\(\)/ { in_fn = 1 }
  in_fn { print }
  in_fn && /^\}/ { in_fn = 0 }
' "$PULSE_SCRIPT" > "$TMP_FN"

if [[ ! -s "$TMP_FN" ]]; then
  echo "FAIL: is_quota_error function not found in $PULSE_SCRIPT"
  exit 1
fi

# shellcheck disable=SC1090
source "$TMP_FN"

if ! declare -F is_quota_error >/dev/null; then
  echo "FAIL: is_quota_error did not load as a function"
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0

# Test runner: expect_quota <label> <output> <expected: yes|no>
run_case() {
  local label="$1"
  local output="$2"
  local expected="$3"
  local result="no"
  if is_quota_error "$output"; then
    result="yes"
  fi
  if [[ "$result" == "$expected" ]]; then
    echo "PASS: $label (expected=$expected got=$result)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL: $label (expected=$expected got=$result)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# --- QUOTA cases (should return yes) ---
run_case "RESOURCE_EXHAUSTED bare token" \
  "Error: RESOURCE_EXHAUSTED: quota metric exceeded" "yes"

run_case "rateLimitExceeded JSON token" \
  '{"error":{"status":"rateLimitExceeded","message":"limit"}}' "yes"

run_case "429 Too Many Requests" \
  "HTTP 429 Too Many Requests from generativelanguage.googleapis.com" "yes"

run_case "quota exceeded plain text" \
  "You have exceeded your current quota for this project." "yes"

run_case "daily limit phrase" \
  "GoogleGenerativeAI Error: daily limit reached for model gemini-2.5-pro" "yes"

run_case "per-minute quota phrase" \
  "exceeded per-minute quota for gemini-2.5-flash" "yes"

# --- NON-QUOTA cases (should return no) ---
run_case "segfault" \
  "Segmentation fault: 11" "no"

run_case "command not found" \
  "bash: gemini: command not found" "no"

run_case "empty string" \
  "" "no"

run_case "generic network failure" \
  "Error: connection refused on socket" "no"

run_case "auth failure (not quota)" \
  "Error: API key invalid (INVALID_ARGUMENT)" "no"

echo
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
