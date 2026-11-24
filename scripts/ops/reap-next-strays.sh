#!/usr/bin/env bash
# List, and with --apply kill, next-server/next-build/next-dev processes.
# Default DRY RUN. Filters by cwd prefix when --under <path> is given.
set -u
apply=0; under=""
while [ $# -gt 0 ]; do
    case "$1" in
        --apply) apply=1 ;;
        --under) shift; under="$1" ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
    shift
done
pids=$(pgrep -f "next-server|next-build|next build|next dev" || true)
[ -z "$pids" ] && { echo "no next-* processes alive"; exit 0; }
found=""
for p in $pids; do
    cwd=$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | grep ^n | cut -c2- | head -1)
    cmd=$(ps -axo pid=,command= -p "$p" 2>/dev/null | head -1)
    if [ -n "$under" ] && ! echo "$cwd" | grep -q -F "$under"; then
        continue
    fi
    echo "$cmd  (cwd: $cwd)"
    found="$found $p"
done
[ -z "$found" ] && { echo "no matches under $under"; exit 0; }
if [ "$apply" -eq 1 ]; then
    echo "--- killing:$found"
    # shellcheck disable=SC2086
    kill -TERM $found 2>/dev/null; /bin/sleep 2
    # shellcheck disable=SC2086
    kill -KILL $found 2>/dev/null; true
    echo "after:"
    ps -axo pid,command 2>/dev/null | grep -E "[n]ext-server|[n]ext-build|[n]ext build|[n]ext dev" | head -10
fi
