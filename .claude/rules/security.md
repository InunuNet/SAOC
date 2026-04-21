# Security Rules

## Command Denylists
These commands should always require confirmation:
- `rm -rf` with broad paths
- `git push --force`
- `dd if=/dev/zero`
- `chmod 777`
- `curl | sh` (piped installs)

## File Access
Never read without explicit permission:
- `~/.ssh/*`
- `~/.aws/credentials`
- `~/.gnupg/*`
- `.env` files outside this project

## Secrets
- Never commit `.env` files — use `.env.enc` with sops+age
- Never log API keys, tokens, or passwords
- Check `.sops.yaml` for encryption config
