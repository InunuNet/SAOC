#!/usr/bin/env bash
# PreToolUse guard: refuse Bash commands that could start concurrent Next builds
# or dev servers from a sweep context, or that start one when many are already
# running. Fail-safe: exit 2 blocks the call; any error here exits 0 (allow).
# Rationale: on 2026-11-24 a mass contract-assertion sweep spawned ~90 next build
# processes with a timeout that killed only the shell. 27 orphaned builds, ~30
# GB, kernel panic. This guard is a last line of defence, not the only one.
set -u
cmd=$(cat 2>/dev/null | python3 -I -c "import json,sys;d=json.load(sys.stdin);print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || true)
[ -z "$cmd" ] && exit 0

# Cap: how many concurrent next-server/next-build processes are tolerated per
# machine. Our workflow uses one preview server + maybe one QA dev server.
CAP=${SAOC_NEXT_PROC_CAP:-4}
alive=$(ps -axo command 2>/dev/null | grep -cE "[n]ext-server|[n]ext build|[n]ext-build" || echo 0)

# Phrases that indicate the command itself would start another one.
starts_build='(next[[:space:]]+build|pnpm[[:space:]]+(run[[:space:]]+)?build|npm[[:space:]]+run[[:space:]]+build|next-build)'
starts_dev='(next[[:space:]]+dev|pnpm[[:space:]]+dev|npm[[:space:]]+run[[:space:]]+dev|next[[:space:]]+start)'

# Sweep contexts: parallel runners and mass contract-assertion drivers.
sweep='(ThreadPoolExecutor|xargs[[:space:]]+-P[[:space:]]*[2-9]|parallel[[:space:]]+-j[[:space:]]*[2-9]|GNU parallel|run_static_assertions\.py|for[[:space:]]+[a-z]+[[:space:]]+in[[:space:]]+.*cands?\.json)'

violation=""
if echo "$cmd" | grep -qE "$sweep" && echo "$cmd" | grep -qE "$starts_build|$starts_dev"; then
    violation="sweep + build/server in the same command"
elif [ "$alive" -ge "$CAP" ] && echo "$cmd" | grep -qE "$starts_build|$starts_dev"; then
    violation="would make it $((alive+1)) concurrent next processes (cap $CAP)"
fi

if [ -n "$violation" ]; then
    echo "SAOC build-sweep-guard: refused. $violation." >&2
    echo "Alive next-* processes:" >&2
    ps -axo pid,etime,command 2>/dev/null | grep -E "[n]ext-server|[n]ext build|[n]ext-build|[n]ext dev" | head -20 >&2
    echo "If this is intentional, raise SAOC_NEXT_PROC_CAP for one call or kill the strays by PID first." >&2
    exit 2
fi
exit 0
