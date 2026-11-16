#!/usr/bin/env bash
# codex_dev_test.sh <case> - golden contract tests for execution/codex_dev.sh.
# Cases: usage argv done escape warn apply discard missing timeout_reap timeout_zero start_fail twins all
# Expectations come from .agent/memory/project/specs/codex-dev/SPEC.md.
# Runs codex_dev.sh inside a throwaway git fixture under .tmp/sandbox/codex-dev-tests/<run-id>/
# with CODEX_DEV_BIN pointing to a stub binary and ATHANOR_DISPATCH_LEDGER pointing inside the
# run dir. The real repo, ledger and worktrees are never touched (except twins, which compares
# execution/codex_dev.sh and its template twin in the real tree).
# Bash 3.2 compatible (no assoc arrays, no ${v,,}, no mapfile).

CASE="${1:-}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
if command -v cygpath >/dev/null 2>&1; then REPO="$(cygpath -m "$REPO")"; fi
SBX="$REPO/.tmp/sandbox/codex-dev-tests"
CODEX_DEV="$REPO/execution/codex_dev.sh"

PY=""
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
        PY="$cand"
        break
    fi
done
if [ -z "$PY" ]; then
    echo "FAIL: python3 or python not found on PATH" >&2
    exit 2
fi

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
need_script() { if [ -f "$1" ]; then pass "exists $(basename "$1")"; else fail "exists $(basename "$1")" "missing"; fi; }

# ---------------------------------------------------------------- stubs and fixture

write_codex_stub() { # $1 = bin dir
    cat > "$1/codex" <<'STUB'
#!/usr/bin/env bash
log="${STUB_CODEX_LOG:-/dev/null}"
cdir="."
ofile=""
prev=""
for a in "$@"; do
    printf '%s\n' "$a" >> "$log" 2>/dev/null
    case "$prev" in
        -C) cdir="$a" ;;
        -o) ofile="$a" ;;
    esac
    prev="$a"
done
if [ -n "$ofile" ]; then
    mkdir -p "$(dirname "$ofile")" 2>/dev/null
    printf 'stub done\n' > "$ofile"
fi
if [ -n "${STUB_CODEX_WRITE_REL:-}" ]; then
    mkdir -p "$cdir/$(dirname "$STUB_CODEX_WRITE_REL")"
    printf 'stub write\n' > "$cdir/$STUB_CODEX_WRITE_REL"
fi
if [ -n "${STUB_CODEX_WRITE_ABS:-}" ]; then
    sleep 1
    mkdir -p "$(dirname "$STUB_CODEX_WRITE_ABS")"
    printf 'stub write\n' > "$STUB_CODEX_WRITE_ABS"
fi
if [ -n "${STUB_CODEX_STDERR:-}" ]; then printf '%s\n' "$STUB_CODEX_STDERR" >&2; fi
exit "${STUB_CODEX_RC:-0}"
STUB
    chmod +x "$1/codex"
}

make_fixture() { # $1 = dir; tiny git repo containing copies of the codex_dev runtime files
    mkdir -p "$1"
    (
        cd "$1" || exit 1
        unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
        git init -q . && git config user.email t@example.invalid && git config user.name t
        mkdir -p execution/hooks .agent/providers .agent/memory/scratch .agent/memory/project/telemetry src
        if [ -f "$REPO/execution/codex_dev.sh" ]; then
            cp "$REPO/execution/codex_dev.sh" execution/codex_dev.sh
            chmod +x execution/codex_dev.sh 2>/dev/null || true
        fi
        cp "$REPO/execution/agy_dev_helper.py" execution/agy_dev_helper.py
        cp "$REPO/execution/dispatch_ledger.py" execution/dispatch_ledger.py
        cp "$REPO/execution/safe_delete.py" execution/safe_delete.py
        cp "$REPO/execution/hooks/check_autonomy.sh" execution/hooks/check_autonomy.sh
        cp "$REPO/.agent/providers/codex.json" .agent/providers/codex.json
        echo base > app.txt
        printf '.tmp/\n' > .gitignore
        git add -A && git commit -q -m init
    )
}

