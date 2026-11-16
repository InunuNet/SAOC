#!/usr/bin/env bash
# agy_delegation_test.sh <case> - contract assertions A1-A12 for the agy delegation feature.
# Cases: models verdicts review_readonly live_readonly alternation failover codex_lead both
#        ledger_row dev_isolation dev_apply summary regressions confinement
# Expectations come from .agent/memory/project/specs/agy-delegation/DECISIONS.md and
# goldens/agy_cli_contract.md, never from an implementation. Stubs (agy, codex, claude and the
# qa.sh reviewer wrappers) live in a per-run dir under .tmp/sandbox/agy-tests/; every production
# script runs with cwd = a throwaway git fixture and ATHANOR_DISPATCH_LEDGER pointing at a
# ledger file inside the sandbox, so the real repo, ledger and worktrees are never touched.
# Bash 3.2 compatible (no assoc arrays, no ${v,,}, no mapfile).

CASE="${1:-}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
# Git Bash: mixed form (C:/...) works for bash and for native Windows python; every exported
# path (ledger, QA_LOG_DIR, stub overrides, sandbox roots) derives from REPO via SBX/RUN.
if command -v cygpath >/dev/null 2>&1; then REPO="$(cygpath -m "$REPO")"; fi
SBX="$REPO/.tmp/sandbox/agy-tests"
AGY_QA="$REPO/execution/agy_qa.sh"
AGY_DEV="$REPO/execution/agy_dev.sh"
QA_SH="$REPO/execution/qa.sh"
LEDGER_PY="$REPO/execution/dispatch_ledger.py"
HYDROGEN="gemini-4-hydrogen-high"
ARGON="gemini-4-argon-high"
PY="python3"
command -v python3 >/dev/null 2>&1 || PY="python"
NFAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1 (observed: $2)"; NFAIL=$((NFAIL + 1)); }
expect_eq() { # label expected actual
    if [ "$2" = "$3" ]; then pass "$1 (=$3)"; else fail "$1 expected '$2'" "'$3'"; fi
}
expect_has() { # label haystack needle
    case "$2" in *"$3"*) pass "$1 (has '$3')" ;; *) fail "$1 should contain '$3'" "$(printf '%s' "$2" | head -c 300)" ;; esac
}
expect_lacks() { # label haystack needle
    case "$2" in *"$3"*) fail "$1 must not contain '$3'" "found" ;; *) pass "$1 (lacks '$3')" ;; esac
}
expect_file() { if [ -f "$2" ]; then pass "$1 exists"; else fail "$1 exists" "missing $2"; fi; }

# ---------------------------------------------------------------- stubs and fixture

write_agy_stub() { # $1 = bin dir
    cat > "$1/agy" <<'STUB'
#!/usr/bin/env bash
# stub agy: records argv, emits the golden JSON shapes. Env: STUB_AGY_MODE STUB_AGY_LOG
# STUB_AGY_USAGE_PCT STUB_AGY_ARGON_PCT STUB_AGY_APPEND STUB_AGY_ESCAPE_PATH STUB_AGY_CRLF
# STUB_AGY_WRITE_ABS (absolute paths to write) STUB_AGY_REL_WRITES (paths relative to cwd)
log="${STUB_AGY_LOG:-/dev/null}"
if [ "${STUB_AGY_CRLF:-}" = 1 ]; then exec > >(awk '{printf "%s\r\n", $0}'); fi
prompt=""; settings=""; prev=""
for a in "$@"; do
    case "$prev" in -p|--prompt) prompt="$a" ;; --settings) settings="$a" ;; esac
    prev="$a"
done
if [ "$prompt" = "/usage" ]; then
    { echo usage; for a in "$@"; do printf '<<%s>>\n' "$a"; done
      echo "ENV MSYS_NO_PATHCONV=${MSYS_NO_PATHCONV:-} MSYS2_ARG_CONV_EXCL=${MSYS2_ARG_CONV_EXCL:-}"; } 2>/dev/null >> "$log.usage"
    p="${STUB_AGY_USAGE_PCT:-98}"; ap="${STUB_AGY_ARGON_PCT:-100}"
    printf '{"conversation_id":"u","status":"SUCCESS","response":"Gemini Models\\tWeekly Limit Remaining\\t%s%%\\t2026-11-22T17:56:45Z\\nGemini Models\\tFive Hour Limit Remaining\\t%s%%\\t2026-11-15T22:00:00Z\\nClaude and GPT models\\tWeekly Limit Remaining\\t99%%\\t2026-11-22T17:56:45Z\\nClaude and GPT models\\tFive Hour Limit Remaining\\t97%%\\t2026-11-15T22:00:00Z\\nGemini 4 Argon\\tGemini 4 Argon Weekly Limit\\t%s%%\\t2026-11-22T17:56:45Z","duration_seconds":0,"num_turns":0}\n' "$p" "$p" "$ap"
    exit 0
fi
{ echo "=== CALL"; echo "PWD:$(pwd)"; for a in "$@"; do printf '<<%s>>\n' "$a"; done; } 2>/dev/null >> "$log"
if [ -f "$settings" ]; then cat "$settings" 2>/dev/null > "$log.settings"; else printf '%s' "$settings" 2>/dev/null > "$log.settings"; fi
for f in ${STUB_AGY_REL_WRITES:-}; do echo w 2>/dev/null > "$f"; done
for f in ${STUB_AGY_APPEND:-}; do echo "agy edit" >> "$f"; done
for f in ${STUB_AGY_WRITE_ABS:-}; do mkdir -p "$(dirname "$f")"; sleep 1; echo w > "$f"; done
if [ -n "${STUB_AGY_ESCAPE_PATH:-}" ]; then sleep 1; echo escaped > "$STUB_AGY_ESCAPE_PATH"; fi
U='"usage":{"input_tokens":12494,"output_tokens":52,"thinking_tokens":47,"cache_read_tokens":0,"total_tokens":12546}'
H='"conversation_id":"6ec9ebb6-b251-42f1-8f52-699598b6fb3f"'
case "${STUB_AGY_MODE:-pass}" in
    pass) printf '{%s,"status":"SUCCESS","response":"PASS\\n","duration_seconds":2.43,"num_turns":1,%s}\n' "$H" "$U" ;;
    fail) printf '{%s,"status":"SUCCESS","response":"FAIL\\nx.py:3 bug\\n","duration_seconds":2.43,"num_turns":1,%s}\n' "$H" "$U" ;;
    lower) printf '{%s,"status":"SUCCESS","response":"  pass \\n","duration_seconds":2.43,"num_turns":1,%s}\n' "$H" "$U" ;;
    noverdict) printf '{%s,"status":"SUCCESS","response":"looks fine","duration_seconds":2.43,"num_turns":1,%s}\n' "$H" "$U" ;;
    denied) printf '{%s,"status":"SUCCESS","response":"","duration_seconds":5.4,"num_turns":1,%s,"denied_actions":[{"action":"write_file","display_name":"Edit"}]}\n' "$H" "$U" ;;
    unavail) echo "quota exhausted" >&2
        printf '{"conversation_id":"","status":"ERROR","response":"","error":"quota exhausted"}\n'; exit 1 ;;
    auth) echo "authentication required" >&2
        printf '{"conversation_id":"","status":"ERROR","response":"","error":"authentication required"}\n'; exit 1 ;;
    timeout) printf '{%s,"status":"ERROR","response":"","error":"print timeout after 4s with the turn still in progress; the response is partial","duration_seconds":2.65,"num_turns":1,%s,"finished_reason":"print_timeout"}\n' "$H" "$U"; exit 3 ;;
    garbage) echo "not json" ;;
esac
STUB
    chmod +x "$1/agy"
}

write_tool_stubs() { # $1 = bin dir: codex and claude recorders (never reach the network)
    cat > "$1/codex" <<'STUB'
#!/usr/bin/env bash
echo "codex $*" >> "${STUB_CODEX_LOG:-/dev/null}"
prev=""; for a in "$@"; do [ "$prev" = "-o" ] && echo PASS > "$a"; prev="$a"; done
exit 0
STUB
    cat > "$1/claude" <<'STUB'
#!/usr/bin/env bash
echo "claude $*" >> "${STUB_CLAUDE_LOG:-/dev/null}"
echo PASS
exit 0
STUB
    chmod +x "$1/codex" "$1/claude"
}

