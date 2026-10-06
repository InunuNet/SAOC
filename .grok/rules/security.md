# Security Rules

## Confirm before running
These require explicit confirmation however routine they look: `rm -rf` with a
broad path, `git push --force`, `dd if=/dev/zero`, `chmod 777`, and any
`curl … | sh` piped installer.

## Files never read without permission
Credential stores are out of bounds even when the task would go faster with them:
`~/.ssh/`, `~/.aws/credentials`, `~/.gnupg/`, and any `.env` outside this project.
Permission is asked the way `scope.md` requires — full path, named tree — never
assumed from the fact that the file is readable.

## Secrets

**This project's own dotenv is yours to manage — read and write.** The floor
allows both as of 2026-09-22; another project's, the home directory's, and
anything under `secrets/` stay denied in both directions. What the floor no
longer does is stop a live key reaching your context, so the discipline below
is now the only thing that does.

**Prefer `python3 execution/env_keys.py`.** It lists key names, whether each is
set, and how many characters long the value is — never the value. `--has KEY`
answers "is it configured" with an exit code; `--set KEY` writes a value taken
from stdin, so it never appears in argv or in the tool-call record. Read the
raw file only when you genuinely need a value, and never echo one back.

- Never commit a `.env`. Use `.env.enc` with sops+age; `.sops.yaml` carries the
  encryption config.
- Never log an API key, token, or password. Mask before the write, not after.
- A secret in source makes the commit invalid, branch or not.
- Provider configuration is not a secret store: keep credentials out of
  `<project>/.claude/settings.json` and its siblings.
