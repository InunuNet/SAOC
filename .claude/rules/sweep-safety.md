# Sweep safety — never spawn parallel builds

A mass contract-assertion sweep on 2026-11-24 kernel-panicked this Mac: 5,124 commands at 8 workers, a 60 s timeout that killed only bash, and about 90 check scripts that spawn `next build` through a helper. 27 orphaned builds, roughly 30 GB, panic at 22:53.

## Hard rules for every agent that runs more than one check command in a batch

1. **No command that builds or starts a server, directly or indirectly.** Before running any assertion, grep the invoked script AND anything it imports for `next build`, `pnpm build`, `next dev`, `next start`, `spawn(`, `fork(`, `execFile(`, `_server`, `server-ctl`, `generate-image-variants`. Any hit means exclude by reading, do not run. Unsure means excluded.
2. **One worker.** No parallel harness (`ThreadPoolExecutor`, `xargs -P2+`, `parallel -j2+`) around check commands. Serial.
3. **Own process group, killed on timeout.** Use the repo runner `contracts/checks/static-gate/run_static_assertions.py` (fixed on 2026-11-24 to `start_new_session=True` and `os.killpg` with bounded reap), or in your own Python use the same idiom. A `subprocess.run(..., timeout=N)` that kills only bash is forbidden.
4. **Stray check after every run.** `ps -axo pid,ppid,etime,command | grep -E "[n]ext-server|[n]ext build|[n]ext-build|[n]ext dev"`. Kill by PID only processes whose `lsof -a -p $PID -d cwd` is your worktree; report each and drop the assertion that spawned it. Convenience: `bash scripts/ops/reap-next-strays.sh --under <your-worktree-path>` (dry run; add `--apply` to kill).
5. **Build-sweep PreToolUse guard** lives in `scripts/ops/build-sweep-guard.sh`. It refuses a Bash call that combines a sweep pattern with `next build|dev` or that would push concurrent `next-*` processes above `SAOC_NEXT_PROC_CAP` (default 4). It is a last line of defence, not a substitute for rules 1-4.

## Orchestrator brief for any sweep task

Include this paragraph verbatim, after the task body:

> HARD SAFETY RULES. Serial only (one worker). Before running any candidate, statically exclude every command whose script or anything it imports can start `next build`, `next dev`, `next start`, `generate-image-variants` or any other server (`spawn`, `fork`, `execFile`, `_server`, `server-ctl`). Use process-group-killing runners only. After every run, `ps` for `next-*` processes and kill strays by PID in your worktree; report each. The guard `scripts/ops/build-sweep-guard.sh` is a backstop, not an excuse.

## Why the guard alone is not enough

The guard matches by command text at the Bash call. It cannot see when a check script transitively spawns a build via `child_process.spawn` in Node. The agent's static exclusion is the primary defence; the guard catches the obvious failures.
