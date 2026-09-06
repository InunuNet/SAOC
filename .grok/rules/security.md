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
- Never commit a `.env`. Use `.env.enc` with sops+age; `.sops.yaml` carries the
  encryption config.
- Never log an API key, token, or password. Mask before the write, not after.
- A secret in source makes the commit invalid, branch or not.
- Provider configuration is not a secret store: keep credentials out of
  `<project>/.claude/settings.json` and its siblings.
