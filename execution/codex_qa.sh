#!/usr/bin/env bash
# codex_qa.sh — headless cross-model QA wrapper around `codex exec` (gpt-6-sol, pinned).
# --apex reviews on gpt-6-astra, for features declaring tier: apex. The mirror
# for sessions running in Codex is claude_qa.sh (Claude reviews GPT).
#
# Usage:
#   execution/codex_qa.sh [--apex] [--evidence '<command>']... <file_path_or_prompt>
#   execution/codex_qa.sh [--apex] [--evidence '<command>']...   # prompt from stdin if omitted
#   cat prompt.txt | execution/codex_qa.sh
#
# --evidence '<command>' (repeatable, before or after --apex) runs the command
# with `bash -c` in the caller's cwd BEFORE the review, outside the reviewer's
# read-only sandbox, and puts the command, its output (last 200 lines) and its
# exit code verbatim into the prompt. A failing command does not abort the
# review; its exit code is the evidence.
#
# Stdout contract: line 1 is exactly PASS or FAIL. On FAIL, findings/reason
# lines follow. Exit codes: 0=PASS, 1=FAIL (verdict or fail-safe), 2=wrapper
# usage error OR reviewer unavailable (usage/rate limit: nothing on stdout, the
# reason on stderr; callers treat it as inconclusive). See:
#   .agent/memory/project/specs/cross-model-qa-codex/goldens/codex_qa_cli_contract.md
#
# Timeout: 1200s by default (high effort), override with CODEX_QA_TIMEOUT=<seconds>. The
# default covers open-ended full-review prompts (codex reading multiple
# files, designing adversarial inputs); bounded single-question prompts
# return in 7-14s regardless and are unaffected by a higher ceiling.
set -u

usage_error() {
    echo "codex_qa.sh: $1" >&2
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
    echo "codex_qa.sh: reviewer unavailable: ${line}" >&2
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
    # $1 = reason line printed after the FAIL verdict token.
    echo "FAIL"
    echo "FAIL: $1"
    exit 1
}

STANDARD_MODEL="gpt-6-sol"
APEX_MODEL="gpt-6-astra"

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

append_evidence

prompt="${review_body}

---
Respond with a verdict in this exact format:
- Line 1 must be exactly PASS or FAIL, with no other text on that line.
- If FAIL, follow with one or more findings lines, each citing file:line where possible.
- If PASS, no further lines are required."

# --- Step 3: unique tmpfile per invocation (idempotency / concurrency) ------
tmpfile="$(mktemp 2>/dev/null)" || usage_error "could not create tmpfile via mktemp"
errfile="$(mktemp 2>/dev/null)" || usage_error "could not create tmpfile via mktemp"
trap 'rm -f "$tmpfile" "$errfile"' EXIT

# --- Step 4: run codex exec, bounded by timeout, output captured via -o -----
# stdin is closed explicitly: `codex exec` otherwise blocks reading inherited
# stdin from a non-TTY shell until the timeout kills it (GH #1455).
# Effort is high: the gate's documented setting, and measured to catch defects
# medium passes (GH #1438). CODEX_QA_EFFORT overrides for a quick sanity check.
timeout "${CODEX_QA_TIMEOUT:-1200}" codex exec \
    -m "$model" \
    -c model_reasoning_effort="${CODEX_QA_EFFORT:-high}" \
    -s read-only \
    -o "$tmpfile" \
    "$prompt" < /dev/null 2> "$errfile"
codex_rc=$?
cat -- "$errfile" >&2

if [ "$codex_rc" -eq 124 ]; then
    fail_safe "codex exec timed out after ${CODEX_QA_TIMEOUT:-1200}s"
fi

if [ "$codex_rc" -ne 0 ]; then
    exit_if_reviewer_unavailable "$(cat -- "$errfile")" || true
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
