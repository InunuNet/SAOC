#!/usr/bin/env bash
# qa.sh — single cross-model QA entry point. Alternates between two reviewers, fails over when
# one is unavailable, and with --both (implied by --apex) asks both and combines the verdicts.
#
# Usage:
#   execution/qa.sh [--apex] [--both] [--evidence '<command>']... <file_path_or_prompt>
#   cat prompt.txt | execution/qa.sh [--both]
#
# Pair by lead (ATHANOR_PROVIDER): claude (default) = codex_qa.sh + agy_qa.sh; codex =
# claude_qa.sh + agy_qa.sh; antigravity = codex_qa.sh + claude_qa.sh.
# Standard: the pair member that did NOT run in the last alternate/failover ledger row runs;
# exit 2 from it fails over to the other in the same call. A FAIL is final, never retried.
# --both: both run in parallel (once each); evidence commands run once, here. Line 1 is FAIL if
# either FAIL, PASS only if both PASS; then one `<provider>: VERDICT` line each, then findings
# prefixed `[provider]`. One UNAVAILABLE + one PASS exits 2 unless QA_BOTH_ALLOW_DEGRADED=1.
#
# Output is always normalized (never the reviewer's raw stdout): line 1 qa.sh's own verdict,
# `<provider>: VERDICT` lines, `[provider]` findings once each, raw transcript path(s) last.
# Exit codes as the wrappers: 0 PASS, 1 FAIL, 2 usage error or no reviewer available.
# Ledger: one row per reviewer run, .agent/memory/project/telemetry/dispatch.jsonl.
# Not locked: two leads calling qa.sh at the same instant can pick the same reviewer (the
# next-reviewer read is not under a lock; only the ledger append is).
# Test overrides: QA_CODEX_BIN, QA_CLAUDE_BIN, QA_AGY_BIN, ATHANOR_DISPATCH_LEDGER, QA_LOG_DIR
# (transcript directory, default .agent/memory/scratch).
# Design: .agent/memory/project/specs/agy-delegation/DECISIONS.md section 4.
set -u

EVIDENCE_MAX_LINES=200
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LEDGER_PY="$SCRIPT_DIR/dispatch_ledger.py"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
transcripts=""
PY=""
for cand in python3 python py; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
        PY="$cand"
        break
    fi
done

usage_error() {
    echo "qa.sh: $1" >&2
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

# --- reviewer table -----------------------------------------------------------
bin_for() {
    case "$1" in
        codex) printf '%s' "${QA_CODEX_BIN:-$SCRIPT_DIR/codex_qa.sh}" ;;
        claude) printf '%s' "${QA_CLAUDE_BIN:-$SCRIPT_DIR/claude_qa.sh}" ;;
        agy) printf '%s' "${QA_AGY_BIN:-$SCRIPT_DIR/agy_qa.sh}" ;;
    esac
}

# agy_model TIER: model from the provider model_map; empty (ledger null) when unresolved.
agy_model() {
    [ -n "$PY" ] || return 0
    "$PY" "$SCRIPT_DIR/agy_models.py" tier "$1" 2>/dev/null | tr -d '\r' || true
}

model_for() {
    case "$1:$tier" in
        codex:standard) echo "gpt-6-sol" ;;
        codex:apex) echo "gpt-6-astra" ;;
        claude:standard) echo "claude-sonnet-5-5" ;;
        claude:apex) echo "claude-opus-5-5" ;;
        agy:standard) agy_model flash ;;
        agy:apex) agy_model apex ;;
    esac
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

run_bin() {
    # run_bin BIN ARGS...: executable directly, otherwise through bash.
    local bin="$1"; shift
    if [ -x "$bin" ]; then "$bin" "$@"; else bash "$bin" "$@"; fi
}

