#!/usr/bin/env bash
# agy_dev.sh — delegate ONE narrow, contract-backed EDIT task to Antigravity (Hydrogen) inside a
# disposable git worktree. agy edits only; it cannot run commands (the lead runs tests and the
# gate after apply). Confinement is isolation plus audit: agy honours no floor of ours.
#
# Usage:
#   execution/agy_dev.sh run --task <prompt-or-file> --id <slug> [--timeout 30m]
#   execution/agy_dev.sh apply   --id <id>    # diff -> main tree, UNCOMMITTED, floor paths refused
#   execution/agy_dev.sh discard --id <id>    # remove worktree, branch and sandbox dir
#
# OS confinement (agy honours no rule that stops a write outside the worktree, probed live):
#   macOS  /usr/bin/sandbox-exec, deny file-write* except the worktree, /dev and
#          ~/.gemini/antigravity-cli (agy's state). VERIFIED: a write to ../outside.txt fails
#          with "operation not permitted" while ./inside.txt is created and valid JSON returns.
#   Linux  bwrap (ro-bind /, rw worktree and ~/.gemini/antigravity-cli, --dev, --proc, tmpfs
#          /tmp). UNVERIFIED: written carefully, never run.
#   Windows Git Bash, Linux without bwrap, macOS without sandbox-exec: NO confinement, so
#          `run` refuses with exit 2 unless AGY_DEV_UNCONFINED=1, which also forces `none` on
#          any platform (the test switch). The result file's first line then says UNCONFINED.
# `confinement: sandbox-exec|bwrap|none` is recorded in the result file and, when
# dispatch_ledger.py append supports --confinement, in the ledger row.
#
# Audit scope: the project root only. Changes under .agent/memory/, .tmp/ and comms.md are
# reported (DONE-WARN), any other change in the main checkout is ESCAPED. WRITES OUTSIDE THE
# PROJECT ARE NOT AUDITED (the rest of the disk is not ours to walk); shell is denied, so only a
# write_file to an outside path could do it.
#
# Exit: 0 ok, 1 task failed / ESCAPED / protected path, 2 usage error, agy missing, unauthenticated
# or out of quota. Result: .agent/memory/scratch/agy-dev-<id>-result.md. Design:
# .agent/memory/project/specs/agy-delegation/DECISIONS.md section 3.
set -u

DEFAULT_TIMEOUT="30m"
UNAVAILABLE_SIGNATURES='not authenticated|authentication required|log ?in|sign in|quota|exhausted|rate.?limit'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/agy_dev_helper.py"
# Harness churn excluded from BOTH audit checks (git status and the newer-than-marker scan).
AUDIT_SILENT_EXCLUDES=".git .agent/memory/project/telemetry .agent/memory/scratch"
# Changes here are never ignored: listed in the result file, verdict DONE-WARN (apply allowed,
# the lead must look). A change anywhere else in the project is ESCAPED.
AUDIT_WARN_PREFIXES=".agent/memory/ .tmp/"
AUDIT_WARN_FILES="comms.md"
CR="$(printf '\r')"
AGY_STATE_REL=".gemini/antigravity-cli"
CONFINEMENT="none"
CONF=()

die() {
    echo "agy_dev.sh: $1" >&2
    exit "${2:-2}"
}

PY=""
for cand in python3 python py; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
        PY="$cand"
        break
    fi
done
[ -n "$PY" ] || die "python3 not found on PATH"
MODEL="$("$PY" "$SCRIPT_DIR/agy_models.py" tier flash | tr -d '\r')" \
    || die "cannot resolve the Antigravity dev model from model_map (agy unavailable)"
[ -n "$MODEL" ] || die "cannot resolve the Antigravity dev model from model_map (agy unavailable)"

[ $# -ge 1 ] || die "usage: agy_dev.sh run|apply|discard ..."
SUB="$1"
shift
TASK=""
ID=""
TIMEOUT="$DEFAULT_TIMEOUT"
while [ $# -gt 0 ]; do
    case "$1" in
        --task) [ $# -ge 2 ] || die "--task needs a value"; TASK="$2"; shift 2 ;;
        --id) [ $# -ge 2 ] || die "--id needs a value"; ID="$2"; shift 2 ;;
        --timeout) [ $# -ge 2 ] || die "--timeout needs a value"; TIMEOUT="$2"; shift 2 ;;
        --model|--model=*) die "the model is fixed to $MODEL; --model is refused" ;;
        *) die "unknown argument: $1" ;;
    esac