write_wrapper_stub() { # $1 = dir, $2 = name (codex|agy|claude), $3 = NAME upper
    cat > "$1/${2}_qa.sh" <<STUB
#!/usr/bin/env bash
echo "$2" >> "$1/order"
{ echo "=== ARGS: \$*"; } >> "$1/$2.calls"
for a in "\$@"; do [ -f "\$a" ] && cat "\$a" >> "$1/$2.calls"; done
if [ ! -t 0 ]; then cat >> "$1/$2.calls"; fi
if [ "$2" = agy ] && [ -n "\${QA_AGY_META_FILE:-}" ]; then
    printf 'model=gemini-4-hydrogen-high\ntokens_in=12494\ntokens_out=52\ntokens_thinking=47\ntokens_cache_read=0\ntokens_total=12546\n' > "\$QA_AGY_META_FILE"
fi
[ -z "\${STUB_NOISE:-}" ] || echo "NOISE-from-$2" >&2
case "\${STUB_${3}_RESULT:-PASS}" in
    PASS) echo PASS; exit 0 ;;
    FAIL) echo FAIL; echo "$2.c:1 finding from $2"; exit 1 ;;
    FAILRC0) echo FAIL; echo "$2.c:1 finding from $2"; exit 0 ;;
    EMPTY) exit 0 ;;
    PASSRC1) printf 'PASS\n'; exit 1 ;;
    FAILRC2) echo FAIL; echo "$2.c:1 finding from $2"; exit 2 ;;
    *) echo "$2: out of quota" >&2; exit 2 ;;
esac
STUB
    chmod +x "$1/${2}_qa.sh"
}

make_fixture() { # $1 = dir; tiny git repo with a tracked app.txt, init.sh and the real matrix
    mkdir -p "$1"
    (
        cd "$1" || exit 1
        unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
        git init -q . && git config user.email t@example.invalid && git config user.name t
        mkdir -p .agent/memory/scratch .agent/memory/project/telemetry src
        cp "$REPO/.agent/autonomy_matrix.json" .agent/autonomy_matrix.json
        echo base > app.txt
        printf '#!/bin/sh\necho init\n' > init.sh
        printf '.tmp/\n' > .gitignore
        git add -A && git commit -q -m init
    )
}

setup_common() {
    RUN="$SBX/run-$CASE-$$"
    mkdir -p "$RUN/bin" "$RUN/w"
    FX="$RUN/fx"
    make_fixture "$FX"
    write_agy_stub "$RUN/bin"
    write_tool_stubs "$RUN/bin"
    LEDGER="$RUN/dispatch.jsonl"; : > "$LEDGER"
    WDIR="$RUN/w"
    STUB_AGY_LOG="$RUN/agy.log"; : > "$STUB_AGY_LOG"
    export STUB_AGY_LOG ATHANOR_DISPATCH_LEDGER="$LEDGER" ATHANOR_PROVIDER=claude
    export STUB_CODEX_LOG="$RUN/codex.log" STUB_CLAUDE_LOG="$RUN/claude.log"
    export PATH="$RUN/bin:$PATH"
    mkdir -p "$RUN/qalogs"
    export QA_LOG_DIR="$RUN/qalogs"
    unset QA_LEDGER_BY_CALLER QA_BOTH_ALLOW_DEGRADED STUB_AGY_MODE STUB_AGY_APPEND STUB_AGY_ESCAPE_PATH
    unset STUB_AGY_USAGE_PCT STUB_AGY_ARGON_PCT STUB_AGY_CRLF STUB_AGY_WRITE_ABS STUB_AGY_REL_WRITES AGY_DEV_UNCONFINED
    unset MSYS_NO_PATHCONV MSYS2_ARG_CONV_EXCL TMPDIR AGY_MODEL AGY_QA_MODEL AGY_DEV_MODEL
}

setup_wrappers() { # stub reviewer wrappers for qa.sh (override env names per the golden)
    write_wrapper_stub "$WDIR" codex CODEX
    write_wrapper_stub "$WDIR" agy AGY
    write_wrapper_stub "$WDIR" claude CLAUDE
    export QA_CODEX_BIN="$WDIR/codex_qa.sh" QA_AGY_BIN="$WDIR/agy_qa.sh" QA_CLAUDE_BIN="$WDIR/claude_qa.sh"
    : > "$WDIR/order"
}

run_cap() { # run a command in the fixture; sets OUT ERR RC
    OUT="$(cd "$FX" && "$@" 2>"$RUN/err" </dev/null)"
    RC=$?
    ERR="$(cat "$RUN/err")"
}

# argv helpers over the agy stub log
log_all() { cat "$STUB_AGY_LOG"; }
log_has_pair() { # flag value
    awk -v f="<<$1>>" -v v="<<$2>>" 'p==f && $0==v {found=1} {p=$0} END {exit !found}' "$STUB_AGY_LOG"
}
log_has_arg() { grep -qxF "<<$1>>" "$STUB_AGY_LOG"; }
log_calls() { grep -c '^=== CALL' "$STUB_AGY_LOG"; }
models_in() { grep -oE 'gemini-[a-z0-9]+(-[a-z0-9]+)*' "$1" 2>/dev/null | sort -u | tr '\n' ' '; }

row_get() { # row-index key (0-based) -> value or null
    "$PY" -c 'import json,sys
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
v=rows[int(sys.argv[2])][sys.argv[3]]
print("null" if v is None else v)' "$LEDGER" "$1" "$2" 2>/dev/null
}
row_count() { grep -c . "$LEDGER" 2>/dev/null || echo 0; }
order() { tr '\n' ' ' < "$WDIR/order" | sed 's/ $//'; }

need_script() { if [ -f "$1" ]; then pass "exists $(basename "$1")"; else fail "exists $(basename "$1")" "missing"; fi; }

# ---------------------------------------------------------------- cases

case_models() {
    local f out s
    for f in "$AGY_QA" "$AGY_DEV" "$QA_SH" "$LEDGER_PY"; do need_script "$f"; done
    out="$(grep -c 'agy_models.py' "$AGY_QA" "$AGY_DEV" "$QA_SH" | tr '\n' ' ')"
    expect_lacks "agy scripts resolve models via agy_models.py" "$out" ":0"
    expect_eq "agy_models.py tier flash is hydrogen" "$HYDROGEN" "$("$PY" "$REPO/execution/agy_models.py" tier flash)"
    expect_eq "agy_models.py tier apex is argon" "$ARGON" "$("$PY" "$REPO/execution/agy_models.py" tier apex)"
    out="$(models_in "$AGY_DEV")"
    expect_eq "agy_dev.sh has no hardcoded model id" "" "$out"
    for f in "$AGY_QA" "$AGY_DEV" "$QA_SH" "$LEDGER_PY" "$REPO/execution/agy_result.py"; do
        [ -f "$f" ] || continue
        out="$(grep -oE 'gemini-[a-z0-9]+(-[a-z0-9]+)*' "$f" | sort -u | grep -vx "$HYDROGEN" | grep -vx "$ARGON" | tr '\n' ' ')"
        expect_eq "$(basename "$f") has no other google model id" "" "$out"
        if grep -qiE 'gemini-[0-9]+-flash' "$f"; then fail "$(basename "$f") has no 'flash'" "$(grep -iE -m1 'gemini-[0-9]+-flash' "$f")"; else pass "$(basename "$f") has no 'flash'"; fi
    done
    setup_common
    : > "$STUB_AGY_LOG"
    run_cap bash "$AGY_QA" --model gemini-9-nope "prompt"
    expect_eq "agy_qa.sh rejects --model override rc" "2" "$RC"
    run_cap bash "$AGY_DEV" run --task t --id m1 --model gemini-3-flash
    expect_eq "agy_dev.sh rejects --model override rc" "2" "$RC"
    : > "$STUB_AGY_LOG"
    run_cap env AGY_MODEL=gemini-3-flash AGY_QA_MODEL=gemini-3-flash bash "$AGY_QA" "prompt"
    s="$(models_in "$STUB_AGY_LOG")"
    expect_lacks "env override never reaches agy argv" "$s" "flash"
    expect_lacks "env override never reaches agy argv" "$s" "gemini-3"
}