# ledger_row PROVIDER MODE VERDICT RC WALL FINDINGS META_FILE
ledger_row() {
    local tin="" tout="" tthink="" tcache="" ttotal="" model key value
    model="$(model_for "$1")"
    if [ "$1" = "agy" ] && [ -n "$7" ] && [ -s "$7" ]; then
        while IFS== read -r key value; do
            case "$key" in
                model) [ -z "$value" ] || model="$value" ;;
                tokens_in) tin="$value" ;;
                tokens_out) tout="$value" ;;
                tokens_thinking) tthink="$value" ;;
                tokens_cache_read) tcache="$value" ;;
                tokens_total) ttotal="$value" ;;
            esac
        done < "$7"
    fi
    [ "$1" != "agy" ] || [ "$3" != "UNAVAILABLE" ] || model=""
    [ -n "$PY" ] || return 0
    "$PY" "$LEDGER_PY" append --kind qa --mode "$2" --lead "$lead" --provider "$1" \
        --model "$model" --tier "$tier" --verdict "$3" --rc "$4" --wall "$5" \
        --tokens-in "$tin" --tokens-out "$tout" --tokens-thinking "$tthink" \
        --tokens-cache-read "$tcache" --tokens-total "$ttotal" --findings "$6" || true
}

# judge RC FILE: verdict from the exit code AND output line 1. Sets j_rc (0|1|2), j_verdict.
# Line 1 FAIL wins whatever the exit code (never failed over or degraded); exit 0 without a PASS line (empty or verdict-less) is unavailable.
judge() {
    local line
    line="$(head -n 1 -- "$2" 2>/dev/null | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | tr '[:lower:]' '[:upper:]')"
    if [ "$line" = "FAIL" ]; then
        j_rc=1; j_verdict=FAIL
        return 0
    fi
    case "$1" in
        2) j_rc=2; j_verdict=UNAVAILABLE ;;
        0)
            if [ "$line" = "PASS" ]; then j_rc=0; j_verdict=PASS
            else j_rc=2; j_verdict=UNAVAILABLE; fi
            ;;
        *) j_rc=1; j_verdict=FAIL ;;
    esac
}

count_findings() {
    # non-empty lines after line 1 of file $1
    tail -n +2 -- "$1" 2>/dev/null | grep -c '[^[:space:]]' || true
}

# --- argument parsing -----------------------------------------------------------
tier="standard"
both=0
evidence_cmds=()
while [ $# -gt 0 ]; do
    case "$1" in
        --apex) tier="apex"; both=1; shift ;;
        --both) both=1; shift ;;
        --evidence)
            [ $# -ge 2 ] || usage_error "--evidence needs a command argument"
            evidence_cmds+=("$2")
            shift 2
            ;;
        --model|--model=*|--effort|--effort=*)
            usage_error "models are pinned by the wrappers; $1 is not accepted"
            ;;
        *) break ;;
    esac
done
target_arg="${1:-}"

lead="${ATHANOR_PROVIDER:-claude}"
case "$lead" in
    codex) pair_a="claude"; pair_b="agy" ;;
    antigravity) pair_a="codex"; pair_b="claude" ;;
    *) lead="claude"; pair_a="codex"; pair_b="agy" ;;
esac
[ -n "$PY" ] || usage_error "python3/python not found on PATH"
TMPD="$(mktemp -d 2>/dev/null)" || usage_error "could not create temp directory via mktemp -d"

# --- single reviewer (alternate / failover) -------------------------------------
single_run() {
    # single_run PROVIDER MODE: files $single_prefix.out/.err, raw rc, judged rc in $single_rc.
    local provider="$1" mode="$2" bin meta="" start wall verdict findings
    bin="$(bin_for "$provider")"
    single_prefix="$(new_tmp)"
    single_provider="$provider"
    [ "$provider" != "agy" ] || meta="$single_prefix.meta"
    start=$SECONDS
    if [ -e "$bin" ]; then
        QA_LEDGER_BY_CALLER=1 QA_AGY_META_FILE="$meta" run_bin "$bin" \
            ${ev_args[@]+"${ev_args[@]}"} ${single_target[@]+"${single_target[@]}"} \
            < "${stdin_file:-/dev/null}" > "$single_prefix.out" 2> "$single_prefix.err"
        single_raw_rc=$?
    else
        echo "qa.sh: $provider reviewer script not found: $bin" > "$single_prefix.err"
        single_raw_rc=2
    fi
    wall=$((SECONDS - start))
    judge "$single_raw_rc" "$single_prefix.out"
    single_rc="$j_rc"
    verdict="$j_verdict"
    findings=0
    [ "$verdict" != "FAIL" ] || findings="$(count_findings "$single_prefix.out")"
    ledger_row "$provider" "$mode" "$verdict" "$single_rc" "$wall" "$findings" "$meta"
    save_transcript "$provider" "$single_prefix"
}