setup_common() { # $1 = case label for distinct run-id
    RUN="$SBX/run-$1-$$"
    mkdir -p "$RUN/bin"
    FX="$RUN/fx"
    make_fixture "$FX"
    write_codex_stub "$RUN/bin"
    LEDGER="$RUN/dispatch.jsonl"; : > "$LEDGER"
    STUB_CODEX_LOG="$RUN/codex.log"; : > "$STUB_CODEX_LOG"
    export STUB_CODEX_LOG ATHANOR_DISPATCH_LEDGER="$LEDGER" CODEX_DEV_BIN="$RUN/bin/codex"
    export PATH="$RUN/bin:$PATH"
    unset STUB_CODEX_WRITE_REL STUB_CODEX_WRITE_ABS STUB_CODEX_RC STUB_CODEX_STDERR CODEX_MODEL
}

run_cap() { # run a command in the fixture; sets OUT ERR RC
    OUT="$(cd "$FX" && "$@" 2>"$RUN/err" </dev/null)"
    RC=$?
    ERR="$(cat "$RUN/err")"
}

log_has_arg() { grep -qxF -- "$1" "$STUB_CODEX_LOG" 2>/dev/null; }
log_has_pair() { # flag value
    F="$1" V="$2" awk 'p==ENVIRON["F"] && $0==ENVIRON["V"] {found=1} {p=$0} END {exit !found}' "$STUB_CODEX_LOG" 2>/dev/null
}

codex_model() { # tier (flash|apex) from fixture codex.json
    "$PY" -c 'import io,json,sys
d=json.load(io.open(sys.argv[1], encoding="utf-8"))
print(d["model_map"][sys.argv[2]])' "$FX/.agent/providers/codex.json" "$1" 2>/dev/null | tr -d '\r'
}

last_row_get() { # key -> value or null from last non-empty JSONL line of $LEDGER
    "$PY" -c 'import io,json,sys
lines=[l for l in io.open(sys.argv[1], encoding="utf-8") if l.strip()]
if not lines: sys.exit(1)
v=json.loads(lines[-1]).get(sys.argv[2])
print("null" if v is None else v)' "$LEDGER" "$1" 2>/dev/null | tr -d '\r'
}

row_count() { local n; n="$(grep -c . "$LEDGER" 2>/dev/null)"; echo "${n:-0}"; }

# ---------------------------------------------------------------- cases

case_usage() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common usage
    local bad_id
    for bad_id in .. . .x "a/b" ""; do
        : > "$STUB_CODEX_LOG"
        run_cap bash execution/codex_dev.sh run --task "Append a line" --id "$bad_id"
        expect_eq "bad --id '$bad_id' exits 2" "2" "$RC"
        if [ ! -s "$STUB_CODEX_LOG" ]; then
            pass "bad --id '$bad_id' did not invoke codex"
        else
            fail "bad --id '$bad_id' did not invoke codex" "stub invoked"
        fi
    done
    : > "$STUB_CODEX_LOG"
    run_cap bash execution/codex_dev.sh run --id u1
    expect_eq "missing --task exits 2" "2" "$RC"
    if [ ! -s "$STUB_CODEX_LOG" ]; then
        pass "missing --task did not invoke codex"
    else
        fail "missing --task did not invoke codex" "stub invoked"
    fi
}

