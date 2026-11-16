#!/usr/bin/env bash
# Delegate one contract-backed edit task to Codex in a disposable git worktree.
# Usage: codex_dev.sh run --task <text-or-file> --id <slug> [--timeout 30m] [--apex]
#        codex_dev.sh apply|discard --id <slug>
# run exits 0 DONE/DONE-WARN, 1 FAILED/ESCAPED, 2 usage error or Codex UNAVAILABLE (usage/rate
# limit: fail over to agy_dev.sh, then discard the run).
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$SCRIPT_DIR/agy_dev_helper.py"
CR="$(printf '\r')"
AUDIT_SILENT_EXCLUDES=".git .agent/memory/project/telemetry .agent/memory/scratch pulse.log"
AUDIT_WARN_PREFIXES=".agent/memory/ .tmp/"
AUDIT_WARN_FILES="comms.md"
CONFINEMENT="codex-workspace-write"
# Same signatures as codex_qa.sh: a usage/rate limit means Codex is unavailable, not that the
# task failed, so run exits 2 and the caller fails over to another provider.
UNAVAILABLE_SIGNATURES='usage limit|rate limit|hit your [a-z ]*limit|429 Too Many Requests|HTTP 429'
die() { echo "codex_dev.sh: $1" >&2; exit "${2:-2}"; }

PY=""
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys' >/dev/null 2>&1; then
        PY="$cand"; break
    fi
done
[ -n "$PY" ] || die "python3 or python not found on PATH"
[ $# -ge 1 ] || die "usage: codex_dev.sh run|apply|discard ..."
SUB="$1"; shift
TASK=""; ID=""; TIMEOUT="30m"; TIER="flash"
while [ $# -gt 0 ]; do
    case "$1" in
        --task) [ $# -ge 2 ] || die "--task needs a value"; TASK="$2"; shift 2 ;;
        --id) [ $# -ge 2 ] || die "--id needs a value"; ID="$2"; shift 2 ;;
        --timeout) [ $# -ge 2 ] || die "--timeout needs a value"; TIMEOUT="$2"; shift 2 ;;
        --apex) TIER="apex"; shift ;;
        *) die "unknown argument: $1" ;;
    esac
done
case "$ID" in
    ""|[!A-Za-z0-9]*|*[!A-Za-z0-9._-]*) die "--id must match [A-Za-z0-9][A-Za-z0-9._-]*" ;;
esac
[[ "$TIMEOUT" =~ ^[0-9]+[smh]$ ]] && [[ "$TIMEOUT" =~ [1-9] ]] \
    || die "--timeout must be a positive duration such as 90s, 30m or 1h"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside a git repository"
SBX_REL=".tmp/sandbox/codex-dev/$ID"
SBX="$ROOT/$SBX_REL"
WT="$SBX/wt"
BRANCH="codex-dev/$ID"
RESULT="$ROOT/.agent/memory/scratch/codex-dev-$ID-result.md"

audit_status() {
    local ex
    set --
    for ex in $AUDIT_SILENT_EXCLUDES "$SBX_REL"; do set -- "$@" ":(exclude)$ex"; done
    git -C "$ROOT" status --porcelain --untracked-files=no -- . "$@"
}

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

audit_is_warn_path() {
    local p
    for p in $AUDIT_WARN_PREFIXES; do case "$1" in "$p"*) return 0 ;; esac; done
    for p in $AUDIT_WARN_FILES; do [ "$1" = "$p" ] && return 0; done
    return 1
}

wt_git_intact() {
    [ -f "$WT/.git" ] && [ ! -L "$WT/.git" ] && cmp -s "$WT/.git" "$SBX/wt.git.snapshot"
}

audit_trusted() {
    [ "${DEV_AUDIT_STRICT:-}" != "1" ] || return 1
    case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) return 1 ;; esac
    [ "$CONFINEMENT" = "codex-workspace-write" ]
}