vcase() { # mode expected_line1 expected_rc extra_pattern
    : > "$STUB_AGY_LOG"
    run_cap env STUB_AGY_MODE="$1" bash "$AGY_QA" "review this"
    local l1; l1="$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "verdicts[$1] rc" "$3" "$RC"
    expect_eq "verdicts[$1] stdout line 1" "$2" "$l1"
    if [ "$3" = "2" ]; then
        expect_eq "verdicts[$1] stdout empty" "" "$OUT"
        if [ -n "$ERR" ]; then pass "verdicts[$1] reason on stderr"; else fail "verdicts[$1] reason on stderr" "empty stderr"; fi
    fi
    if [ -n "${4:-}" ]; then expect_has "verdicts[$1] stdout" "$OUT" "$4"; fi
}

case_verdicts() {
    need_script "$AGY_QA"
    setup_common
    vcase pass PASS 0
    vcase fail FAIL 1 "x.py:3 bug"
    vcase lower PASS 0
    vcase noverdict FAIL 1
    local n; n="$(printf '%s\n' "$OUT" | sed -n '2,$p' | grep -c .)"
    if [ "$n" -ge 1 ]; then pass "verdicts[noverdict] fail-safe line follows"; else fail "verdicts[noverdict] fail-safe line follows" "$n lines"; fi
    vcase denied "" 2
    vcase unavail "" 2
    vcase auth "" 2
    vcase timeout FAIL 1
    n="$(printf '%s\n' "$OUT" | sed -n '2,$p' | grep -c .)"
    if [ "$n" -ge 1 ]; then pass "verdicts[timeout] fail-safe line follows"; else fail "verdicts[timeout] fail-safe line follows" "$n lines"; fi
    vcase garbage FAIL 1
    # agy missing from PATH
    mkdir -p "$RUN/nobin"
    local t p
    for t in bash sh env python3 python cat grep sed tr head tail mktemp rm date dirname basename awk sort uniq mkdir git find wc cut sleep ls cp mv tee expr xargs touch uname readlink cygpath; do
        p="$(PATH="${PATH#"$RUN/bin:"}" command -v "$t" 2>/dev/null)" || continue
        ln -s "$p" "$RUN/nobin/$t" 2>/dev/null || cp "$p" "$RUN/nobin/$t"
    done
    run_cap env PATH="$RUN/nobin" bash "$AGY_QA" "review this"
    expect_eq "verdicts[missing agy] rc" "2" "$RC"
    expect_eq "verdicts[missing agy] stdout empty" "" "$OUT"
    # advisory /usage preflight: <=3% remaining spends no turn
    : > "$STUB_AGY_LOG"
    run_cap env STUB_AGY_USAGE_PCT=2 bash "$AGY_QA" "review this"
    expect_eq "preflight hydrogen 2% remaining rc" "2" "$RC"
    expect_eq "preflight spent no review turn" "0" "$(log_calls)"
    : > "$STUB_AGY_LOG"
    run_cap env STUB_AGY_ARGON_PCT=1 bash "$AGY_QA" --apex "review this"
    expect_eq "preflight argon 1% remaining rc (apex)" "2" "$RC"
    expect_eq "preflight argon spent no review turn" "0" "$(log_calls)"
    : > "$STUB_AGY_LOG"
    run_cap env STUB_AGY_ARGON_PCT=1 bash "$AGY_QA" "review this"
    expect_eq "argon bucket does not gate standard run rc" "0" "$RC"
}

case_review_readonly() {
    need_script "$AGY_QA"
    setup_common
    : > "$STUB_AGY_LOG"
    run_cap bash "$AGY_QA" "review this"
    expect_eq "standard rc" "0" "$RC"
    if log_has_pair --model "$HYDROGEN"; then pass "standard run argv has --model $HYDROGEN"; else fail "standard run argv has --model $HYDROGEN" "$(log_all | tr '\n' ' ' | head -c 300)"; fi
    expect_eq "standard run has exactly one --model" "1" "$(grep -cxF '<<--model>>' "$STUB_AGY_LOG")"
    log_has_pair --output-format json && pass "argv has --output-format json" || fail "argv has --output-format json" "absent"
    log_has_arg --print-timeout && pass "argv has --print-timeout" || fail "argv has --print-timeout" "absent"
    log_has_arg --settings && pass "argv has --settings" || fail "argv has --settings" "absent"
    log_has_arg --dangerously-skip-permissions && fail "no --dangerously-skip-permissions" "present" || pass "no --dangerously-skip-permissions"
    log_has_arg --mode && fail "no --mode flag" "present" || pass "no --mode flag"
    local st; st="$(cat "$STUB_AGY_LOG.settings" 2>/dev/null)"
    local d
    for d in 'write_file(*)' 'command(*)' 'mcp(*)' 'execute_url(*)' 'download_url(*)' 'read_url(*)'; do
        expect_has "review settings deny" "$st" "$d"
    done
    printf '%s' "$st" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); assert "write_file(*)" in d["permissions"]["deny"]' 2>/dev/null \
        && pass "review settings is valid JSON permissions.deny" || fail "review settings is valid JSON permissions.deny" "$st"
    expect_eq "standard argv models" "$HYDROGEN " "$(models_in "$STUB_AGY_LOG")"
    : > "$STUB_AGY_LOG"
    run_cap bash "$AGY_QA" --apex "review this"
    if log_has_pair --model "$ARGON"; then pass "apex run argv has --model $ARGON"; else fail "apex run argv has --model $ARGON" "$(log_all | tr '\n' ' ' | head -c 300)"; fi
    expect_eq "apex argv models" "$ARGON " "$(models_in "$STUB_AGY_LOG")"
    log_has_arg --dangerously-skip-permissions && fail "apex: no skip-permissions" "present" || pass "apex: no skip-permissions"
    log_has_arg --mode && fail "apex: no --mode" "present" || pass "apex: no --mode"
}

case_live_readonly() {
    if ! command -v agy >/dev/null 2>&1; then echo "SKIP: agy not installed"; exit 0; fi
    local LR="$SBX/live-$$" st rc stray resp
    mkdir -p "$LR"
    make_fixture "$LR/fx"
    st='{"permissions":{"deny":["write_file(*)","command(*)","mcp(*)","execute_url(*)","download_url(*)","read_url(*)"]}}'
    : > "$LR/marker"
    sleep 1
    resp="$(cd "$LR/fx" && command agy -p "Create a file named live_probe.txt in the current directory containing the word hi, then reply done." \
        --model "$HYDROGEN" --output-format json --print-timeout 3m --settings "$st" 2>"$LR/err" </dev/null)"
    rc=$?
    expect_eq "live agy rc" "0" "$rc"
    if [ ! -e "$LR/fx/live_probe.txt" ]; then pass "live_probe.txt was not created"; else fail "live_probe.txt was not created" "file exists"; fi
    stray="$(cd "$LR/fx" && find . -type f -newer "$LR/marker" -not -path './.git/*' 2>/dev/null | tr '\n' ' ')"
    expect_eq "no file written or modified under the fixture" "" "$stray"
    expect_has "live response is JSON with status" "$resp" '"status"'
}

# qa.sh runs ---------------------------------------------------------------
qa() { run_cap bash "$QA_SH" "$@"; }

case_alternation() {
    need_script "$QA_SH"
    setup_common; setup_wrappers
    qa "review this"; qa "review this"; qa "review this"
    expect_eq "alternation order (empty ledger -> codex first)" "codex agy codex" "$(order)"
    expect_eq "ledger rows (one per run)" "3" "$(row_count)"
    expect_eq "row 0 mode" "alternate" "$(row_get 0 mode)"
}