case_argv() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common argv
    local m_flash m_apex fx_root wt wt2
    m_flash="$(codex_model flash)"
    m_apex="$(codex_model apex)"
    if [ -n "$m_flash" ]; then pass "codex.json model_map.flash resolved ($m_flash)"; else fail "codex.json model_map.flash resolved" "empty"; fi
    if [ -n "$m_apex" ]; then pass "codex.json model_map.apex resolved ($m_apex)"; else fail "codex.json model_map.apex resolved" "empty"; fi

    fx_root="$(cd "$FX" && git rev-parse --show-toplevel 2>/dev/null)"
    : > "$STUB_CODEX_LOG"
    run_cap env STUB_CODEX_WRITE_REL="src/a.txt" bash execution/codex_dev.sh run --task "Write src/a.txt" --id av1
    expect_eq "argv flash run rc" "0" "$RC"
    wt="$fx_root/.tmp/sandbox/codex-dev/av1/wt"
    if log_has_arg "exec"; then pass "flash argv has exec"; else fail "flash argv has exec" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-C" "$wt"; then pass "flash argv has -C <wt>"; else fail "flash argv has -C $wt" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-s" "workspace-write"; then pass "flash argv has -s workspace-write"; else fail "flash argv has -s workspace-write" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-m" "$m_flash"; then pass "flash argv has -m $m_flash"; else fail "flash argv has -m $m_flash" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_arg "--dangerously-bypass-approvals-and-sandbox"; then fail "flash argv lacks --dangerously-bypass-approvals-and-sandbox" "present"; else pass "flash argv lacks --dangerously-bypass-approvals-and-sandbox"; fi
    if log_has_arg "danger-full-access"; then fail "flash argv lacks danger-full-access" "present"; else pass "flash argv lacks danger-full-access"; fi

    : > "$STUB_CODEX_LOG"
    run_cap env STUB_CODEX_WRITE_REL="src/a.txt" bash execution/codex_dev.sh run --task "Write src/a.txt" --id av2 --apex
    expect_eq "argv apex run rc" "0" "$RC"
    wt2="$fx_root/.tmp/sandbox/codex-dev/av2/wt"
    if log_has_arg "exec"; then pass "apex argv has exec"; else fail "apex argv has exec" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-C" "$wt2"; then pass "apex argv has -C <wt>"; else fail "apex argv has -C $wt2" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-s" "workspace-write"; then pass "apex argv has -s workspace-write"; else fail "apex argv has -s workspace-write" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_pair "-m" "$m_apex"; then pass "apex argv has -m $m_apex"; else fail "apex argv has -m $m_apex" "$(tr '\n' ' ' < "$STUB_CODEX_LOG" | head -c 300)"; fi
    if log_has_arg "--dangerously-bypass-approvals-and-sandbox"; then fail "apex argv lacks --dangerously-bypass-approvals-and-sandbox" "present"; else pass "apex argv lacks --dangerously-bypass-approvals-and-sandbox"; fi
    if log_has_arg "danger-full-access"; then fail "apex argv lacks danger-full-access" "present"; else pass "apex argv lacks danger-full-access"; fi
}

case_done() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common done
    local m_flash res line1
    m_flash="$(codex_model flash)"
    : > "$LEDGER"
    run_cap env STUB_CODEX_WRITE_REL="src/a.txt" bash execution/codex_dev.sh run --task "Write src/a.txt" --id dn1
    expect_eq "done rc" "0" "$RC"
    expect_file "wt src/a.txt created" "$FX/.tmp/sandbox/codex-dev/dn1/wt/src/a.txt"
    if [ -e "$FX/src/a.txt" ]; then fail "main src/a.txt untouched" "exists"; else pass "main src/a.txt untouched"; fi
    res="$FX/.agent/memory/scratch/codex-dev-dn1-result.md"
    expect_file "done result file" "$res"
    line1="$(head -n 1 "$res" 2>/dev/null | tr -d '\r')"
    expect_eq "done result line 1" "DONE" "$line1"
    expect_eq "ledger row count" "1" "$(row_count)"
    expect_eq "ledger provider" "codex" "$(last_row_get provider)"
    expect_eq "ledger kind" "dev" "$(last_row_get kind)"
    expect_eq "ledger model" "$m_flash" "$(last_row_get model)"
    expect_eq "ledger confinement" "codex-workspace-write" "$(last_row_get confinement)"
    expect_eq "ledger verdict" "DONE" "$(last_row_get verdict)"
}

case_escape() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common escape
    local res line1
    run_cap env STUB_CODEX_WRITE_ABS="$FX/escaped.txt" bash execution/codex_dev.sh run --task "Escape" --id es1
    expect_eq "escape rc" "1" "$RC"
    res="$FX/.agent/memory/scratch/codex-dev-es1-result.md"
    expect_file "escape result file" "$res"
    line1="$(head -n 1 "$res" 2>/dev/null | tr -d '\r')"
    expect_eq "escape result line 1" "ESCAPED" "$line1"
}

case_unavailable() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common unavailable
    local res
    run_cap env STUB_CODEX_RC=1 STUB_CODEX_STDERR="ERROR: You've hit your usage limit. Try again at 11:55 PM." \
        bash execution/codex_dev.sh run --task "Limited" --id un1
    expect_eq "usage-limit rc" "2" "$RC"
    res="$FX/.agent/memory/scratch/codex-dev-un1-result.md"
    expect_eq "usage-limit result line 1" "UNAVAILABLE" "$(head -n 1 "$res" 2>/dev/null | tr -d '\r')"
    expect_eq "usage-limit ledger verdict" "UNAVAILABLE" "$(last_row_get verdict)"
    run_cap env STUB_CODEX_RC=1 STUB_CODEX_STDERR="ERROR: compile failed" \
        bash execution/codex_dev.sh run --task "Broken" --id un2
    expect_eq "plain failure rc stays 1" "1" "$RC"
}