ledger_append() {
    local verdict="$1" rc="$2" wall="$3"
    if [ ! -f "$SCRIPT_DIR/dispatch_ledger.py" ]; then
        echo "codex_dev.sh: warning: dispatch_ledger.py absent, no ledger row" >&2
        return 0
    fi
    "$PY" "$SCRIPT_DIR/dispatch_ledger.py" append --kind dev --mode direct \
        --provider codex --model "$MODEL" --tier "$([ "$TIER" = apex ] && echo apex || echo standard)" \
        --verdict "$verdict" --rc "$rc" --wall "$wall" --confinement "$CONFINEMENT" \
        --id "$ID" >/dev/null || echo "codex_dev.sh: warning: dispatch ledger append failed" >&2
    return 0
}

build_prompt() {
    printf '%s\n\n---\nRules for this task (fixed, from the dispatcher):\n' "$1"
    cat <<'PRE'
- Work only inside the disposable git worktree given by -C. Do not touch files outside it.
- You may run this project's tests inside the worktree.
- Do not edit protected paths: .git, execution/hooks/, .claude/, CLAUDE.md, AGENTS.md,
  GEMINI.md, .agent/autonomy_matrix.json, init.sh, full_boot.sh, .env files, *.pem, *.key,
  secrets/. A diff touching them cannot be applied.
- Do not commit. Keep the change minimal and inside the task scope.
- End with a short summary of files changed and tests run.
PRE
}

