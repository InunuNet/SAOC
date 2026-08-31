#!/usr/bin/env bash
# codex_qa.sh — headless cross-model QA wrapper around `codex exec` (GPT-5.5, pinned).
#
# Usage:
#   execution/codex_qa.sh <file_path_or_prompt>
#   execution/codex_qa.sh          # prompt read from stdin if $1 omitted
#   cat prompt.txt | execution/codex_qa.sh
#
# Stdout contract: line 1 is exactly PASS or FAIL. On FAIL, findings/reason
# lines follow. Exit codes: 0=PASS, 1=FAIL (verdict or fail-safe), 2=wrapper
# usage error. See:
#   .agent/memory/project/specs/cross-model-qa-codex/goldens/codex_qa_cli_contract.md
#
# Timeout: 600s by default, override with CODEX_QA_TIMEOUT=<seconds>. The
# default covers open-ended full-review prompts (codex reading multiple
# files, designing adversarial inputs); bounded single-question prompts
# return in 7-14s regardless and are unaffected by a higher ceiling.
set -u

usage_error() {
    echo "codex_qa.sh: $1" >&2
    exit 2
}

fail_safe() {
    # $1 = reason line printed after the FAIL verdict token.
    echo "FAIL"
    echo "FAIL: $1"
    exit 1
}

# --- Step 1: codex binary must be present -----------------------------------
if ! command -v codex >/dev/null 2>&1; then
    usage_error "codex binary not found on PATH"
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

prompt="${review_body}

---
Respond with a verdict in this exact format:
- Line 1 must be exactly PASS or FAIL, with no other text on that line.
- If FAIL, follow with one or more findings lines, each citing file:line where possible.
- If PASS, no further lines are required."

# --- Step 3: unique tmpfile per invocation (idempotency / concurrency) ------
tmpfile="$(mktemp 2>/dev/null)" || usage_error "could not create tmpfile via mktemp"
trap 'rm -f "$tmpfile"' EXIT

# --- Step 4: run codex exec, bounded by timeout, output captured via -o -----
timeout "${CODEX_QA_TIMEOUT:-600}" codex exec \
    -m gpt-5.5 \
    -c model_reasoning_effort=high \
    -s read-only \
    -o "$tmpfile" \
    "$prompt"
codex_rc=$?

if [ "$codex_rc" -eq 124 ]; then
    fail_safe "codex exec timed out after ${CODEX_QA_TIMEOUT:-600}s"
fi

if [ "$codex_rc" -ne 0 ]; then
    fail_safe "codex exec exited with status ${codex_rc}"
fi

if [ ! -s "$tmpfile" ]; then
    fail_safe "empty codex output"
fi

# --- Step 5: parse the verdict from line 1 of the outfile -------------------
# Normalized (strip surrounding whitespace, casefold) before the exact-match
# comparison so casing/whitespace drift in GPT-5.5's own output (e.g.
# "  PASS  ", "pass", "Fail") still parses instead of falling through to
# fail_safe() and discarding real findings.
verdict_line="$(head -n 1 -- "$tmpfile" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]')"

case "$verdict_line" in
    PASS)
        echo "PASS"
        exit 0
        ;;
    FAIL)
        echo "FAIL"
        tail -n +2 -- "$tmpfile"
        exit 1
        ;;
    *)
        fail_safe "codex output did not include a parseable PASS/FAIL verdict"
        ;;
esac
