# Cross-platform parity

Athanor runs the same way on macOS, Linux and Windows. This page lists what
used to differ and what is now the same. The Linux list came from the Athanor
session on an Arch aarch64 VM, and the Windows list from the Mumbl session on
Windows 11 ARM64.

Check it with
`python3 .agent/memory/project/specs/cross-platform-parity/goldens/verify_cross_platform_parity.py`,
then run `python3 execution/fleet_acceptance.py` on each machine.

## What changed

| area | before | now |
|---|---|---|
| Windows imports | `brain.py`, `mission.py` and `pulse_dispatcher.py` imported `fcntl`, which native Windows Python does not have, so they failed at import. | Each guards the import. Locks use `flock` on macOS and Linux exactly as before, and `msvcrt.locking` on Windows. `statusline.py` and `quota_auto_resume.py` were already guarded, since v3.8.59. |
| Windows venv | `brain.py` looked for `bin/python3` and `bin/pip` in its venv. A native Windows venv uses `Scripts\python.exe`, so boot step 1 failed with WinError 2. Found by Athanor Windows. | `_venv_exe()` picks `Scripts\<name>.exe` on Windows and `bin/<name>` elsewhere. |
| Windows locks | — | A blocking acquire polls `msvcrt.locking` for up to 120 s, then raises `TimeoutError` naming the lock file. It never drops the write silently. A non-blocking miss raises `BlockingIOError`, as `flock` does. Measured natively on Windows 11 ARM64 with Python 3.12. Windows locks are mandatory, which is harmless here because every lock is a dedicated empty `.lock` file. |
| Acceptance runner | `fleet_acceptance.py` decoded child output with the locale codec and crashed on cp1252. | It decodes as UTF-8 with `errors="replace"`. |
| Contract paths | 18 spec contracts named `/Users/vetus/ai/Athanor`, so their gates could only pass on one Mac. | They use repo-relative paths, or `"$PWD"` captured before any `cd`. Paths into other projects are historical records and are unchanged. |
| Alembic probe | The boot essential always probed `http://localhost:7077/`. A VM reaches the Mac's Alembic at a different address, so boot reported it down. | Boot probes `ALEMBIC_URL` when it is set, otherwise `http://localhost:7077/`, and the fix text names the URL it actually probed. On a Parallels VM, set `ALEMBIC_URL=http://10.211.55.2:7077`. |
| Retired providers | A leftover `.gemini/settings.json` or `.grok/settings.json` kept hooks that point at deleted `execution/hooks/` scripts, which then failed with exit 127. | `make update-template` calls `post_update.prune_retired_provider_hooks()`. It removes only the hooks whose script is missing, keeps every other key and every live hook, and prints a before/after count. A second run changes nothing. It never touches `.claude/settings.json`, which `repair_hooks.py` reconciles. |

## Not yet the same

- On Windows, `make update-template` still crashes on cp1252 output
  (InunuNet/Athanor#1469, owned by Mumbl AI). Until that lands, Windows
  updates are manual or `--source` only. Python's UTF-8 mode
  (`PYTHONUTF8=1`) should avoid the encode error, but nobody has measured it
  on Windows yet.
- On Windows, `fleet_acceptance.py` step 1 times out inside `init.sh`. The
  nested-work-tree message there is only a warning, so the cause is a later
  step and has not been found yet.

- Quota auto-resume installs a launchd agent and therefore runs on macOS only.
  Linux (systemd timer) and Windows (Task Scheduler) are queued.
- Autocompact-after-mission types into Ghostty on macOS only. Everywhere else
  it uses the `autoCompactWindow` fallback.

## Windows status (2026-11-03, v3.8.90, Windows 11 ARM64, Git Bash)

`fleet_acceptance.py` passes 4 of 6 on a clean checkout. The two failures are the machine, not the harness: boot halts only on Alembic being unreachable from the VM, and wrap fails only because chromadb is not installed in `~/.athanor-env`. Scaffold, onboard, mission and idempotence pass.

Known and accepted on Windows:

- `init.sh` is slow (many bash and python spawns); on an 8 GB machine under load the scaffold step can hit its timeout (exit 124). Re-run on an idle machine before calling it a bug.
- The `msysroot` arm of the route-1 goldens fails 46 of 75 on Windows: its model self-test disagrees with the host, so the fixture needs Windows host semantics before the number means hook failures. Unresolved.
- Without `jq` the floor hook cannot read tool input and allows. Install `jq` before running agents.
- A path that differs only by case (`.SSH/config`) is not matched by the credential-store check on a case-insensitive filesystem.
- No `make`, no `rsync` (sync falls back to `cp`); the limits in `privileged-command-permit.md` (8.3 short names, ADS, reserved device names, junctions) still hold.
