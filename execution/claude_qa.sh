#!/usr/bin/env bash
# claude_qa.sh — headless cross-model QA wrapper around `claude -p`, the mirror
# of codex_qa.sh for sessions where the code under review was written by an
# OpenAI model (Athanor running in Codex). Claude reviews GPT; GPT reviews Claude.
#
# Usage:
#   execution/claude_qa.sh [--apex] <file_path_or_prompt>
#   execution/claude_qa.sh [--apex]          # prompt read from stdin if omitted
#   cat prompt.txt | execution/claude_qa.sh
#
# Model: claude-sonnet-5-5 (pinned). --apex reviews on claude-opus-5-5, for
# features declaring tier: apex. Read-only: --permission-mode plan lets the
# reviewer read files and run read-only commands but never edit.
#
# Stdout contract (identical to codex_qa.sh): line 1 is exactly PASS or FAIL.
# On FAIL, findings/reason lines follow. Exit codes: 0=PASS, 1=FAIL (verdict
# or fail-safe), 2=wrapper usage error. Timeout: 1200s, override with
# CLAUDE_QA_TIMEOUT=<seconds>.
set -u

STANDARD_MODEL="claude-sonnet-5-5"
APEX_MODEL="claude-opus-5-5"

usage_error() {
    echo "claude_qa.sh: $1" >&2
    exit 2
}

fail_safe() {
    echo "FAIL"
    echo "FAIL: $1"
    exit 1
}

model="$STANDARD_MODEL"
if [ "${1:-}" = "--apex" ]; then
    model="$APEX_MODEL"
    shift
fi

# --- Step 1: claude binary must be present ----------------------------------
if ! command -v claude >/dev/null 2>&1; then
    usage_error "claude binary not found on PATH"
fi

# --- Step 2: resolve the review target into a prompt body -------------------
target_arg="${1:-}"
review_body=""

if [ -n "$target_arg" ]; then
    if [ -f "$target_arg" ] && [ -r "$target_arg" ]; then
        review_body="Review this file for bugs/regressions.

File: ${target_arg}

$(cat -- "$target_arg")"
    else
        review_body="$target_arg"
    fi
else
    if [ -t 0 ]; then
        usage_error "no prompt supplied: pass a file path or prompt string as \$1, or pipe a prompt via stdin"
    fi
    review_body="$(cat -)"
fi

if [ -z "$review_body" ]; then
    usage_error "resolved prompt is empty"
fi

prompt="You are an adversarial QA reviewer. The work below was written by a different model; your job is to find what is wrong with it, not to agree with it.

${review_body}

---
Respond with a verdict in this exact format:
- Line 1 must be exactly PASS or FAIL, with no other text on that line.
- If FAIL, follow with one or more findings lines, each citing file:line where possible.
- If PASS, no further lines are required."

# --- Step 3: run claude -p, bounded by timeout, output held in memory -------
# No temp file: inside a Codex read-only sandbox mktemp fails before the
# review could run. stdin is closed so a non-TTY parent cannot block it.
output="$(timeout "${CLAUDE_QA_TIMEOUT:-1200}" claude -p \
    --model "$model" \
    --permission-mode plan \
    "$prompt" < /dev/null)"
claude_rc=$?

if [ "$claude_rc" -eq 124 ]; then
    fail_safe "claude -p timed out after ${CLAUDE_QA_TIMEOUT:-1200}s"
fi

if [ "$claude_rc" -ne 0 ]; then
    fail_safe "claude -p exited with status ${claude_rc}"
fi

if [ -z "$output" ]; then
    fail_safe "empty claude output"
fi

# --- Step 4: parse the verdict from the first non-blank line ----------------
# Normalised (whitespace stripped, upper-cased) before the exact match, so
# "  pass  " still parses instead of discarding real findings.
verdict_line="$(printf '%s\n' "$output" | grep -v '^[[:space:]]*$' | head -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]')"

case "$verdict_line" in
    PASS)
        echo "PASS"
        exit 0
        ;;
    FAIL)
        echo "FAIL"
        printf '%s\n' "$output" | grep -v '^[[:space:]]*$' | tail -n +2
        exit 1
        ;;
    *)
        fail_safe "claude output did not include a parseable PASS/FAIL verdict"
        ;;
esac