case_warn() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common warn
    local res line1
    run_cap env STUB_CODEX_WRITE_ABS="$FX/.tmp/x" bash execution/codex_dev.sh run --task "Warn" --id wn1
    expect_eq "warn rc" "0" "$RC"
    res="$FX/.agent/memory/scratch/codex-dev-wn1-result.md"
    expect_file "warn result file" "$res"
    line1="$(head -n 1 "$res" 2>/dev/null | tr -d '\r')"
    expect_eq "warn result line 1" "DONE-WARN" "$line1"
}

case_apply() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common apply
    local head0
    head0="$(git -C "$FX" rev-parse HEAD)"

    run_cap env STUB_CODEX_WRITE_REL="src/a.txt" bash execution/codex_dev.sh run --task "Write src/a.txt" --id ap1
    expect_eq "apply setup run rc" "0" "$RC"
    run_cap bash execution/codex_dev.sh apply --id ap1
    expect_eq "apply clean rc" "0" "$RC"
    expect_file "apply puts src/a.txt in main tree" "$FX/src/a.txt"
    expect_eq "apply leaves HEAD unchanged (uncommitted)" "$head0" "$(git -C "$FX" rev-parse HEAD)"
    if [ -n "$(git -C "$FX" status --porcelain -- src/a.txt)" ]; then
        pass "src/a.txt is uncommitted in main tree"
    else
        fail "src/a.txt is uncommitted in main tree" "clean"
    fi

    run_cap env STUB_CODEX_WRITE_REL=".Claude/Settings.json" bash execution/codex_dev.sh run --task "Write protected file" --id ap2
    expect_eq "apply floor run rc" "0" "$RC"
    run_cap bash execution/codex_dev.sh apply --id ap2
    expect_eq "apply floor refusal rc" "1" "$RC"
    if [ -e "$FX/.Claude/Settings.json" ] || [ -e "$FX/.claude/settings.json" ]; then
        fail "protected .Claude/Settings.json not created in main" "exists"
    else
        pass "protected .Claude/Settings.json not created in main"
    fi
    expect_eq "HEAD unchanged after refused apply" "$head0" "$(git -C "$FX" rev-parse HEAD)"
}

case_discard() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common discard
    run_cap env STUB_CODEX_WRITE_REL="src/a.txt" bash execution/codex_dev.sh run --task "Discard" --id ds1
    expect_eq "discard setup run rc" "0" "$RC"
    run_cap bash execution/codex_dev.sh discard --id ds1
    expect_eq "discard rc" "0" "$RC"
    if [ -d "$FX/.tmp/sandbox/codex-dev/ds1/wt" ]; then
        fail "discard removes worktree directory" "still present"
    else
        pass "discard removes worktree directory"
    fi
    expect_lacks "git worktree list lacks wt path" "$(git -C "$FX" worktree list)" "codex-dev/ds1/wt"
    expect_eq "git branch --list codex-dev/ds1 is empty" "" "$(git -C "$FX" branch --list 'codex-dev/ds1')"
}

case_missing() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common missing
    run_cap env CODEX_DEV_BIN=/nonexistent bash execution/codex_dev.sh run --task "Missing codex" --id ms1
    expect_eq "missing codex rc" "2" "$RC"
    if [ -n "$ERR" ]; then pass "missing codex reason on stderr"; else fail "missing codex reason on stderr" "empty"; fi
}

case_timeout_reap() {
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) pass "timeout_reap skipped on Windows"; return ;;
    esac
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common timeout_reap
    local pidfile="$RUN/sleep.pid" pid res line1 elapsed
    cat > "$RUN/bin/codex" <<'STUB'