case_failover() {
    need_script "$QA_SH"
    setup_common; setup_wrappers
    run_cap env STUB_CODEX_RESULT=UNAVAIL bash "$QA_SH" "review this"
    expect_eq "codex unavailable -> agy decides, rc" "0" "$RC"
    expect_eq "codex unavailable -> stdout" "PASS" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "failover order" "codex agy" "$(order)"
    expect_eq "ledger has the failed attempt and the verdict row" "2" "$(row_count)"
    expect_eq "row 0 provider" "codex" "$(row_get 0 provider)"
    expect_eq "row 0 verdict" "UNAVAILABLE" "$(row_get 0 verdict)"
    expect_eq "row 1 provider" "agy" "$(row_get 1 provider)"
    expect_eq "row 1 verdict" "PASS" "$(row_get 1 verdict)"
    # a real FAIL is never retried on the other reviewer
    : > "$LEDGER"; : > "$WDIR/order"
    run_cap env STUB_CODEX_RESULT=FAIL bash "$QA_SH" "review this"
    expect_eq "FAIL is final, rc" "1" "$RC"
    expect_eq "FAIL line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "FAIL not retried on the other reviewer" "codex" "$(order)"
    # both unavailable
    : > "$LEDGER"; : > "$WDIR/order"
    run_cap env STUB_CODEX_RESULT=UNAVAIL STUB_AGY_RESULT=UNAVAIL bash "$QA_SH" "review this"
    expect_eq "both unavailable rc" "2" "$RC"
    expect_eq "both unavailable stdout empty" "" "$OUT"
    expect_eq "both tried exactly once" "codex agy" "$(order)"
    # missing binary counts as unavailable
    : > "$LEDGER"; : > "$WDIR/order"
    run_cap env QA_CODEX_BIN="$WDIR/does-not-exist" bash "$QA_SH" "review this"
    expect_eq "missing codex binary fails over, rc" "0" "$RC"
    expect_eq "missing codex binary: agy ran" "agy" "$(order)"
}

case_codex_lead() {
    need_script "$QA_SH"
    setup_common; setup_wrappers
    run_cap env ATHANOR_PROVIDER=codex bash "$QA_SH" "review this"
    run_cap env ATHANOR_PROVIDER=codex bash "$QA_SH" "review this"
    expect_eq "codex lead pairs claude_qa with agy_qa (claude first)" "claude agy" "$(order)"
    if grep -qx codex "$WDIR/order"; then fail "codex_qa not used when codex leads" "codex ran"; else pass "codex_qa not used when codex leads"; fi
    : > "$LEDGER"; : > "$WDIR/order"
    run_cap env ATHANOR_PROVIDER=codex STUB_CLAUDE_RESULT=UNAVAIL bash "$QA_SH" "review this"
    expect_eq "codex lead failover claude -> agy" "claude agy" "$(order)"
    expect_eq "codex lead failover rc" "0" "$RC"
    expect_eq "row 0 lead" "codex" "$(row_get 0 lead)"
}

case_both() {
    need_script "$QA_SH"
    setup_common; setup_wrappers
    run_cap bash "$QA_SH" --both "review this"
    expect_eq "both PASS rc" "0" "$RC"
    expect_eq "both PASS line 1" "PASS" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "both ran exactly once each" "agy codex" "$(sort "$WDIR/order" | tr '\n' ' ' | sed 's/ $//')"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_AGY_RESULT=FAIL bash "$QA_SH" --both "review this"
    expect_eq "one FAIL rc" "1" "$RC"
    expect_eq "one FAIL line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_has "per-provider verdict line codex" "$OUT" "codex: PASS"
    expect_has "per-provider verdict line agy" "$OUT" "agy: FAIL"
    expect_has "findings prefixed with provider" "$OUT" "[agy]"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=UNAVAIL bash "$QA_SH" --both "review this"
    expect_eq "one UNAVAILABLE + one PASS rc (degraded)" "2" "$RC"
    run_cap env STUB_CODEX_RESULT=UNAVAIL QA_BOTH_ALLOW_DEGRADED=1 bash "$QA_SH" --both "review this"
    expect_eq "QA_BOTH_ALLOW_DEGRADED=1 rc" "0" "$RC"
    expect_eq "QA_BOTH_ALLOW_DEGRADED=1 line 1" "PASS" "$(printf '%s\n' "$OUT" | head -n 1)"
    run_cap env STUB_CODEX_RESULT=UNAVAIL STUB_AGY_RESULT=FAIL bash "$QA_SH" --both "review this"
    expect_eq "UNAVAILABLE + FAIL rc" "1" "$RC"
    # --apex implies --both
    : > "$WDIR/order"; : > "$WDIR/codex.calls"; : > "$WDIR/agy.calls"
    run_cap bash "$QA_SH" --apex "review this"
    expect_eq "--apex ran both once each" "agy codex" "$(sort "$WDIR/order" | tr '\n' ' ' | sed 's/ $//')"
    expect_has "--apex forwarded to codex wrapper" "$(cat "$WDIR/codex.calls")" "--apex"
    expect_has "--apex forwarded to agy wrapper" "$(cat "$WDIR/agy.calls")" "--apex"
    # evidence runs once even with --both, and reaches both reviewers in the prompt
    : > "$WDIR/order"; : > "$WDIR/codex.calls"; : > "$WDIR/agy.calls"; : > "$RUN/ev.count"
    run_cap bash "$QA_SH" --both --evidence "echo x >> '$RUN/ev.count'; echo EVIDENCE_OUT_MARK" "review this"
    expect_eq "evidence command ran once" "1" "$(grep -c . "$RUN/ev.count")"
    expect_has "evidence in codex prompt" "$(cat "$WDIR/codex.calls")" "EVIDENCE_OUT_MARK"
    expect_has "evidence in agy prompt" "$(cat "$WDIR/agy.calls")" "EVIDENCE_OUT_MARK"
    expect_lacks "wrappers get no --evidence flag (codex)" "$(cat "$WDIR/codex.calls")" "--evidence"
    expect_lacks "wrappers get no --evidence flag (agy)" "$(cat "$WDIR/agy.calls")" "--evidence"
}

case_ledger_row() {
    need_script "$AGY_QA"; need_script "$LEDGER_PY"
    setup_common
    run_cap bash "$AGY_QA" "review this"
    expect_eq "direct pass: one row" "1" "$(row_count)"
    local k
    for k in schema ts kind mode lead provider model tier verdict rc wall_seconds tokens_in tokens_out \
        tokens_thinking tokens_cache_read tokens_total findings mission id; do
        if [ "$(row_get 0 "$k")" = "" ]; then fail "row key present: $k" "missing"; else pass "row key present: $k"; fi
    done
    expect_eq "schema" "athanor.dispatch/v1" "$(row_get 0 schema)"
    expect_eq "kind" "qa" "$(row_get 0 kind)"
    expect_eq "mode (direct call)" "direct" "$(row_get 0 mode)"
    expect_eq "lead" "claude" "$(row_get 0 lead)"
    expect_eq "provider" "agy" "$(row_get 0 provider)"
    expect_eq "model" "$HYDROGEN" "$(row_get 0 model)"
    expect_eq "tier" "standard" "$(row_get 0 tier)"
    expect_eq "verdict" "PASS" "$(row_get 0 verdict)"
    expect_eq "rc" "0" "$(row_get 0 rc)"
    expect_eq "tokens_in" "12494" "$(row_get 0 tokens_in)"
    expect_eq "tokens_out" "52" "$(row_get 0 tokens_out)"
    expect_eq "tokens_thinking" "47" "$(row_get 0 tokens_thinking)"
    expect_eq "tokens_cache_read" "0" "$(row_get 0 tokens_cache_read)"
    expect_eq "tokens_total" "12546" "$(row_get 0 tokens_total)"
    expect_eq "findings (PASS)" "0" "$(row_get 0 findings)"
    : > "$LEDGER"
    run_cap env STUB_AGY_MODE=fail bash "$AGY_QA" "review this"
    expect_eq "fail row verdict" "FAIL" "$(row_get 0 verdict)"
    expect_eq "fail row findings" "1" "$(row_get 0 findings)"
    expect_eq "fail row rc" "1" "$(row_get 0 rc)"
    : > "$LEDGER"
    run_cap bash "$AGY_QA" --apex "review this"
    expect_eq "apex row tier" "apex" "$(row_get 0 tier)"
    expect_eq "apex row model" "$ARGON" "$(row_get 0 model)"
    # one row per reviewer run under qa.sh: the real agy_qa.sh must not double-log
    if [ -f "$QA_SH" ]; then
        : > "$LEDGER"; : > "$STUB_AGY_LOG"
        write_wrapper_stub "$WDIR" codex CODEX
        run_cap env QA_CODEX_BIN="$WDIR/codex_qa.sh" QA_AGY_BIN="$AGY_QA" bash "$QA_SH" --both "review this"
        expect_eq "qa.sh --both with real agy_qa.sh: one row per reviewer" "2" "$(row_count)"
        expect_eq "qa.sh --both rows are mode both" "both" "$(row_get 0 mode)"
    else
        fail "qa.sh ledger rows" "execution/qa.sh missing"
    fi
}

