#!/usr/bin/env bash
# admin-auth-hardening — start/stop a LOCALLY BUILT PRODUCTION server for this
# contract's HTTP checks, on port 3400, isolated from anything else running.
#
# WHY A SEPARATE ISOLATED BUILD, NOT `pnpm build` IN THIS CHECKOUT:
# `pnpm build` and `pnpm dev` / `pnpm dev:secure` share the .next directory in this
# checkout, and m2-next16-upgrade's server-ctl.sh documents (and guards against) the
# resulting corruption when a build and a dev server collide. This contract cannot
# assume no one else is running `pnpm dev:secure` on 3333 at the same time (measured
# 2026-08-14: it was, and dev-mode first-hit compilation made simple requests take
# 75-120s against it — see _shared.mjs). Building in an rsync'd COPY of the working
# tree, in a scratch directory, sidesteps both problems: no shared .next, and no
# collision with whatever else is running against this checkout.
#
# WHY RSYNC THE WORKING TREE, NOT `git worktree add HEAD`:
# A worktree checked out at HEAD contains only COMMITTED code. @dev's implementation is
# almost always uncommitted when this gate runs — a HEAD-only worktree would silently
# build and test STALE code and every assertion would be meaningless. rsync copies the
# actual working tree, uncommitted changes included, which is what must be tested.
#
# node_modules is NOT rsync'd (large, and a raw copy/symlink of it broke Turbopack in
# testing - "Symlink [project]/node_modules is invalid, it points out of the filesystem
# root"). Installed fresh via `pnpm install --frozen-lockfile` against the local pnpm
# store, which is fast (~10s measured) because it's content-addressed, not re-downloaded.
set -euo pipefail

PORT=3400
BASE="${TMPDIR:-/tmp}/saoc-admin-auth-check-server"
# PIDFILE/LOGFILE/DIRFILE live at fixed paths so `stop`/`status` (separate process
# invocations from `start`) can find them. SCRATCH_DIR itself is NOT fixed - see below.
PIDFILE="$BASE.pid"
LOGFILE="$BASE.log"
DIRFILE="$BASE.dir"
# Mutual exclusion across concurrent invocations of this script (this session runs many
# agents; without this, two start()s racing on the shared fixed PORT/PIDFILE kill and
# overwrite each other mid-run, which then surfaces as random check failures that look
# like security findings). mkdir is atomic on every filesystem this runs on - flock is
# not reliably present on macOS, unlike on the CI Linux hosts this may also run on.
LOCKDIR="$BASE.lock"
LOCK_ACQUIRED=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Waits for exclusive use of the port-$PORT lifecycle (build+launch, or stop). Breaks the
# lock immediately if its recorded holder pid is dead (the same "a crashed run must not
# wedge the harness permanently" requirement already applied to SCRATCH_DIR) - otherwise
# waits, and only gives up loudly after $1 seconds so a genuinely stuck run is visible
# rather than silently corrupting a neighbour's run.
acquire_lock() {
  local max_wait="$1" waited=0
  while ! mkdir "$LOCKDIR" 2>/dev/null; do
    local holder=""
    [ -f "$LOCKDIR/pid" ] && holder="$(cat "$LOCKDIR/pid" 2>/dev/null || true)"
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
      echo "breaking stale lock at $LOCKDIR (holder pid $holder is dead)" >&2
      rm -rf "$LOCKDIR" 2>/dev/null || true
      continue
    fi
    if [ "$waited" -ge "$max_wait" ]; then
      echo "another run holds the port-$PORT lock ($LOCKDIR, pid ${holder:-unknown}) after waiting ${max_wait}s — giving up" >&2
      exit 1
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo $$ >"$LOCKDIR/pid"
  LOCK_ACQUIRED=1
}

release_lock() {
  if [ "$LOCK_ACQUIRED" = "1" ]; then
    rm -rf "$LOCKDIR" 2>/dev/null || true
    LOCK_ACQUIRED=0
  fi
}

# Single EXIT handler for both start() and stop(): always releases the lock (if held),
# and always scrubs any copied .env.local out of the scratch tree, on every exit path -
# success, an early `exit 1`, or a set -e abort mid-build.
cleanup_on_exit() {
  if [ -n "${SCRATCH_DIR:-}" ]; then
    rm -f "$SCRATCH_DIR/.env.local" 2>/dev/null || true
  fi
  release_lock
}
trap cleanup_on_exit EXIT

# Exactly the paths `next build` needs: app code, config, lockfile, public assets. NOT
# a blanket copy of the repo root — confirmed 2026-08-14 that a blanket rsync (even with
# excludes for the 2.2GB "Old SAOC Website Backup/" and node_modules/.next) is both slow
# and unreliable, because .agent/ in this checkout is under active concurrent read/write
# from other agents in this session (mission/pulse/maintainer processes) and a `rm -rf`
# racing against a live writer there intermittently fails with "Directory not empty"
# under set -e. None of .agent/, docs/, execution/, branding/, "design spec/", the
# backup folder, or this contract's own output is on next build's dependency graph, so
# none of it needs to be in the build tree at all.
BUILD_PATHS=(
  app components lib sanity scripts types public emails
  package.json pnpm-lock.yaml pnpm-workspace.yaml
  next.config.ts next-env.d.ts tsconfig.json postcss.config.mjs
  sanity.config.ts sanity.cli.ts
  # scripts/scan-firestore-residue.ts imports SENTINEL_DOMAINS from this one shared
  # module (contracts/checks/_shared/sentinel-domains.mjs), and next build's TypeScript
  # pass fails without it — measured 2026-08-18 while adding this contract's own A13
  # check (execution/checks/verify_admin_nav.ts). Only this one small shared directory
  # is added, not all of contracts/, to avoid the concurrent-write race with other
  # agents that the "None of it needs to be in the build tree" note above documents for
  # the rest of contracts/.
  contracts/checks/_shared
)

