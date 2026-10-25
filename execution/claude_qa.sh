#!/usr/bin/env bash
# claude_qa.sh — headless cross-model QA wrapper around `claude -p`, the mirror
# of codex_qa.sh for sessions where the code under review was written by an
# OpenAI model (Athanor running in Codex). Claude reviews GPT; GPT reviews Claude.
#
# Usage:
#   execution/claude_qa.sh [--apex] [--evidence '<command>']... <file_path_or_prompt>
#   execution/claude_qa.sh [--apex] [--evidence '<command>']...   # prompt from stdin if omitted
#   cat prompt.txt | execution/claude_qa.sh
#
# --evidence '<command>' (repeatable, before or after --apex) runs the command
# with `bash -c` in the caller's cwd BEFORE the review, outside the reviewer's
# read-only sandbox, and puts the command, its output (last 200 lines) and its
# exit code verbatim into the prompt. A failing command does not abort the
# review; its exit code is the evidence.
#
# Model: claude-sonnet-5-5 (pinned). --apex reviews on claude-opus-5-5, for
# features declaring tier: apex. Read-only: --permission-mode plan lets the
# reviewer read files and run read-only commands but never edit.
#
# Stdout contract (identical to codex_qa.sh): line 1 is exactly PASS or FAIL.
# On FAIL, findings/reason lines follow. Exit codes: 0=PASS, 1=FAIL (verdict
# or fail-safe), 2=wrapper usage error OR reviewer unavailable (usage/rate
# limit: nothing on stdout, the reason on stderr; callers treat it as
# inconclusive). Timeout: 1200s, override with
# CLAUDE_QA_TIMEOUT=<seconds>.
set -u

STANDARD_MODEL="claude-sonnet-5-5"
APEX_MODEL="claude-opus-5-5"

usage_error() {
    echo "claude_qa.sh: $1" >&2
    exit 2
}

# Reviewer stderr matching any of these (explicit limit phrases only, never bare
# words like quota or 429) means the reviewer is out of quota, not that the
# work failed: the wrapper exits 2 (inconclusive) instead of a fail-safe FAIL.
UNAVAILABLE_SIGNATURES='usage limit|rate limit|hit your [a-z ]*limit|429 Too Many Requests|HTTP 429'
EVIDENCE_MAX_LINES=200

# exit 2 with the matching line on stderr when the text in $1 holds a
# usage/rate-limit signature; returns 1 (and does nothing) otherwise.
exit_if_reviewer_unavailable() {
    local line
    line="$(printf '%s\n' "$1" | grep -iE -m1 "$UNAVAILABLE_SIGNATURES")" || return 1
    echo "claude_qa.sh: reviewer unavailable: ${line}" >&2
    exit 2
}

# Run each --evidence command here, outside the reviewer's read-only sandbox,
# and append command, output (last EVIDENCE_MAX_LINES lines) and exit code to
# review_body. A failing command is evidence, never an abort.
append_evidence() {
    local cmd evfile rc body
    [ "${#evidence_cmds[@]}" -gt 0 ] || return 0
    review_body="${review_body}

Evidence, run by the orchestrator outside your sandbox, verbatim:"
    for cmd in "${evidence_cmds[@]}"; do
        # Output goes to a file, not a pipe: a backgrounded grandchild holding a
        # $(...) pipe open would hang the read past the timeout.
        evfile="$(mktemp 2>/dev/null)" || evfile=""
        if [ -n "$evfile" ]; then
            timeout "${QA_EVIDENCE_TIMEOUT:-120}" bash -c "$cmd" < /dev/null > "$evfile" 2>&1
            rc=$?
            body="$(tail -n "$EVIDENCE_MAX_LINES" -- "$evfile")"
            rm -f -- "$evfile"
        else
            body="$(timeout "${QA_EVIDENCE_TIMEOUT:-120}" bash -c "$cmd" < /dev/null 2>&1 | tail -n "$EVIDENCE_MAX_LINES"; exit "${PIPESTATUS[0]}")"
            rc=$?
        fi
        review_body="${review_body}

\$ ${cmd}
${body}
[exit ${rc}]"
    done
}

fail_safe() {
    echo "FAIL"
    echo "FAIL: $1"
    exit 1
}

model="$STANDARD_MODEL"
evidence_cmds=()
while [ $# -gt 0 ]; do
    case "$1" in
        --apex)
            model="$APEX_MODEL"
            shift
            ;;
        --evidence)
            [ $# -ge 2 ] || usage_error "--evidence needs a command argument"
            evidence_cmds+=("$2")
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

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

append_evidence

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
# stderr goes to a tmpfile so a usage-limit message can be recognised, then is
# replayed to the caller. If mktemp is unavailable (read-only sandbox) stderr
# just passes through uncaptured; a limit message then cannot be recognised.
errfile="$(mktemp 2>/dev/null)" || errfile=""
trap '[ -z "$errfile" ] || rm -f "$errfile"' EXIT
output="$(timeout "${CLAUDE_QA_TIMEOUT:-1200}" claude -p \
    --model "$model" \
    --permission-mode plan \
    "$prompt" < /dev/null 2> "${errfile:-/dev/stderr}")"
claude_rc=$?
[ -z "$errfile" ] || cat -- "$errfile" >&2

if [ "$claude_rc" -eq 124 ]; then
    fail_safe "claude -p timed out after ${CLAUDE_QA_TIMEOUT:-1200}s"
fi

if [ "$claude_rc" -ne 0 ]; then
    # stderr only: stdout is the review itself and may quote any phrase.
    if [ -n "$errfile" ]; then
        exit_if_reviewer_unavailable "$(cat -- "$errfile")" || true
    fi
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