dev_run() { # id [env ...]
    local id="$1"; shift
    run_cap env "$@" bash "$AGY_DEV" run --task "Append a line to app.txt" --id "$id" --timeout 5m
}
assert_unconfined_result() { # id: stub cases run with AGY_DEV_UNCONFINED=1 and say so
    local f="$FX/.agent/memory/scratch/agy-dev-$1-result.md"
    expect_has "result($1) first line says UNCONFINED" "$(head -n 1 "$f" 2>/dev/null)" "UNCONFINED"
    expect_has "result($1) records '- confinement: none'" "$(cat "$f" 2>/dev/null)" "- confinement: none"
}
tracked_status() { git -C "$FX" status --porcelain --untracked-files=no; }

case_dev_isolation() {
    need_script "$AGY_DEV"
    setup_common
    export AGY_DEV_UNCONFINED=1
    local before wt
    before="$(tracked_status)"
    : > "$STUB_AGY_LOG"
    dev_run iso1 STUB_AGY_APPEND=app.txt
    wt="$FX/.tmp/sandbox/agy-dev/iso1/wt"
    expect_eq "run rc" "0" "$RC"
    if [ -d "$wt" ]; then pass "worktree created at .tmp/sandbox/agy-dev/iso1/wt"; else fail "worktree created" "missing $wt"; fi
    expect_eq "main app.txt untouched" "base" "$(cat "$FX/app.txt")"
    expect_has "wt app.txt has the agy edit" "$(cat "$wt/app.txt" 2>/dev/null)" "agy edit"
    expect_eq "main tracked status unchanged" "$before" "$(tracked_status)"
    expect_file "result file" "$FX/.agent/memory/scratch/agy-dev-iso1-result.md"
    assert_unconfined_result iso1
    expect_has "branch agy/iso1 exists" "$(git -C "$FX" branch --list 'agy/iso1')" "agy/iso1"
    case "$(grep -m1 '^PWD:' "$STUB_AGY_LOG")" in
        *"/.tmp/sandbox/agy-dev/iso1/wt") pass "agy ran with cwd = the worktree" ;;
        *) fail "agy ran with cwd = the worktree" "$(grep -m1 '^PWD:' "$STUB_AGY_LOG")" ;;
    esac
    if log_has_pair --model "$HYDROGEN"; then pass "dev argv --model $HYDROGEN"; else fail "dev argv --model $HYDROGEN" "$(log_all | tr '\n' ' ' | head -c 300)"; fi
    expect_eq "dev argv models exactly hydrogen" "$HYDROGEN " "$(models_in "$STUB_AGY_LOG")"
    expect_eq "dev argv has exactly one --model" "1" "$(grep -cxF '<<--model>>' "$STUB_AGY_LOG")"
    log_has_arg --dangerously-skip-permissions && fail "dev: no --dangerously-skip-permissions" "present" || pass "dev: no --dangerously-skip-permissions"
    log_has_pair --output-format json && pass "dev argv --output-format json" || fail "dev argv --output-format json" "absent"
    local st d; st="$(cat "$STUB_AGY_LOG.settings" 2>/dev/null)"
    for d in 'command(*)' 'read_url(*)' 'execute_url(*)' 'download_url(*)' 'mcp(*)'; do
        expect_has "dev settings deny" "$st" "$d"
    done
    expect_has "dev settings protect .env" "$st" ".env"
    printf '%s' "$st" | "$PY" -c 'import json,sys; d=json.load(sys.stdin); assert "command(*)" in d["permissions"]["deny"]' 2>/dev/null \
        && pass "dev settings is valid JSON permissions.deny with command(*)" || fail "dev settings is valid JSON permissions.deny with command(*)" "$st"
    expect_eq "ledger row kind (dev)" "dev" "$(row_get 0 kind)"
    expect_eq "ledger row provider (dev)" "agy" "$(row_get 0 provider)"
    expect_eq "ledger row id (dev)" "iso1" "$(row_get 0 id)"
    expect_eq "ledger row verdict (dev)" "DONE" "$(row_get 0 verdict)"
    # ../ escape detection
    before="$(tracked_status)"
    dev_run iso2 STUB_AGY_APPEND=app.txt STUB_AGY_ESCAPE_PATH="$FX/escaped.txt"
    expect_eq "escape: rc" "1" "$RC"
    expect_has "escape: result file says ESCAPED" "$(cat "$FX/.agent/memory/scratch/agy-dev-iso2-result.md" 2>/dev/null)" "ESCAPED"
    expect_eq "escape: main tracked status unchanged" "$before" "$(tracked_status)"
    expect_eq "escape: main app.txt untouched" "base" "$(cat "$FX/app.txt")"
    # agy missing
    mkdir -p "$RUN/nobin"
    local t p
    for t in bash sh env python3 python cat grep sed tr head tail mktemp rm date dirname basename awk sort uniq mkdir git find wc cut sleep ls cp mv tee expr xargs touch uname readlink cygpath; do
        p="$(PATH="${PATH#"$RUN/bin:"}" command -v "$t" 2>/dev/null)" || continue
        ln -s "$p" "$RUN/nobin/$t" 2>/dev/null || cp "$p" "$RUN/nobin/$t"
    done
    run_cap env PATH="$RUN/nobin" bash "$AGY_DEV" run --task t --id iso4
    expect_eq "agy missing rc" "2" "$RC"
}

case_dev_apply() {
    need_script "$AGY_DEV"
    setup_common
    export AGY_DEV_UNCONFINED=1
    local head0
    head0="$(git -C "$FX" rev-parse HEAD)"
    # clean diff applies uncommitted
    dev_run ap1 STUB_AGY_APPEND=app.txt
    expect_eq "clean run rc" "0" "$RC"
    assert_unconfined_result ap1
    run_cap bash "$AGY_DEV" apply --id ap1
    expect_eq "apply clean rc" "0" "$RC"
    expect_has "app.txt carries the agy edit in main" "$(cat "$FX/app.txt")" "agy edit"
    expect_eq "apply leaves HEAD unchanged (uncommitted)" "$head0" "$(git -C "$FX" rev-parse HEAD)"
    if git -C "$FX" diff --quiet; then fail "applied change is an uncommitted working-tree diff" "no diff"; else pass "applied change is an uncommitted working-tree diff"; fi
    git -C "$FX" checkout -q -- app.txt
    # floor-protected path rejected, nothing applied
    dev_run ap2 STUB_AGY_APPEND=init.sh
    run_cap bash "$AGY_DEV" apply --id ap2
    expect_eq "apply protected path rc" "1" "$RC"
    expect_eq "protected init.sh untouched in main" "$(printf '#!/bin/sh\necho init')" "$(cat "$FX/init.sh")"
    if [ -n "$ERR" ]; then pass "protected rejection reason on stderr"; else fail "protected rejection reason on stderr" "empty"; fi
    # a mixed diff is rejected as a whole
    dev_run ap3 "STUB_AGY_APPEND=app.txt init.sh"
    run_cap bash "$AGY_DEV" apply --id ap3
    expect_eq "apply mixed diff rc" "1" "$RC"
    expect_eq "mixed diff: app.txt untouched in main" "base" "$(cat "$FX/app.txt")"
    expect_eq "mixed diff: HEAD unchanged" "$head0" "$(git -C "$FX" rev-parse HEAD)"
    # discard removes worktree and branch
    run_cap bash "$AGY_DEV" discard --id ap1
    expect_eq "discard rc" "0" "$RC"
    if [ -d "$FX/.tmp/sandbox/agy-dev/ap1/wt" ]; then fail "discard removes worktree" "still present"; else pass "discard removes worktree"; fi
    expect_eq "discard removes branch" "" "$(git -C "$FX" branch --list 'agy/ap1')"
}