start() {
  # Serialize the whole build+launch critical section against any other concurrent
  # start()/stop() in this session — see acquire_lock() above. Held until this script
  # process exits (cleanup_on_exit trap), i.e. for the entire duration of this start(),
  # not just its setup.
  acquire_lock 200

  lsof -ti:"$PORT" | xargs -r kill -9 2>/dev/null || true

  # SCRATCH_DIR is unique per run (mktemp), never reused. A previous run's tree at $BASE.*
  # may still exist and may be UNDELETABLE (e.g. `rm -rf` racing a live pnpm-installed
  # node_modules/.pnpm tree, or denied by sandbox permissions) - that must not block a new
  # run. We never rm -rf a stale tree here; we simply mint a fresh path and leave old ones
  # alone (best-effort, non-fatal cleanup only, so it can never abort start() under set -e).
  SCRATCH_DIR="$(mktemp -d "$BASE.XXXXXX")"
  echo "$SCRATCH_DIR" >"$DIRFILE"
  # Secret hygiene: lock the scratch dir down BEFORE anything (esp. .env.local) is copied
  # into it. cleanup_on_exit (trapped above) removes the copied .env.local on ANY exit
  # from this point on (success, error, or an aborted build under set -e) - not only via
  # the stop() path.
  chmod 700 "$SCRATCH_DIR"

  echo "syncing build-relevant paths (including uncommitted changes) into $SCRATCH_DIR ..."
  for p in "${BUILD_PATHS[@]}"; do
    [ -e "$REPO_ROOT/$p" ] || continue
    # Top-level entries (app, components, ...) land directly under $SCRATCH_DIR as
    # before. Nested entries (e.g. contracts/checks/_shared) must keep their relative
    # path intact -- rsync'ing straight into "$SCRATCH_DIR/" would otherwise drop their
    # parent directories and break relative imports (e.g. scripts/*.ts importing
    # '../contracts/checks/_shared/...').
    parent="$(dirname "$p")"
    if [ "$parent" = "." ]; then
      rsync -a --delete "$REPO_ROOT/$p" "$SCRATCH_DIR/"
    else
      mkdir -p "$SCRATCH_DIR/$parent"
      rsync -a --delete "$REPO_ROOT/$p" "$SCRATCH_DIR/$parent/"
    fi
  done
  cp "$REPO_ROOT/.env.local" "$SCRATCH_DIR/.env.local"

  cd "$SCRATCH_DIR"
  echo "installing dependencies ..."
  pnpm install --frozen-lockfile --prefer-offline

  echo "building production bundle ..."
  pnpm build

  echo "starting production server on port $PORT ..."
  rm -f "$LOGFILE"
  PORT="$PORT" nohup ./node_modules/.bin/next start -p "$PORT" >"$LOGFILE" 2>&1 </dev/null &
  disown
  echo $! >"$PIDFILE"

  CODE=000
  for _ in $(seq 1 30); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null) || true; CODE=${CODE:-000}
    if [ "$CODE" != "000" ]; then break; fi
    sleep 1
  done
  if [ "$CODE" = "000" ]; then
    echo "production server on port $PORT never came up within 30s" >&2
    cat "$LOGFILE" >&2
    exit 1
  fi
  echo "production server up on port $PORT (http $CODE), pid $(cat "$PIDFILE"), tree at $SCRATCH_DIR"
}

status() {
  if [ ! -f "$PIDFILE" ]; then
    echo "no PIDFILE — server not started by this script" >&2
    exit 1
  fi
  SCRATCH_DIR="$(cat "$DIRFILE" 2>/dev/null || echo "$BASE (unknown run)")"
  PID=$(cat "$PIDFILE")
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "server process $PID is not running (crashed?) — see $LOGFILE" >&2
    tail -n 80 "$LOGFILE" >&2 || true
    exit 1
  fi
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null) || true; CODE=${CODE:-000}
  if [ "$CODE" = "000" ]; then
    echo "server process $PID is alive but port $PORT is not answering" >&2
    exit 1
  fi
  echo "server alive: pid $PID, http $CODE, tree at $SCRATCH_DIR"
}

stop() {
  # Same lock as start(): don't yank a server out from under a start() that is mid-build.
  acquire_lock 200

  if [ -f "$PIDFILE" ]; then
    kill "$(cat "$PIDFILE")" 2>/dev/null || true
    rm -f "$PIDFILE"
  fi
  lsof -ti:"$PORT" | xargs -r kill -9 2>/dev/null || true

  if [ -f "$DIRFILE" ]; then
    SCRATCH_DIR="$(cat "$DIRFILE")"
    rm -f "$DIRFILE"
    # Best-effort only: a tree that cannot be fully removed (e.g. a live
    # node_modules/.pnpm layout, or a permission denial) must WARN, not fail the gate -
    # this is the same "rm -rf racing a live tree" class this file already documents for
    # .agent/ and the legacy backup folder.
    if rm -rf "$SCRATCH_DIR" 2>/dev/null; then
      echo "production server on port $PORT stopped, scratch tree removed ($SCRATCH_DIR)"
    else
      echo "production server on port $PORT stopped; WARNING: scratch tree at $SCRATCH_DIR could not be fully removed (left in place, non-fatal)" >&2
    fi
  else
    echo "production server on port $PORT stopped (no scratch tree recorded)"
  fi
}

case "${1:-}" in
  start) start ;;
  status) status ;;
  stop) stop ;;
  *) echo "usage: server-ctl.sh {start|status|stop}" >&2; exit 2 ;;
esac
