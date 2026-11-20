#!/usr/bin/env bash
# agy_qa.sh — headless cross-model QA wrapper around `agy -p` (Antigravity CLI).
# Standard review runs on gemini-4-hydrogen-high, --apex on gemini-4-argon-high. Nothing else.
# Same interface and exit codes as codex_qa.sh; execution/qa.sh is the normal entry point.
#
# Usage:
#   execution/agy_qa.sh [--apex] [--evidence '<command>']... <file_path_or_prompt>
#   execution/agy_qa.sh [--apex] [--evidence '<command>']...   # prompt from stdin if omitted
#
# Stdout contract: line 1 is exactly PASS or FAIL (+ findings on FAIL). Exit codes: 0=PASS,
# 1=FAIL (verdict or fail-safe), 2=usage error OR reviewer unavailable (agy missing, not
# authenticated, quota out, or the reviewer was denied a read: nothing on stdout, reason on
# stderr). Design: .agent/memory/project/specs/agy-delegation/DECISIONS.md section 2.
#
# Read-only is enforced by deny rules in an inline --settings JSON (probe 1b: the default
# headless run writes files, --mode plan and --sandbox alone do not stop it). The exit code is
# never trusted: the JSON result is read.
# AGY_QA_TIMEOUT (default 20m) is agy's --print-timeout. QA_AGY_META_FILE, when set, receives
# key=value token/model lines for the caller's ledger row. QA_LEDGER_BY_CALLER=1 (set by qa.sh)
# suppresses this script's own ledger row.
set -u
# -h/--help anywhere prints this header and exits 0 without dispatching a review.
for _a in "$@"; do
    case "$_a" in -h|--help) awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$0"; exit 0 ;; esac
done

EVIDENCE_MAX_LINES=200
LOW_QUOTA_PERCENT=3
DENY_SETTINGS='{"permissions":{"deny":["write_file(*)","command(*)","mcp(*)","execute_url(*)","download_url(*)","read_url(*)"]}}'
# Guesses for the unauthenticated / quota-out text (DECISIONS s8); the empty-response-with-
# denials rule below is the net. Explicit phrases only, never bare "limit" or "rate".
UNAVAILABLE_SIGNATURES='not authenticated|authentication required|log ?in|sign in|quota|usage limit|rate limit|exhausted'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEDGER_PY="$SCRIPT_DIR/dispatch_ledger.py"

PY=""
for cand in python3 python py; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
        PY="$cand"
        break
    fi
done
STANDARD_MODEL=""
APEX_MODEL=""
if [ -n "$PY" ]; then
    STANDARD_MODEL="$("$PY" "$SCRIPT_DIR/agy_models.py" tier flash | tr -d '\r')" || STANDARD_MODEL=""
    APEX_MODEL="$("$PY" "$SCRIPT_DIR/agy_models.py" tier apex | tr -d '\r')" || APEX_MODEL=""
fi
if [ -z "$STANDARD_MODEL" ] || [ -z "$APEX_MODEL" ]; then
    echo "agy_qa.sh: cannot resolve Antigravity models from model_map (agy unavailable)" >&2
    exit 2
fi
tier="standard"
model="$STANDARD_MODEL"
tok_in=""; tok_out=""; tok_think=""; tok_cache=""; tok_total=""

usage_error() {
    echo "agy_qa.sh: $1" >&2
    exit 2
}

TMPD=""

cleanup() {
    [ -z "$TMPD" ] || "$PY" -c 'import shutil, sys; shutil.rmtree(sys.argv[1], ignore_errors=True)' "$TMPD"
}
trap cleanup EXIT

new_tmp() {
    local f
    f="$(mktemp "$TMPD/t.XXXXXX" 2>/dev/null)" || usage_error "could not create tmpfile via mktemp"
    printf '%s' "$f"
}

# ledger VERDICT RC FINDINGS: own row only for direct calls; never fails the review.
ledger() {
    [ "${QA_LEDGER_BY_CALLER:-0}" = "1" ] && return 0
    [ -n "$PY" ] || return 0
    "$PY" "$LEDGER_PY" append --kind qa --mode direct --lead "${ATHANOR_PROVIDER:-claude}" \
        --provider agy --model "$model" --tier "$tier" --verdict "$1" --rc "$2" \
        --wall "$SECONDS" --tokens-in "$tok_in" --tokens-out "$tok_out" \
        --tokens-thinking "$tok_think" --tokens-cache-read "$tok_cache" \
        --tokens-total "$tok_total" --findings "$3" || true
}