done
for v in AGY_MODEL AGY_EFFORT AGY_MODE; do
    [ -z "${!v:-}" ] || die "$v override refused; the model is fixed to $MODEL"
done
case "$ID" in
    ""|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) die "--id must match [A-Za-z0-9][A-Za-z0-9._-]*" ;;
esac
case "$TIMEOUT" in
    *[!0-9smh]*|"") die "--timeout must look like 90s, 30m or 1h" ;;
esac

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository"
SBX_REL=".tmp/sandbox/agy-dev/$ID"
SBX="$ROOT/$SBX_REL"
WT="$SBX/wt"
BRANCH="agy/$ID"
RESULT="$ROOT/.agent/memory/scratch/agy-dev-$ID-result.md"

# Main-tree tracked-file porcelain status minus the silent excludes and this run's sandbox.
audit_status() {
    local ex
    set --
    for ex in $AUDIT_SILENT_EXCLUDES "$SBX_REL"; do set -- "$@" ":(exclude)$ex"; done
    git -C "$ROOT" status --porcelain --untracked-files=no -- . "$@"
}

# Print the project-relative paths changed during the run (files and symlinks newer than the
# marker, plus tracked-status differences), minus the silent excludes.
audit_changed_paths() {
    local ex
    set --
    for ex in $AUDIT_SILENT_EXCLUDES "$SBX_REL"; do
        set -- "$@" -not -path "$ROOT/$ex" -not -path "$ROOT/$ex/*"
    done
    {
        find "$ROOT" \( -type f -o -type l \) -newer "$SBX/marker" "$@" 2>/dev/null \
            | while IFS= read -r ex; do printf '%s\n' "${ex#"$ROOT"/}"; done
        diff "$SBX/status.before" "$SBX/status.after" | sed -n 's/^[<>] ...//p'
    } | sort -u
}

# 0 when path $1 is harness churn that is reported (DONE-WARN) rather than ESCAPED.
audit_is_warn_path() {
    local p
    for p in $AUDIT_WARN_PREFIXES; do
        case "$1" in "$p"*) return 0 ;; esac
    done
    for p in $AUDIT_WARN_FILES; do
        [ "$1" = "$p" ] && return 0
    done
    return 1
}

# Pick the confinement tool for this platform; refuse (exit 2) when there is none unless
# AGY_DEV_UNCONFINED=1.
detect_confinement() {
    if [ "${AGY_DEV_UNCONFINED:-}" = "1" ]; then
        CONFINEMENT="none"
        echo "agy_dev.sh: warning: AGY_DEV_UNCONFINED=1, agy runs with NO OS confinement" >&2
        return 0
    fi
    case "$(uname -s)" in
        Darwin)
            [ -x /usr/bin/sandbox-exec ] && { CONFINEMENT="sandbox-exec"; return 0; }
            die "no confinement: /usr/bin/sandbox-exec is missing (AGY_DEV_UNCONFINED=1 to run without)" ;;
        Linux)
            command -v bwrap >/dev/null 2>&1 && { CONFINEMENT="bwrap"; return 0; }
            die "no confinement: bwrap is not installed (AGY_DEV_UNCONFINED=1 to run without)" ;;
        *)
            die "no confinement on this platform (needs sandbox-exec on macOS or bwrap on Linux; none for Windows Git Bash); AGY_DEV_UNCONFINED=1 to run without" ;;
    esac
}