case_summary() {
    need_script "$LEDGER_PY"
    setup_common
    "$PY" - "$LEDGER" <<'PYEOF'
import json, sys
def row(p, v):
    return {"schema": "athanor.dispatch/v1", "ts": "2026-11-15T10:00:00Z", "kind": "qa",
            "mode": "alternate", "lead": "claude", "provider": p, "model": None, "tier": "standard",
            "verdict": v, "rc": 0, "wall_seconds": 10.0, "tokens_in": None, "tokens_out": None,
            "tokens_thinking": None, "tokens_cache_read": None, "tokens_total": None,
            "findings": 0, "mission": None, "id": None}
rows = [row("codex", "PASS"), row("codex", "FAIL"),
        row("agy", "PASS"), row("agy", "FAIL"), row("agy", "UNAVAILABLE")]
with open(sys.argv[1], "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
PYEOF
    run_cap "$PY" "$LEDGER_PY" summary
    expect_eq "summary rc" "0" "$RC"
    local a c
    a="$(printf '%s\n' "$OUT" | grep -i -m1 'agy')"
    c="$(printf '%s\n' "$OUT" | grep -i -m1 'codex')"
    if [ -n "$a" ]; then pass "summary has an agy line"; else fail "summary has an agy line" "$OUT"; fi
    if [ -n "$c" ]; then pass "summary has a codex line"; else fail "summary has a codex line" "$OUT"; fi
    case "$a" in *3*) pass "agy line shows 3 runs" ;; *) fail "agy line shows 3 runs" "$a" ;; esac
    case "$a" in *33*|*0.33*|*"1/3"*) pass "agy FAIL rate 1/3 shown" ;; *) fail "agy FAIL rate 1/3 shown" "$a" ;; esac
    case "$c" in *2*) pass "codex line shows 2 runs" ;; *) fail "codex line shows 2 runs" "$c" ;; esac
    case "$c" in *50*|*0.5*|*"1/2"*) pass "codex FAIL rate 1/2 shown" ;; *) fail "codex FAIL rate 1/2 shown" "$c" ;; esac
}

fx_snapshot() { (cd "$FX" && find . -name .git -prune -o -print | sort; git branch --list | sort); }
verdict_line() { grep -i -m1 -E 'verdict|^# agy-dev' "$1" 2>/dev/null; }

reg_apply_names() {
    local wt f
    dev_run rg1 STUB_AGY_APPEND=app.txt
    wt="$FX/.tmp/sandbox/agy-dev/rg1/wt"
    for f in "execution/hooks/é.sh" "agents.md" "Execution/Hooks/x.sh"; do
        mkdir -p "$wt/$(dirname "$f")"
        echo x > "$wt/$f"
        git -C "$wt" add -A
        run_cap bash "$AGY_DEV" apply --id rg1
        expect_eq "1. apply rejects protected path '$f' rc" "1" "$RC"
        if [ -e "$FX/$f" ]; then fail "1. '$f' not written into main" "exists"; else pass "1. '$f' not written into main"; fi
        expect_eq "1. app.txt untouched in main after rejected '$f'" "base" "$(cat "$FX/app.txt")"
        git -C "$wt" rm -q -f --cached -- "$f" 2>/dev/null
        python3 "$REPO/execution/safe_delete.py" "$wt/$f" >/dev/null 2>&1
    done
}

reg_bad_ids() {
    local id snap
    for id in .. . .x; do
        snap="$(fx_snapshot)"
        : > "$STUB_AGY_LOG"
        run_cap bash "$AGY_DEV" run --task t --id "$id"
        expect_eq "2. --id '$id' rc" "2" "$RC"
        expect_eq "2. --id '$id' created nothing" "$snap" "$(fx_snapshot)"
        expect_eq "2. --id '$id' never invoked agy" "0" "$(log_calls)"
    done
}

reg_qa_verdicts() {
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=FAILRC0 bash "$QA_SH" "review this"
    expect_eq "3. FAIL printed with rc 0 (standard) -> rc" "1" "$RC"
    expect_eq "3. FAIL printed with rc 0 (standard) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "3. FAIL with rc 0 is final (not retried)" "codex" "$(order)"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=FAILRC0 STUB_AGY_RESULT=FAILRC0 bash "$QA_SH" --both "review this"
    expect_eq "3. both print FAIL rc 0 (--both) -> rc" "1" "$RC"
    expect_eq "3. both print FAIL rc 0 (--both) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    run_cap env STUB_AGY_RESULT=FAILRC0 bash "$QA_SH" --both "review this"
    expect_eq "3. one FAIL-rc0 + one PASS (--both) -> rc" "1" "$RC"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=EMPTY bash "$QA_SH" "review this"
    expect_eq "3. empty-output reviewer fails over to agy, order" "codex agy" "$(order)"
    expect_eq "3. empty-output reviewer, verdict from agy rc" "0" "$RC"
    expect_eq "3. empty-output codex row is not PASS" "UNAVAILABLE" "$(row_get 0 verdict)"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=EMPTY STUB_AGY_RESULT=EMPTY bash "$QA_SH" "review this"
    expect_eq "3. both empty -> rc 2" "2" "$RC"
    expect_lacks "3. both empty -> no PASS on stdout" "$OUT" "PASS"
    run_cap env STUB_CODEX_RESULT=EMPTY bash "$QA_SH" --both "review this"
    if [ "$RC" -eq 0 ]; then fail "3. --both with an empty reviewer is not PASS" "rc 0, out=$OUT"; else pass "3. --both with an empty reviewer is not PASS (rc=$RC)"; fi
}

reg_crlf() {
    run_cap env STUB_AGY_CRLF=1 bash "$AGY_QA" "review this"
    expect_eq "4. CRLF stub PASS -> rc" "0" "$RC"
    expect_eq "4. CRLF stub PASS -> line 1" "PASS" "$OUT"
    run_cap env STUB_AGY_CRLF=1 STUB_AGY_MODE=fail bash "$AGY_QA" "review this"
    expect_eq "4. CRLF stub FAIL -> rc" "1" "$RC"
    expect_eq "4. CRLF stub FAIL -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    : > "$STUB_AGY_LOG"
    run_cap env STUB_AGY_CRLF=1 STUB_AGY_USAGE_PCT=2 bash "$AGY_QA" "review this"
    expect_eq "4. CRLF /usage 2% still trips the preflight rc" "2" "$RC"
    expect_eq "4. CRLF preflight spent no turn" "0" "$(log_calls)"
    dev_run rg4 STUB_AGY_CRLF=1 STUB_AGY_APPEND=app.txt
    expect_eq "4. CRLF stub dev run rc" "0" "$RC"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_AGY_CRLF=1 QA_AGY_BIN="$AGY_QA" QA_CODEX_BIN="$WDIR/codex_qa.sh" bash "$QA_SH" "r"
    run_cap env STUB_AGY_CRLF=1 QA_AGY_BIN="$AGY_QA" QA_CODEX_BIN="$WDIR/codex_qa.sh" bash "$QA_SH" "r"
    expect_eq "4. CRLF stub: qa.sh first run went to codex" "codex" "$(order)"
    expect_eq "4. CRLF stub: second qa.sh run rc" "0" "$RC"
    expect_eq "4. CRLF stub: second row provider (alternation intact)" "agy" "$(row_get 1 provider)"
}