#!/usr/bin/env bash
sleep 30 </dev/null >/dev/null 2>&1 &
echo $! > "$STUB_SLEEP_PIDFILE"
wait
STUB
    chmod +x "$RUN/bin/codex"
    run_cap env STUB_SLEEP_PIDFILE="$pidfile" bash execution/codex_dev.sh run --task "Time out" --id tr1 --timeout 1s
    expect_eq "timeout_reap rc" "1" "$RC"
    res="$FX/.agent/memory/scratch/codex-dev-tr1-result.md"
    line1="$(head -n 1 "$res" 2>/dev/null | tr -d '\r')"
    expect_eq "timeout_reap result line 1" "FAILED" "$line1"
    if [ ! -s "$pidfile" ]; then
        fail "timeout_reap sleep pid recorded" "missing $pidfile"
        return
    fi
    pid="$(cat "$pidfile")"
    elapsed=0
    while [ "$elapsed" -lt 3 ] && kill -0 "$pid" 2>/dev/null; do
        sleep 1
        elapsed=$((elapsed + 1))
    done
    if kill -0 "$pid" 2>/dev/null; then
        fail "timeout_reap background sleep reaped within 3s" "pid $pid still alive"
        kill "$pid" 2>/dev/null || true
    else
        pass "timeout_reap background sleep reaped within 3s"
    fi
}

case_timeout_zero() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common timeout_zero
    local value id
    for value in 0s 5x; do
        case "$value" in 0s) id=tz0 ;; 5x) id=tzx ;; esac
        run_cap bash execution/codex_dev.sh run --task "Invalid timeout" --id "$id" --timeout "$value"
        expect_eq "timeout '$value' rc" "2" "$RC"
        if [ -d "$FX/.tmp/sandbox/codex-dev/$id" ]; then
            fail "timeout '$value' creates no sandbox dir" "directory exists"
        else
            pass "timeout '$value' creates no sandbox dir"
        fi
        expect_eq "timeout '$value' writes no ledger row" "0" "$(row_count)"
    done
}

case_start_fail() {
    need_script "$CODEX_DEV"
    [ -f "$CODEX_DEV" ] || return 1
    setup_common start_fail
    local bin="$RUN/bin/not-executable"
    printf '#!/usr/bin/env bash\nexit 0\n' > "$bin"
    chmod 644 "$bin"
    run_cap env CODEX_DEV_BIN="$bin" bash execution/codex_dev.sh run --task "Unstartable codex" --id sf1
    expect_eq "start_fail rc" "2" "$RC"
    if grep -q '"verdict"[[:space:]]*:[[:space:]]*"FAILED"' "$LEDGER"; then
        fail "start_fail writes no FAILED ledger row" "FAILED row present"
    else
        pass "start_fail writes no FAILED ledger row"
    fi
}

case_twins() {
    local real_script="$REPO/execution/codex_dev.sh"
    local tpl_script="$REPO/template/execution/codex_dev.sh"
    local real_helper="$REPO/execution/agy_dev_helper.py"
    local tpl_helper="$REPO/template/execution/agy_dev_helper.py"
    need_script "$real_script"
    need_script "$tpl_script"
    if [ -f "$real_script" ] && [ -f "$tpl_script" ]; then
        if cmp -s "$real_script" "$tpl_script"; then
            pass "twins: execution/codex_dev.sh and template/execution/codex_dev.sh are byte-identical"
        else
            fail "twins: execution/codex_dev.sh and template/execution/codex_dev.sh differ" "$(cmp "$real_script" "$tpl_script" 2>&1)"
        fi
    fi
    if [ -f "$real_helper" ] && [ -f "$tpl_helper" ]; then
        if cmp -s "$real_helper" "$tpl_helper"; then
            pass "twins: execution/agy_dev_helper.py and template/execution/agy_dev_helper.py are byte-identical"
        else
            fail "twins: execution/agy_dev_helper.py and template/execution/agy_dev_helper.py differ" "$(cmp "$real_helper" "$tpl_helper" 2>&1)"
        fi
    fi
}

case_all() {
    local c
    for c in usage argv done escape unavailable warn apply discard missing timeout_reap timeout_zero start_fail twins; do
        echo "--- case: $c ---"
        "case_$c"
    done
}

case "$CASE" in
    usage|argv|done|escape|unavailable|warn|apply|discard|missing|timeout_reap|timeout_zero|start_fail|twins|all)
        "case_$CASE" ;;
    *) echo "usage: codex_dev_test.sh <usage|argv|done|escape|unavailable|warn|apply|discard|missing|timeout_reap|timeout_zero|start_fail|twins|all>" >&2; exit 2 ;;
esac

if [ "$NFAIL" -gt 0 ]; then echo "RESULT: $CASE FAILED ($NFAIL assertion(s))"; exit 1; fi
echo "RESULT: $CASE PASSED"
exit 0