write_meta() {
    [ -n "${QA_AGY_META_FILE:-}" ] || return 0
    {
        echo "model=$model"
        echo "tokens_in=$tok_in"
        echo "tokens_out=$tok_out"
        echo "tokens_thinking=$tok_think"
        echo "tokens_cache_read=$tok_cache"
        echo "tokens_total=$tok_total"
    } > "$QA_AGY_META_FILE" 2>/dev/null || true
}

unavailable() {
    echo "agy_qa.sh: reviewer unavailable: $1" >&2
    write_meta
    ledger UNAVAILABLE 2 0
    exit 2
}

fail_safe() {
    echo "FAIL"
    echo "FAIL: $1"
    write_meta
    ledger FAIL 1 1
    exit 1
}

with_timeout() {
    local secs="$1"; shift
    if command -v timeout >/dev/null 2>&1; then
        timeout "$secs" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        gtimeout "$secs" "$@"
    else
        "$PY" -c 'import subprocess, sys
try:
    sys.exit(subprocess.run(sys.argv[2:], timeout=float(sys.argv[1])).returncode)
except subprocess.TimeoutExpired:
    sys.exit(124)' "$secs" "$@"
    fi
}

append_evidence() {
    local cmd evfile rc body
    [ "${#evidence_cmds[@]}" -gt 0 ] || return 0
    review_body="${review_body}

Evidence, run by the orchestrator outside your sandbox, verbatim:"
    for cmd in "${evidence_cmds[@]}"; do
        evfile="$(new_tmp)"
        with_timeout "${QA_EVIDENCE_TIMEOUT:-120}" bash -c "$cmd" < /dev/null > "$evfile" 2>&1
        rc=$?
        body="$(tail -n "$EVIDENCE_MAX_LINES" -- "$evfile")"
        review_body="${review_body}

\$ ${cmd}
${body}
[exit ${rc}]"
    done
}

# Prints remaining percent of the matching /usage bucket, or nothing when unparseable.
PARSE_USAGE_PY='
import json, re, sys
try:
    resp = json.load(open(sys.argv[1], encoding="utf-8")).get("response", "")
except Exception:
    sys.exit(0)
want = ("Argon", "Weekly") if sys.argv[2] == "apex" else ("Gemini Models", "Five Hour")
for row in resp.splitlines():
    if all(w in row for w in want):
        m = re.search(r"(\d+)%", row)
        if m:
            print(m.group(1))
        break
'

PARSE_RESULT_PY='
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        d = json.load(fh)
except Exception:
    print("json=0")
    sys.exit(0)
if not isinstance(d, dict):
    print("json=0")
    sys.exit(0)
with open(sys.argv[2], "w", encoding="utf-8") as fh:
    fh.write(d.get("response") or "")
u = d.get("usage") or {}
def n(k):
    v = u.get(k)
    return v if isinstance(v, int) else ""
print("json=1")
print("status=%s" % d.get("status", ""))
print("finished=%s" % d.get("finished_reason", ""))
print("denied=%d" % len(d.get("denied_actions") or []))
print("tokens_in=%s" % n("input_tokens"))
print("tokens_out=%s" % n("output_tokens"))
print("tokens_thinking=%s" % n("thinking_tokens"))
print("tokens_cache=%s" % n("cache_read_tokens"))
print("tokens_total=%s" % n("total_tokens"))
print("error=%s" % " ".join(str(d.get("error", "")).split()))
'

evidence_cmds=()
while [ $# -gt 0 ]; do
    case "$1" in
        --apex)
            tier="apex"
            model="$APEX_MODEL"
            shift
            ;;
        --evidence)
            [ $# -ge 2 ] || usage_error "--evidence needs a command argument"
            evidence_cmds+=("$2")
            shift 2
            ;;
        --model|--model=*|--effort|--effort=*)
            usage_error "model and effort are pinned; $1 is not accepted"
            ;;
        *)
            break
            ;;
    esac
done

if [ -n "${AGY_MODEL:-}${AGY_EFFORT:-}${AGY_QA_MODEL:-}" ]; then
    usage_error "model and effort are pinned; AGY_MODEL/AGY_EFFORT/AGY_QA_MODEL are not accepted"
fi