cmd_run() {
    [ -n "$TASK" ] || die "run needs --task"
    local codex_bin task_text dirty start rc wall hits warns p audit verdict exit_code stat changed_preview
    codex_bin="${CODEX_DEV_BIN:-codex}"
    MODEL="$("$PY" -c 'import io,json,sys
try:
    model=json.load(io.open(sys.argv[1], encoding="utf-8"))["model_map"][sys.argv[2]]
    if not isinstance(model, str) or not model.strip(): raise ValueError("empty model")
    print(model)
except (OSError, ValueError, KeyError, TypeError): sys.exit(2)' "$ROOT/.agent/providers/codex.json" "$TIER" | tr -d "$CR")" \
        || die "cannot resolve the Codex dev model from model_map"
    [ -n "$MODEL" ] || die "cannot resolve the Codex dev model from model_map"
    if [ -f "$TASK" ] && [ -r "$TASK" ]; then task_text="$(cat -- "$TASK")"; else task_text="$TASK"; fi
    [ -n "$task_text" ] || die "task text is empty"
    [ ! -e "$SBX" ] || die "id '$ID' already exists; run discard first or pick a new id"
    git -C "$ROOT" rev-parse --verify HEAD >/dev/null 2>&1 || die "repository has no commit yet"
    dirty="$(git -C "$ROOT" status --porcelain --untracked-files=no 2>/dev/null)"
    if [ -n "$dirty" ]; then
        echo "codex_dev.sh: warning: main tree has uncommitted tracked changes; the worktree is cut from HEAD and will not contain them:" >&2
        printf '%s\n' "$dirty" | sed 's/^/  /' >&2
    fi
    mkdir -p "$SBX" "$ROOT/.agent/memory/scratch" || die "cannot create $SBX" 1
    git -C "$ROOT" worktree add -q -b "$BRANCH" "$WT" HEAD || die "git worktree add failed" 1
    audit_status > "$SBX/status.before"
    cp "$WT/.git" "$SBX/wt.git.snapshot" || die "cannot snapshot the worktree .git pointer" 1
    : > "$SBX/marker"
    sleep 1
    start=$SECONDS
    "$PY" "$HELPER" codex-run "$codex_bin" "$WT" "$MODEL" "$SBX/last-message.txt" \
        "$TIMEOUT" "$(build_prompt "$task_text")" < /dev/null > "$SBX/codex.out" 2> "$SBX/codex.err"
    rc=$?
    wall=$((SECONDS - start))
    if [ "$rc" -eq 127 ]; then
        git -C "$ROOT" worktree remove --force "$WT" || die "cannot remove unstarted Codex worktree" 1
        git -C "$ROOT" branch -D "$BRANCH" >/dev/null || die "cannot remove unstarted Codex branch" 1
        ( cd "$ROOT" && "$PY" "$SCRIPT_DIR/safe_delete.py" "$SBX_REL" ) \
            || die "cannot clean up unstarted Codex sandbox" 1
        die "cannot start codex (see helper error above)"
    fi
    [ -f "$SBX/last-message.txt" ] || : > "$SBX/last-message.txt"
    hits=""; warns=""; audit="CLEAN"
    audit_status > "$SBX/status.after"
    audit_changed_paths > "$SBX/changed.txt"
    while IFS= read -r p; do
        [ -n "$p" ] || continue
        if audit_is_warn_path "$p"; then warns="${warns}${p}
"; else hits="${hits}${p}
"; fi
    done < "$SBX/changed.txt"
    if ! wt_git_intact; then
        audit="ESCAPED: the worktree .git pointer was changed or replaced"
    elif [ -n "$hits" ]; then
        if audit_trusted; then
            audit="WARN: main checkout changed during the run"
            warns="${hits}${warns}"; hits=""
        else
            audit="ESCAPED: files changed in the main checkout outside the worktree"
        fi
    elif [ -n "$warns" ]; then
        audit="WARN: changes in the main checkout, see the result file"
    fi
    verdict="DONE"; exit_code=0
    if [ "${audit#ESCAPED}" != "$audit" ]; then
        verdict="ESCAPED"; exit_code=1
    elif [ "$rc" -ne 0 ] && cat "$SBX/codex.out" "$SBX/codex.err" "$SBX/last-message.txt" 2>/dev/null \
            | grep -Eiq "$UNAVAILABLE_SIGNATURES"; then
        verdict="UNAVAILABLE"; exit_code=2
    elif [ "$rc" -ne 0 ]; then
        verdict="FAILED"; exit_code=1
    elif [ -n "$warns" ]; then
        verdict="DONE-WARN"
    fi
    printf '%s\n' "$verdict" > "$SBX/verdict"
    if wt_git_intact; then
        git -C "$WT" add -A -N . >/dev/null 2>&1
        stat="$(git -C "$WT" diff HEAD --stat --no-ext-diff --no-textconv)"
    else
        stat="(not computed: the worktree .git pointer is not trusted)"
    fi
    {
        echo "$verdict"
        echo "# codex-dev $ID"
        echo
        echo "- confinement: $CONFINEMENT"
        echo "- model: $MODEL; rc: $rc; wall: ${wall}s"
        echo "- audit: $audit"
        echo "- silently excluded from the audit: $AUDIT_SILENT_EXCLUDES and $SBX_REL"
        if [ -n "$hits" ]; then echo "- escaped paths:"; printf '%s' "$hits" | sed '/^$/d; s/^/  - /'; fi
        if [ -n "$warns" ]; then echo "- changes requiring review:"; printf '%s' "$warns" | sed '/^$/d; s/^/  - /'; fi
        echo
        echo "## Diff stat"
        printf '%s\n' "$stat"
        echo
        echo "## Codex last message"
        head -c 4000 "$SBX/last-message.txt"
    } > "$RESULT"
    ledger_append "$verdict" "$rc" "$wall"
    # Most significant first: a tampered .git pointer, then real escapes or lead changes, then
    # warn-prefix churn, so .agent/ and .tmp/ noise never hides the path that matters.
    changed_preview="$( { wt_git_intact || printf '%s\n' "$SBX_REL/wt/.git"; printf '%s' "$hits"; printf '%s' "$warns"; } \
        | awk 'NF && n < 3 { printf "%s%s", (n ? ", " : ""), $0; n++ }')"
    echo "$verdict $ID (audit: $audit${changed_preview:+; paths: $changed_preview}); result: .agent/memory/scratch/codex-dev-$ID-result.md"
    exit "$exit_code"
}