# Exit 2 when state dir $1 lies inside the project root $2 or the worktree $3.
state_inside() {
    case "$1/" in
        "$2"/*|"$3"/*) die "agy state dir $1 lies inside the project or worktree; refusing" 2 ;;
    esac
}

# 0 when $WT/.git is still the regular pointer file captured before the run.
wt_git_intact() {
    [ -f "$WT/.git" ] && [ ! -L "$WT/.git" ] && cmp -s "$WT/.git" "$SBX/wt.git.snapshot"
}

# Fill CONF with the command prefix that confines agy's writes to the worktree and its own state.
build_confinement() {
    local wt_real state
    CONF=()
    [ "$CONFINEMENT" != "none" ] || return 0
    wt_real="$(cd "$WT" && pwd -P)" || die "cannot resolve the worktree path" 1
    # The state dir comes from the OS account, never from $HOME (agy-controlled env), and must
    # not lie inside the project or the worktree.
    local real_home root_real
    real_home="$("$PY" "$HELPER" home | tr -d "$CR")" || die "cannot resolve the account home" 2
    [ -n "$real_home" ] || die "cannot resolve the account home" 2
    root_real="$(cd "$ROOT" && pwd -P)" || die "cannot resolve the project root" 1
    state="$real_home/$AGY_STATE_REL"
    state_inside "$state" "$root_real" "$wt_real"
    mkdir -p "$state" || die "cannot create $state" 1
    state="$(cd "$state" && pwd -P)" || die "cannot resolve $state" 1
    state_inside "$state" "$root_real" "$wt_real"
    case "$wt_real$state" in
        *\"*|*\\*) die "a quote or backslash in the worktree or home path cannot be confined" 1 ;;
    esac
    case "$CONFINEMENT" in
        sandbox-exec)
            {
                echo '(version 1)'
                echo '(allow default)'
                echo '(deny file-write*)'
                echo "(allow file-write* (subpath \"$wt_real\"))"
                echo "(deny file-write* (literal \"$wt_real/.git\"))"
                echo '(allow file-write* (subpath "/dev"))'
                echo "(allow file-write* (subpath \"$state\"))"
            } > "$SBX/confine.sb" || die "cannot write the sandbox profile" 1
            CONF=(/usr/bin/sandbox-exec -f "$SBX/confine.sb") ;;
        bwrap)
            CONF=(bwrap --ro-bind / / --dev /dev --proc /proc --tmpfs /tmp
                --bind "$wt_real" "$wt_real" --ro-bind "$wt_real/.git" "$wt_real/.git"
                --bind "$state" "$state"
                --unshare-pid --die-with-parent) ;;
    esac
}

# One dispatch-ledger row; a missing or failing ledger warns, never fails the run.
ledger_append() {
    local verdict="$1" rc="$2" wall="$3" ti="$4" to="$5" tt="$6" tc="$7" ttot="$8"
    if [ ! -f "$SCRIPT_DIR/dispatch_ledger.py" ]; then
        echo "agy_dev.sh: warning: dispatch_ledger.py absent, no ledger row" >&2
        return 0
    fi
    local conf_arg=""
    if "$PY" "$SCRIPT_DIR/dispatch_ledger.py" append --help 2>/dev/null | grep -q -- '--confinement'; then
        conf_arg="--confinement"
    fi
    "$PY" "$SCRIPT_DIR/dispatch_ledger.py" append ${conf_arg:+"$conf_arg" "$CONFINEMENT"} --kind dev --mode direct \
        --provider agy --model "$MODEL" --tier standard --verdict "$verdict" --rc "$rc" \
        --wall "$wall" --tokens-in "$ti" --tokens-out "$to" --tokens-thinking "$tt" \
        --tokens-cache-read "$tc" --tokens-total "$ttot" --id "$ID" >/dev/null \
        || echo "agy_dev.sh: warning: dispatch ledger append failed" >&2
    return 0
}

build_prompt() {
    local task_text="$1"
    printf '%s\n\n---\nRules for this task (fixed, from the dispatcher):\n' "$task_text"
    cat <<'PRE'
- You are working in a disposable git worktree: your current directory. Edit files ONLY inside
  it. Never use a path that leaves it (no ../, no absolute paths elsewhere).
- You cannot run commands. Make the edits and describe how to verify them; the dispatcher runs
  the tests and the gate afterwards.
- Do not edit protected paths: .git, execution/hooks/, .claude/, CLAUDE.md, AGENTS.md,
  GEMINI.md, .agent/autonomy_matrix.json, init.sh, full_boot.sh, .env files, *.pem, *.key,
  secrets/. Any diff touching them is rejected.
- Do not commit. Keep the change minimal and inside the task scope.
- End with a short summary: files changed, what to run to verify.
PRE
}

cmd_run() {
    [ -n "$TASK" ] || die "run needs --task"
    local agy_bin task_text
    agy_bin="$(command -v agy 2>/dev/null)" || die "agy binary not found on PATH"
    detect_confinement
    if [ -f "$TASK" ] && [ -r "$TASK" ]; then task_text="$(cat -- "$TASK")"; else task_text="$TASK"; fi
    [ -n "$task_text" ] || die "task text is empty"
    [ ! -e "$SBX" ] || die "id '$ID' already exists; run discard --id $ID first or pick a new id"
    git -C "$ROOT" rev-parse --verify HEAD >/dev/null 2>&1 || die "repository has no commit yet"
    local dirty
    dirty="$(git -C "$ROOT" status --porcelain --untracked-files=no 2>/dev/null)"
    if [ -n "$dirty" ]; then
        echo "agy_dev.sh: warning: main tree has uncommitted tracked changes; the worktree" \
             "is cut from HEAD and will not contain them:" >&2
        printf '%s\n' "$dirty" | sed 's/^/  /' >&2
    fi

    mkdir -p "$SBX" "$ROOT/.agent/memory/scratch" || die "cannot create $SBX" 1
    git -C "$ROOT" worktree add -q -b "$BRANCH" "$WT" HEAD || die "git worktree add failed" 1
    audit_status > "$SBX/status.before"
    cp "$WT/.git" "$SBX/wt.git.snapshot" || die "cannot snapshot the worktree .git pointer" 1
    : > "$SBX/marker"
    sleep 1   # whole-second mtime filesystems: anything newer than the marker is a real write

    local settings settings_arg
    settings="$SBX/settings.json"
    "$PY" "$HELPER" settings "$WT" > "$settings" || die "could not generate settings" 1
    settings_arg="$settings"
    if command -v cygpath >/dev/null 2>&1; then settings_arg="$(cygpath -m "$settings")"; fi

    build_confinement
    local start rc
    start=$SECONDS
    ( cd "$WT" && ${CONF[@]+"${CONF[@]}"} "$agy_bin" -p "$(build_prompt "$task_text")" --model "$MODEL" \
        --output-format json --print-timeout "$TIMEOUT" --settings "$settings_arg" \
        < /dev/null > "$SBX/agy.out" 2> "$SBX/agy.err" )
    rc=$?
    local wall=$((SECONDS - start))

    local status="" finished="" err_text="" denied="" valid=0
    local tokens_in=0 tokens_out=0 tokens_thinking=0 tokens_cache_read=0 tokens_total=0
    local key val
    while IFS='=' read -r key val; do
        val="${val%"$CR"}"   # native Windows python prints CRLF
        case "$key" in
            valid) valid="$val" ;; status) status="$val" ;; finished_reason) finished="$val" ;;
            error) err_text="$val" ;; denied) denied="$val" ;; tokens_in) tokens_in="$val" ;;
            tokens_out) tokens_out="$val" ;; tokens_thinking) tokens_thinking="$val" ;;
            tokens_cache_read) tokens_cache_read="$val" ;; tokens_total) tokens_total="$val" ;;
        esac
    done < <("$PY" "$HELPER" parse "$SBX/agy.out" "$SBX/response.txt")
    [ -f "$SBX/response.txt" ] || : > "$SBX/response.txt"

    # Audit, authoritative inside the project: any file or symlink newer than the marker, or a
    # tracked-status change, outside the worktree and the silent excludes. Writes outside the
    # project root are NOT audited (the rest of the disk is not ours to walk).
    local audit="CLEAN" hits="" warns="" p
    audit_status > "$SBX/status.after"
    audit_changed_paths > "$SBX/changed.txt"
    while IFS= read -r p; do
        [ -n "$p" ] || continue
        if audit_is_warn_path "$p"; then
            warns="${warns}${p}
"
        else
            hits="${hits}${p}
"
        fi
    done < "$SBX/changed.txt"
    if ! wt_git_intact; then
        audit="ESCAPED: the worktree .git pointer was changed or replaced"
    elif [ -n "$hits" ]; then
        audit="ESCAPED: files changed in the main checkout outside the worktree"
    elif [ -n "$warns" ]; then
        audit="WARN: unaudited changes (harness churn or agy), see the result file"
    fi

    local verdict="DONE" exit_code=0
    if [ "${audit#ESCAPED}" != "$audit" ]; then
        verdict="ESCAPED"; exit_code=1
    elif [ "$rc" -ne 0 ] || [ "$valid" != "1" ] || [ "$status" != "SUCCESS" ]; then
        verdict="FAIL"; exit_code=1
        if [ "$rc" -ne 0 ] && [ "$rc" -ne 3 ] && printf '%s\n%s' "$err_text" "$(cat -- "$SBX/agy.err")" \
            | grep -qiE "$UNAVAILABLE_SIGNATURES"; then
            verdict="UNAVAILABLE"; exit_code=2
        fi
    fi
    if [ "$verdict" = "DONE" ] && [ -n "$warns" ]; then verdict="DONE-WARN"; fi
    printf '%s\n' "$verdict" > "$SBX/verdict"

    local stat=""
    if wt_git_intact; then
        git -C "$WT" add -A -N . >/dev/null 2>&1
        stat="$(git -C "$WT" diff HEAD --stat --no-ext-diff --no-textconv)"
    else
        stat="(not computed: the worktree .git pointer is not trusted)"
    fi
    {
        [ "$CONFINEMENT" != "none" ] || echo "UNCONFINED: agy ran with no OS confinement"
        echo "# agy-dev $ID: $verdict"
        echo
        echo "- model: $MODEL; rc: $rc; status: ${status:-none}; wall: ${wall}s"
        echo "- finished_reason: ${finished:-none}; denied_actions: ${denied:-none}"
        echo "- tokens: in=$tokens_in out=$tokens_out thinking=$tokens_thinking total=$tokens_total"
        echo "- confinement: $CONFINEMENT"
        echo "- audit: $audit"
        echo "- silently excluded from the audit: $AUDIT_SILENT_EXCLUDES and $SBX_REL"
        echo "- writes outside the project are not audited; shell is denied, only a write_file" \
             "to an outside path could do it"
        if [ -n "$hits" ]; then
            echo "- escaped paths (first 20):"
            printf '%s' "$hits" | head -n 20 | sed 's/^/  - /'
        fi
        if [ -n "$warns" ]; then
            echo
            echo "## Unaudited changes (harness churn or agy)"
            printf '%s' "$warns" | head -n 50 | sed 's/^/- /'
        fi
        echo
        [ -z "$err_text" ] || echo "- error: $err_text"
        echo "- worktree: $SBX_REL/wt (branch $BRANCH); next: git -C that dir diff, then apply|discard"
        echo
        echo "## Diff stat"
        printf '%s\n' "$stat"
        echo
        echo "## agy response"
        cat -- "$SBX/response.txt"
    } > "$RESULT"

    ledger_append "$verdict" "$rc" "$wall" "$tokens_in" "$tokens_out" "$tokens_thinking" \
        "$tokens_cache_read" "$tokens_total"
    echo "$verdict $ID (audit: $audit); result: .agent/memory/scratch/agy-dev-$ID-result.md"
    exit "$exit_code"
}

cmd_apply() {
    [ -d "$WT" ] || die "no worktree for id '$ID' (run first)" 1
    case "$(cat -- "$SBX/verdict" 2>/dev/null)" in
        DONE|DONE-WARN) ;;
        *) die "run '$ID' did not finish DONE; refusing to apply" 1 ;;
    esac
    wt_git_intact || die "the worktree .git pointer changed since the run; refusing" 1
    git -C "$WT" add -A -N . >/dev/null 2>&1
    local protected patch nfiles
    # NUL-separated, unquoted names; --no-renames lists both sides of a rename; the helper
    # reads them from a file (no bash 4 features, no quoting pitfalls).
    git -c core.quotePath=false -C "$WT" diff HEAD --name-only -z --no-renames --no-ext-diff \
        > "$SBX/names.z" || die "git diff failed" 1
    [ -s "$SBX/names.z" ] || die "nothing to apply: the worktree has no changes" 1
    nfiles="$(git -C "$WT" diff HEAD --name-only --no-renames | wc -l | tr -d ' ')"
    protected="$("$PY" "$HELPER" floor < "$SBX/names.z")"
    if [ $? -ne 0 ] || [ -n "$protected" ]; then
        echo "agy_dev.sh: REJECTED, diff touches floor-protected path(s):" >&2
        printf '%s\n' "$protected" | sed 's/^/  /' >&2
        exit 1
    fi
    patch="$SBX/change.patch"
    git -C "$WT" diff HEAD --binary --no-renames --no-ext-diff --no-textconv > "$patch" || die "git diff failed" 1
    git -C "$ROOT" apply --check "$patch" || die "patch does not apply cleanly to the main tree" 1
    git -C "$ROOT" apply "$patch" || die "git apply failed" 1
    echo "applied $nfiles file(s) UNCOMMITTED; run the tests and the gate, then commit"
}

cmd_discard() {
    [ -e "$SBX" ] || die "nothing to discard for id '$ID'" 1
    if [ -d "$WT" ]; then
        git -C "$ROOT" worktree remove --force "$WT" || echo "agy_dev.sh: warning: worktree remove failed" >&2
    fi
    git -C "$ROOT" worktree prune >/dev/null 2>&1
    if git -C "$ROOT" rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null; then
        git -C "$ROOT" branch -D "$BRANCH" >/dev/null || echo "agy_dev.sh: warning: branch delete failed" >&2
    fi
    ( cd "$ROOT" && "$PY" "$SCRIPT_DIR/safe_delete.py" "$SBX_REL" ) || die "sandbox cleanup refused" 1
    echo "discarded $ID"
}

case "$SUB" in
    run) cmd_run ;;
    apply) cmd_apply ;;
    discard) cmd_discard ;;
    *) die "unknown subcommand '$SUB' (run|apply|discard)" ;;
esac