# --- Step 1: agy binary (the interactive alias does not expand here) ---------
AGY_BIN="$(command -v agy 2>/dev/null || true)"
[ -n "$AGY_BIN" ] || usage_error "agy binary not found on PATH"
[ -n "$PY" ] || usage_error "python3/python not found on PATH"
TMPD="$(mktemp -d 2>/dev/null)" || usage_error "could not create temp directory via mktemp -d"

# --- Step 2: resolve the review target into a prompt body --------------------
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
[ -n "$review_body" ] || usage_error "resolved prompt is empty"

append_evidence

prompt="${review_body}

---
Respond with a verdict in this exact format:
- Line 1 must be exactly PASS or FAIL, with no other text on that line.
- If FAIL, follow with one or more findings lines, each citing file:line where possible.
- If PASS, no further lines are required."

# --- Step 3: advisory quota preflight (free local command) -------------------
usage_file="$(new_tmp)"
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$AGY_BIN" -p "/usage" --output-format json \
    --settings "$DENY_SETTINGS" < /dev/null > "$usage_file" 2>/dev/null
remaining="$("$PY" -c "$PARSE_USAGE_PY" "$usage_file" "$tier" 2>/dev/null | tr -d '\r' || true)"
case "$remaining" in
    ''|*[!0-9]*) ;;
    *)
        if [ "$remaining" -le "$LOW_QUOTA_PERCENT" ]; then
            unavailable "plan quota for $model is at ${remaining}% remaining"
        fi
        ;;
esac

# --- Step 4: run the review under deny-rule settings --------------------------
outfile="$(new_tmp)"
errfile="$(new_tmp)"
respfile="$(new_tmp)"

MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$AGY_BIN" -p "$prompt" \
    --model "$model" \
    --output-format json \
    --sandbox \
    --print-timeout "${AGY_QA_TIMEOUT:-20m}" \
    --settings "$DENY_SETTINGS" \
    < /dev/null > "$outfile" 2> "$errfile"
agy_rc=$?
cat -- "$errfile" >&2

# --- Step 5: read the JSON, never the exit code alone ------------------------
json=0; status=""; finished=""; denied=0; err_text=""
while IFS== read -r key value; do
    case "$key" in
        json) json="$value" ;;
        status) status="$value" ;;
        finished) finished="$value" ;;
        denied) denied="$value" ;;
        tokens_in) tok_in="$value" ;;
        tokens_out) tok_out="$value" ;;
        tokens_thinking) tok_think="$value" ;;
        tokens_cache) tok_cache="$value" ;;
        tokens_total) tok_total="$value" ;;
        error) err_text="$value" ;;
    esac
done <<EOF
$("$PY" -c "$PARSE_RESULT_PY" "$outfile" "$respfile" 2>/dev/null | tr -d '\r')
EOF

if [ "$agy_rc" -eq 1 ]; then
    haystack="${err_text} $(cat -- "$errfile") $(head -c 4000 -- "$outfile")"
    sig="$(printf '%s\n' "$haystack" | grep -iE -o "$UNAVAILABLE_SIGNATURES" | head -n 1 || true)"
    [ -z "$sig" ] || unavailable "$sig"
    fail_safe "agy exited with status 1${err_text:+: $err_text}"
fi
if [ "$agy_rc" -eq 3 ] || [ "$finished" = "print_timeout" ]; then
    fail_safe "agy timed out after ${AGY_QA_TIMEOUT:-20m}"
fi
if [ "$agy_rc" -ne 0 ]; then
    fail_safe "agy exited with status ${agy_rc}"
fi
[ "$json" = "1" ] || fail_safe "agy output was not valid JSON"
[ "$status" = "SUCCESS" ] || fail_safe "agy status was ${status:-missing}"

if [ ! -s "$respfile" ] || [ -z "$(tr -d '[:space:]' < "$respfile")" ]; then
    if [ "$denied" -gt 0 ]; then
        unavailable "reviewer was denied a read (empty response, ${denied} denied actions)"
    fi
    fail_safe "empty agy response"
fi

verdict_line="$(head -n 1 -- "$respfile" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]')"
case "$verdict_line" in
    PASS)
        echo "PASS"
        write_meta
        ledger PASS 0 0
        exit 0
        ;;
    FAIL)
        echo "FAIL"
        tail -n +2 -- "$respfile"
        findings="$(tail -n +2 -- "$respfile" | grep -c '[^[:space:]]' || true)"
        write_meta
        ledger FAIL 1 "${findings:-0}"
        exit 1
        ;;
    *)
        fail_safe "agy output did not include a parseable PASS/FAIL verdict"
        ;;
esac