# print_single: the normalized shape shared with --both, for the run that gave the verdict.
print_single() {
    local overall="PASS"
    [ "$single_rc" -eq 0 ] || overall="FAIL"
    echo "$overall"
    echo "$single_provider: $overall"
    if [ "$overall" = "FAIL" ]; then
        print_findings "$single_provider" "$single_prefix" "$single_raw_rc"
    fi
    printf '%s' "$transcripts"
}

run_single_mode() {
    local first second
    first="$("$PY" "$LEDGER_PY" next --pair "$pair_a,$pair_b" | tr -d '\r')" || first="$pair_a"
    case "$first" in "$pair_a"|"$pair_b") ;; *) first="$pair_a" ;; esac
    if [ "$first" = "$pair_a" ]; then second="$pair_b"; else second="$pair_a"; fi

    single_run "$first" alternate
    if [ "$single_rc" -ne 2 ]; then
        print_single
        exit "$single_rc"
    fi
    echo "qa.sh: $first unavailable, failing over to $second" >&2
    transcripts=""
    single_run "$second" failover
    if [ "$single_rc" -eq 2 ]; then
        echo "qa.sh: both reviewers unavailable ($first, $second)" >&2
        exit 2
    fi
    print_single
    exit "$single_rc"
}

# --- both reviewers in parallel ---------------------------------------------------
build_body() {
    # Resolve the target the way the wrappers do, then run evidence once.
    local cmd evfile rc body
    if [ -n "$target_arg" ]; then
        if [ -f "$target_arg" ] && [ -r "$target_arg" ]; then
            review_body="Review this file for bugs/regressions.

File: ${target_arg}

$(cat -- "$target_arg")"
        else
            review_body="$target_arg"
        fi
    else
        [ ! -t 0 ] || usage_error "no prompt supplied: pass a file path or prompt string, or pipe one via stdin"
        review_body="$(cat -)"
    fi
    [ -n "$review_body" ] || usage_error "resolved prompt is empty"
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

start_reviewer() {
    # start_reviewer PROVIDER PREFIX: background run reading the shared body on stdin.
    local provider="$1" prefix="$2" bin apex_flag="" meta=""
    bin="$(bin_for "$provider")"
    [ "$provider" != "agy" ] || meta="$prefix.meta"
    [ "$tier" != "apex" ] || apex_flag="--apex"
    (
        start=$SECONDS
        if [ -e "$bin" ]; then
            QA_LEDGER_BY_CALLER=1 QA_AGY_META_FILE="$meta" \
                run_bin "$bin" ${apex_flag:+"$apex_flag"} < "$body_file" > "$prefix.out" 2> "$prefix.err"
            echo $? > "$prefix.rc"
        else
            echo "qa.sh: $provider reviewer script not found: $bin" > "$prefix.err"
            echo 2 > "$prefix.rc"
        fi
        echo $((SECONDS - start)) > "$prefix.wall"
    ) &
}

# save_transcript PROVIDER PREFIX: raw stdout+stderr to the scratch log; path into $transcripts.
save_transcript() {
    local dir="${QA_LOG_DIR:-$ROOT_DIR/.agent/memory/scratch}" log
    mkdir -p -- "$dir" 2>/dev/null || return 0
    log="$(mktemp "$dir/qa-$1-$(date +%Y%m%dT%H%M%S)-XXXXXX" 2>/dev/null)" || return 0
    { cat -- "$2.out"; echo "--- stderr ---"; cat -- "$2.err"; } > "$log" 2>/dev/null || return 0
    mv -- "$log" "$log.log" 2>/dev/null && log="$log.log"
    transcripts="$transcripts$log
"
}

collect() {
    # collect PROVIDER PREFIX: sets <provider>_verdict via c_verdict and logs the ledger row.
    local provider="$1" prefix="$2" rc wall findings=0
    rc="$(cat -- "$prefix.rc" 2>/dev/null || echo 2)"
    wall="$(cat -- "$prefix.wall" 2>/dev/null || echo 0)"
    judge "$rc" "$prefix.out"
    c_verdict="$j_verdict"
    [ "$c_verdict" != "FAIL" ] || findings="$(count_findings "$prefix.out")"
    ledger_row "$provider" both "$c_verdict" "$j_rc" "$wall" "$findings" "$prefix.meta"
    save_transcript "$provider" "$prefix"
}

# print_findings PROVIDER PREFIX: lines after line 1, blanks dropped, each distinct line once.
print_findings() {
    local found
    found="$(tail -n +2 -- "$2.out" | tr -d '\r' | grep '[^[:space:]]' | awk '!seen[$0]++')"
    if [ -n "$found" ]; then
        printf '%s\n' "$found" | sed "s/^/[$1] /"
    else
        echo "[$1] reviewer gave no findings (exit ${3:-1})"
    fi
}

run_both_mode() {
    local body_file pa pb va vb overall exit_code
    build_body
    body_file="$(new_tmp)"
    printf '%s\n' "$review_body" > "$body_file"
    pa="$(new_tmp)"; pb="$(new_tmp)"
    start_reviewer "$pair_a" "$pa"
    start_reviewer "$pair_b" "$pb"
    wait
    collect "$pair_a" "$pa"; va="$c_verdict"
    collect "$pair_b" "$pb"; vb="$c_verdict"

    if [ "$va" = "FAIL" ] || [ "$vb" = "FAIL" ]; then
        overall="FAIL"; exit_code=1
    elif [ "$va" = "PASS" ] && [ "$vb" = "PASS" ]; then
        overall="PASS"; exit_code=0
    elif [ "$va" = "UNAVAILABLE" ] && [ "$vb" = "UNAVAILABLE" ]; then
        echo "qa.sh: both reviewers unavailable ($pair_a, $pair_b)" >&2
        exit 2
    elif [ "${QA_BOTH_ALLOW_DEGRADED:-0}" = "1" ]; then
        overall="PASS"; exit_code=0
    else
        echo "qa.sh: --both degraded ($pair_a: $va, $pair_b: $vb); set QA_BOTH_ALLOW_DEGRADED=1 to accept one opinion" >&2
        exit 2
    fi
    echo "$overall"
    echo "$pair_a: $va"
    echo "$pair_b: $vb"
    if [ "$overall" = "FAIL" ]; then
        [ "$va" != "FAIL" ] || print_findings "$pair_a" "$pa"
        [ "$vb" != "FAIL" ] || print_findings "$pair_b" "$pb"
    fi
    printf '%s' "$transcripts"
    exit "$exit_code"
}

# --- dispatch ---------------------------------------------------------------------
if [ "$both" -eq 1 ]; then
    run_both_mode
fi

ev_args=()
for cmd in ${evidence_cmds[@]+"${evidence_cmds[@]}"}; do
    ev_args+=(--evidence "$cmd")
done
single_target=()
stdin_file=""
if [ -n "$target_arg" ]; then
    single_target=("$target_arg")
else
    [ ! -t 0 ] || usage_error "no prompt supplied: pass a file path or prompt string, or pipe one via stdin"
    stdin_file="$(new_tmp)"
    cat - > "$stdin_file"
fi
run_single_mode