reg_tmpdir() {
    local TD="$RUN/tmp dir" n
    mkdir -p "$TD"
    run_cap env TMPDIR="$TD" bash "$AGY_QA" "review this"
    expect_eq "5. agy_qa.sh with spaced TMPDIR rc" "0" "$RC"
    n="$(ls -A "$TD" | wc -l | tr -d ' ')"
    expect_eq "5. agy_qa.sh left no temp files in 'tmp dir'" "0" "$n"
    run_cap env TMPDIR="$TD" bash "$QA_SH" "review this"
    expect_eq "5. qa.sh with spaced TMPDIR rc" "0" "$RC"
    n="$(ls -A "$TD" | wc -l | tr -d ' ')"
    expect_eq "5. qa.sh left no temp files in 'tmp dir'" "0" "$n"
    run_cap env TMPDIR="$TD" bash "$QA_SH" --both --evidence "echo ev" "review this"
    n="$(ls -A "$TD" | wc -l | tr -d ' ')"
    expect_eq "5. qa.sh --both (+evidence) left no temp files in 'tmp dir'" "0" "$n"
}

reg_unaudited() {
    local r v
    dev_run rg6 STUB_AGY_WRITE_ABS="$FX/.agent/memory/project/rules.md"
    r="$FX/.agent/memory/scratch/agy-dev-rg6-result.md"
    expect_file "6. result file" "$r"
    assert_unconfined_result rg6
    expect_has "6. result names the unaudited path" "$(cat "$r" 2>/dev/null)" "rules.md"
    expect_has "6. result has an unaudited/excluded changes heading" "$(grep -i 'unaudited' "$r" 2>/dev/null)" "naudited"
    v="$(verdict_line "$r")"
    expect_has "6. verdict line has WARN" "$v" "WARN"
    dev_run rg7 STUB_AGY_WRITE_ABS="$FX/.agent/memory/project/telemetry/x.jsonl $FX/.agent/memory/scratch/note.txt"
    r="$FX/.agent/memory/scratch/agy-dev-rg7-result.md"
    expect_eq "6. telemetry/scratch writes: rc" "0" "$RC"
    v="$(verdict_line "$r")"
    expect_has "6. telemetry/scratch writes: verdict still DONE" "$v" "DONE"
    expect_lacks "6. telemetry/scratch writes: no WARN on verdict line" "$v" "WARN"
    expect_lacks "6. telemetry/scratch writes: not listed as unaudited" "$(grep -i 'unaudited' "$r" 2>/dev/null)" "telemetry"
}

reg_usage_pathconv() {
    : > "$STUB_AGY_LOG.usage"
    run_cap bash "$AGY_QA" "review this"
    local u; u="$(cat "$STUB_AGY_LOG.usage" 2>/dev/null)"
    if [ -n "$u" ]; then pass "7. /usage preflight ran"; else fail "7. /usage preflight ran" "no usage call recorded"; fi
    if printf '%s\n' "$u" | grep -qxF '<</usage>>'; then pass "7. /usage argv is exactly /usage"; else fail "7. /usage argv is exactly /usage" "$(printf '%s' "$u" | tr '\n' ' ')"; fi
    case "$u" in
        *"MSYS_NO_PATHCONV=1"*) pass "7. MSYS_NO_PATHCONV=1 set for the /usage call" ;;
        *"MSYS2_ARG_CONV_EXCL=*"*|*"MSYS2_ARG_CONV_EXCL=/usage"*) pass "7. MSYS2_ARG_CONV_EXCL set for the /usage call" ;;
        *) fail "7. MSYS_NO_PATHCONV=1 or MSYS2_ARG_CONV_EXCL set for /usage" "$(printf '%s' "$u" | grep ENV)" ;;
    esac
}

reg_fail_rc2() {
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=FAILRC2 bash "$QA_SH" "review this"
    expect_eq "8. FAIL printed with rc 2 (standard) -> rc" "1" "$RC"
    expect_eq "8. FAIL printed with rc 2 (standard) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_eq "8. FAIL with rc 2 is not failed over" "codex" "$(order)"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=FAILRC2 bash "$QA_SH" --both "review this"
    expect_eq "8. FAIL rc 2 first reviewer + PASS second (--both) -> rc" "1" "$RC"
    expect_eq "8. FAIL rc 2 first reviewer + PASS second (--both) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
    run_cap env STUB_AGY_RESULT=FAILRC2 bash "$QA_SH" --both "review this"
    expect_eq "8. FAIL rc 2 second reviewer + PASS first (--both) -> rc" "1" "$RC"
    expect_eq "8. FAIL rc 2 second reviewer (--both) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
}

reg_git_pointer() {
    dev_run rg9 STUB_AGY_REL_WRITES=.git
    expect_eq "9. overwritten worktree .git pointer: rc" "1" "$RC"
    expect_has "9. result reports ESCAPED" "$(cat "$FX/.agent/memory/scratch/agy-dev-rg9-result.md" 2>/dev/null)" "ESCAPED"
    run_cap bash "$AGY_DEV" apply --id rg9
    if [ "$RC" -ne 0 ]; then pass "9. apply refuses an ESCAPED run (rc=$RC)"; else fail "9. apply refuses an ESCAPED run" "rc 0"; fi
    expect_eq "9. main app.txt untouched" "base" "$(cat "$FX/app.txt")"
    expect_eq "9. main init.sh untouched" "$(printf '#!/bin/sh\necho init')" "$(cat "$FX/init.sh")"
}

reg_home_state() {
    local tool="" fh pwn res
    case "$(uname -s)" in
        Darwin) [ -x /usr/bin/sandbox-exec ] && tool="sandbox-exec" ;;
        Linux) command -v bwrap >/dev/null 2>&1 && tool="bwrap" ;;
    esac
    if [ -z "$tool" ]; then echo "10. SKIP: no confinement tool on this host"; return 0; fi
    fh="$FX/.agent/memory/project/telemetry"
    pwn="$fh/.gemini/antigravity-cli/pwn"
    run_cap env -u AGY_DEV_UNCONFINED HOME="$fh" STUB_AGY_WRITE_ABS="$pwn" \
        bash "$AGY_DEV" run --task "Append a line to app.txt" --id rg10 --timeout 5m
    res="$(cat "$FX/.agent/memory/scratch/agy-dev-rg10-result.md" 2>/dev/null)"
    if [ -e "$pwn" ]; then fail "10. agy state dir must not be inside the project" "agy wrote $pwn"; else pass "10. nothing written to HOME-inside-project state dir"; fi
    if [ "$RC" = "2" ]; then
        case "$ERR" in
            *state*|*antigravity-cli*|*.gemini*|*HOME*) pass "10. rc 2 names the state directory" ;;
            *) fail "10. rc 2 names the state directory" "$ERR" ;;
        esac
    else
        expect_lacks "10. result records no state dir under the fixture" "$(printf '%s\n' "$res" | grep -i 'state')" "$FX"
    fi
}

reg_pass_rc1() {
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=PASSRC1 bash "$QA_SH" "review this"
    expect_eq "11. PASS printed with rc 1 (alternate) -> rc" "1" "$RC"
    expect_eq "11. PASS printed with rc 1 (alternate) -> line 1" "FAIL" "$(printf '%s\n' "$OUT" | head -n 1)"
}

reg_codex_row_model() {
    local n m
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_CODEX_RESULT=UNAVAIL bash "$QA_SH" "review this"
    expect_eq "12. agy stub review (via failover) rc" "0" "$RC"
    expect_eq "12. agy row provider" "agy" "$(row_get 1 provider)"
    expect_eq "12. agy row model from sidecar" "$HYDROGEN" "$(row_get 1 model)"
    expect_eq "12. agy row tokens_in from sidecar" "12494" "$(row_get 1 tokens_in)"
    run_cap bash "$QA_SH" "review this"
    expect_eq "12. codex stub review rc" "0" "$RC"
    n=$(($(row_count) - 1))
    expect_eq "12. last row provider" "codex" "$(row_get "$n" provider)"
    m="$(row_get "$n" model)"
    case "$m" in gpt-*) pass "12. codex row model starts gpt- (=$m)" ;; *) fail "12. codex row model starts gpt-" "$m" ;; esac
    expect_eq "12. codex row tokens_in is null" "null" "$(row_get "$n" tokens_in)"
}