cmd_apply() {
    [ -d "$WT" ] || die "no worktree for id '$ID' (run first)" 1
    case "$(cat -- "$SBX/verdict" 2>/dev/null)" in DONE|DONE-WARN) ;; *) die "run '$ID' did not finish DONE; refusing to apply" 1 ;; esac
    wt_git_intact || die "the worktree .git pointer changed since the run; refusing" 1
    git -C "$WT" add -A -N . >/dev/null 2>&1
    local protected patch nfiles rejected p before idx line file_rejected
    local -a rej_before=()
    git -c core.quotePath=false -C "$WT" diff HEAD --name-only -z --no-renames --no-ext-diff > "$SBX/names.z" || die "git diff failed" 1
    [ -s "$SBX/names.z" ] || die "nothing to apply: the worktree has no changes" 1
    nfiles="$(git -C "$WT" diff HEAD --name-only --no-renames | wc -l | tr -d ' ')"
    protected="$("$PY" "$HELPER" floor < "$SBX/names.z")"
    if [ $? -ne 0 ] || [ -n "$protected" ]; then
        echo "codex_dev.sh: REJECTED, diff touches floor-protected path(s):" >&2
        printf '%s\n' "$protected" | sed 's/^/  /' >&2
        exit 1
    fi
    patch="$SBX/change.patch"
    git -C "$WT" diff HEAD --binary --no-renames --no-ext-diff --no-textconv > "$patch" || die "git diff failed" 1
    if ! git -C "$ROOT" apply --check "$patch"; then
        while IFS= read -r -d '' p; do
            before=""
            [ ! -f "$ROOT/$p.rej" ] || before="$(cksum < "$ROOT/$p.rej")"
            rej_before+=("$before")
        done < "$SBX/names.z"
        git -c core.quotePath=false -C "$ROOT" apply --reject "$patch" 2> "$SBX/apply.err"
        cat "$SBX/apply.err" >&2
        rejected=""
        idx=0
        while IFS= read -r -d '' p; do
            file_rejected=""
            if [ -f "$ROOT/$p.rej" ] &&
                { [ -z "${rej_before[$idx]}" ] || [ "$(cksum < "$ROOT/$p.rej")" != "${rej_before[$idx]}" ]; }; then
                file_rejected=" $p ($p.rej)"
            else
                while IFS= read -r line; do
                    case "$line" in
                        "error: $p:"*|"error: patch failed: $p:"*|"error: cannot apply binary patch to '$p'"*|"error: binary patch does not apply to '$p'"*)
                            file_rejected=" $p"; break ;;
                    esac
                done < "$SBX/apply.err"
            fi
            rejected="${rejected}${file_rejected}"
            idx=$((idx + 1))
        done < "$SBX/names.z"
        echo "PARTIAL: rejected${rejected:- hunk(s); inspect git apply output}"
        exit 1
    fi
    git -C "$ROOT" apply "$patch" || die "git apply failed" 1
    echo "applied $nfiles file(s) UNCOMMITTED; run the tests and the gate, then commit"
}

cmd_discard() {
    [ -e "$SBX" ] || die "nothing to discard for id '$ID'" 1
    if [ -d "$WT" ]; then
        git -C "$ROOT" worktree remove --force "$WT" || echo "codex_dev.sh: warning: worktree remove failed" >&2
    fi
    git -C "$ROOT" worktree prune >/dev/null 2>&1
    if git -C "$ROOT" rev-parse --verify -q "refs/heads/$BRANCH" >/dev/null; then
        git -C "$ROOT" branch -D "$BRANCH" >/dev/null || echo "codex_dev.sh: warning: branch delete failed" >&2
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
