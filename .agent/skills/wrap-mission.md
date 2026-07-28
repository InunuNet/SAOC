# wrap-mission

Complete a mission cleanly in one step: brain wrap-up + git commit + git push + clear active.json.

## When to use
After ALL chain steps are done and the gate has passed. This is the final step of every mission.

## Usage
```bash
bash execution/skills/wrap_mission.sh "what was accomplished" "tag1,tag2"
```

## What it does
1. `python3 execution/brain.py wrap-up` — stores session learning in semantic memory
2. `git add -A`, then scans the staged set with `execution/skills/lib/secret_guard.py`.
   If any secret-looking path is staged (`.secrets/`, `.env`/`.env.*` except the
   allowlist, service-account JSON, SSH keys, `.pem`/`.p12`/`.pfx`/`.key`), everything
   is unstaged and the script ABORTS (exit 1) — no commit, no push, no `active.json`
   clear. Files are never deleted, only unstaged.
3. Commits, then pushes the current branch to a verified remote. Safe-default optional
   env overrides: `WRAP_NO_PUSH=1` (skip push), `WRAP_REMOTE=<name>` (default `origin`),
   `WRAP_EXPECTED_REMOTE=<host/owner/repo>` (skip + warn if the remote doesn't match
   exactly). Detached HEAD or missing remote also skips push with a warning.
4. Clears `active.json` only if `execution/skills/lib/mission_complete.py` confirms the
   active mission's frontmatter has `status: done`. Paused/pending missions, or a
   dangling pointer, leave `active.json` intact.

See [docs/wrap-mission-hardening.md](../../docs/wrap-mission-hardening.md) for the full
reference (GH #1290).

## Token cost
One line invocation vs ~40 tokens of reasoning about each step separately.