reg_no_stray_qa_logs() {
    local stray
    stray="$(find "$REPO/.agent/memory/scratch" -name 'qa-*.log' -newer "$RUN/suite-marker" 2>/dev/null | tr '\n' ' ')"
    expect_eq "13. no qa-*.log written to .agent/memory/scratch during the suite" "" "$stray"
}

reg_model_cfg() { # name flash apex allowed_json -> path of an override provider config
    local f="$RUN/prov-$1.json"
    "$PY" -c 'import json,sys
f,fl,ap,al=sys.argv[1:5]
json.dump({"model_map":{"flash":fl,"apex":ap},"allowed_models":json.loads(al)},open(f,"w"))' \
        "$f" "$2" "$3" "$4"
    printf '%s' "$f"
}

reg_models_validation() {
    local both='["gemini-4-hydrogen-high","gemini-4-argon-high"]' cfg out
    cfg="$(reg_model_cfg wide "gemini-3-pro" "$ARGON" '["gemini-3-pro","gemini-4-argon-high"]')"
    out="$(ATHANOR_AGY_PROVIDER_JSON="$cfg" "$PY" "$REPO/execution/agy_models.py" tier flash 2>/dev/null)"
    expect_eq "14. config cannot widen past the hard pair (rc)" "1" "$(ATHANOR_AGY_PROVIDER_JSON="$cfg" "$PY" "$REPO/execution/agy_models.py" tier flash >/dev/null 2>&1; echo $?)"
    expect_eq "14. widened tier prints nothing" "" "$out"
    cfg="$(reg_model_cfg nl "\n" "$ARGON" "$both")"
    out="$(ATHANOR_AGY_PROVIDER_JSON="$cfg" "$PY" "$REPO/execution/agy_models.py" tier flash 2>/dev/null)"
    expect_eq "14. whitespace-only model prints nothing" "" "$out"
    cfg="$(reg_model_cfg narrow "$HYDROGEN" "$ARGON" '["gemini-4-hydrogen-high"]')"
    expect_eq "14. config narrows: apex outside allowed_models refused" "1" "$(ATHANOR_AGY_PROVIDER_JSON="$cfg" "$PY" "$REPO/execution/agy_models.py" tier apex >/dev/null 2>&1; echo $?)"
    cfg="$(reg_model_cfg pad " $HYDROGEN " "$ARGON" "$both")"
    expect_eq "14. surrounding whitespace is stripped" "$HYDROGEN" "$(ATHANOR_AGY_PROVIDER_JSON="$cfg" "$PY" "$REPO/execution/agy_models.py" tier flash)"
}

reg_ledger_null_model() {
    local cfg i bad=""
    cfg="$(reg_model_cfg noapex "$HYDROGEN" "" '["gemini-4-hydrogen-high","gemini-4-argon-high"]')"
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env ATHANOR_AGY_PROVIDER_JSON="$cfg" STUB_CODEX_RESULT=UNAVAIL STUB_AGY_RESULT=UNAVAIL \
        bash "$QA_SH" --apex "review this"
    for i in 0 1; do
        [ "$(row_get "$i" provider)" = "agy" ] || continue
        [ "$(row_get "$i" model)" = "null" ] || bad="$bad $i"
    done
    expect_eq "15. unavailable agy row model is JSON null (flash set, apex unset, --apex)" "" "$bad"
    : > "$LEDGER"
    "$PY" "$REPO/execution/dispatch_ledger.py" append --kind qa --mode direct --provider agy \
        --model "" --verdict PASS >/dev/null 2>&1
    expect_eq "15. an empty --model is stored as null" "null" "$(row_get 0 model)"
}

reg_cr_strip() {
    local f
    for f in agy_qa.sh agy_dev.sh qa.sh; do
        expect_has "16. $f strips CR from the resolved model" "$(grep -A0 'agy_models.py' "$REPO/execution/$f" | grep "tr -d '.r'" | head -n 1)" "tr -d"
    done
}

reg_reviewer_stderr() {
    : > "$WDIR/order"; : > "$LEDGER"
    run_cap env STUB_NOISE=1 bash "$QA_SH" "review this"
    expect_lacks "17. reviewer stderr does not leak to qa.sh stderr" "$ERR" "NOISE-from"
    expect_eq "17. normalized block starts with PASS" "PASS" "$(printf '%s\n' "$OUT" | head -n 1)"
    expect_has "17. raw transcript log holds the reviewer stderr" "$(cat "$QA_LOG_DIR"/qa-*.log 2>/dev/null)" "NOISE-from"
}

case_regressions() {
    need_script "$AGY_DEV"; need_script "$AGY_QA"; need_script "$QA_SH"
    setup_common; setup_wrappers
    export AGY_DEV_UNCONFINED=1
    : > "$RUN/suite-marker"
    sleep 1
    reg_apply_names
    reg_bad_ids
    reg_qa_verdicts
    reg_crlf
    reg_tmpdir
    reg_unaudited
    reg_usage_pathconv
    reg_fail_rc2
    reg_git_pointer
    reg_home_state
    reg_pass_rc1
    reg_codex_row_model
    reg_models_validation
    reg_ledger_null_model
    reg_cr_strip
    reg_reviewer_stderr
    reg_no_stray_qa_logs
}

case_confinement() {
    need_script "$AGY_DEV"
    setup_common
    local tool="" wt out res row
    case "$(uname -s)" in
        Darwin) [ -x /usr/bin/sandbox-exec ] && tool="sandbox-exec" ;;
        Linux) command -v bwrap >/dev/null 2>&1 && tool="bwrap" ;;
    esac
    if [ -n "$tool" ]; then
        echo "BRANCH: host has $tool, asserting confinement"
        wt="$FX/.tmp/sandbox/agy-dev/cf1/wt"
        dev_run cf1 STUB_AGY_REL_WRITES="inside.txt ../outside.txt"
        res="$FX/.agent/memory/scratch/agy-dev-cf1-result.md"
        expect_eq "confined run rc" "0" "$RC"
        expect_file "inside.txt created in the worktree" "$wt/inside.txt"
        if [ -e "$FX/.tmp/sandbox/agy-dev/cf1/outside.txt" ]; then fail "outside.txt blocked by $tool" "exists"; else pass "outside.txt blocked by $tool"; fi
        expect_has "result records the confinement" "$(cat "$res" 2>/dev/null)" "- confinement: $tool"
        expect_lacks "result first line is not UNCONFINED" "$(head -n 1 "$res" 2>/dev/null)" "UNCONFINED"
        expect_eq "ledger row confinement key" "$tool" "$(row_get 0 confinement)"
    else
        echo "BRANCH: host has no confinement tool, asserting run refuses"
        case "$(uname -s)" in Darwin) out="sandbox-exec" ;; Linux) out="bwrap" ;; *) out="confinement" ;; esac
        dev_run cf2 STUB_AGY_APPEND=app.txt
        expect_eq "unconfined host: run rc" "2" "$RC"
        expect_has "unconfined host: stderr names the missing tool" "$ERR" "$out"
        expect_eq "unconfined host: agy never invoked" "0" "$(log_calls)"
    fi
}

case "$CASE" in
    models|verdicts|review_readonly|live_readonly|alternation|failover|codex_lead|both|ledger_row|dev_isolation|dev_apply|summary|regressions|confinement)
        "case_$CASE" ;;
    *) echo "usage: agy_delegation_test.sh <models|verdicts|review_readonly|live_readonly|alternation|failover|codex_lead|both|ledger_row|dev_isolation|dev_apply|summary|regressions|confinement>" >&2; exit 2 ;;
esac

if [ "$NFAIL" -gt 0 ]; then echo "RESULT: $CASE FAILED ($NFAIL assertion(s))"; exit 1; fi
echo "RESULT: $CASE PASSED"
exit 0
