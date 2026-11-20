---
description: Credential and destructive-command detail.
paths:
  - "**/.env*"
  - ".sops.yaml"
  - "secrets/**"
  - "execution/env_keys.py"
---

# Security Rules

Confirm before running, however routine: `rm -rf` with a broad path, `git push --force`,
`dd if=/dev/zero`, `chmod 777`, any `curl … | sh` piped installer.

Never read without permission (asked the way `scope.md` requires): `~/.ssh/`,
`~/.aws/credentials`, `~/.gnupg/`, any `.env` outside this project.

Secrets: this project's own dotenv is yours to read and write; other projects', the home
directory's and `secrets/` stay denied. Prefer `python3 execution/env_keys.py` (key names,
set/unset, length, never values; `--has KEY`; `--set KEY` takes the value from stdin) and never
echo a value.
- Never commit a `.env`; use `.env.enc` (sops+age, `.sops.yaml`).
- Never log an API key, token or password; mask before the write.
- A secret in source makes the commit invalid. Keep credentials out of provider settings files.
- Credentials move between machines only through `python3 execution/cred_sync.py push|pull <host>`
  to a host in the operator-owned registry (`.agent/cred_sync_hosts.json`); never copy, `cat`,
  or `rsync` credential files any other way, and never drop them silently from a copy.
