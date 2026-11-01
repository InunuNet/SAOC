---
description: Sanctioned routes when the autonomy floor denies an enforcement or bootstrap path.
paths:
  - ".agent/autonomy_matrix.json"
  - ".claude/settings.json"
  - "execution/hooks/**"
  - "init.sh"
  - "AGENTS.md"
  - "CLAUDE.md"
  - ".claude/hooks/**"
  - ".agent/enforcement_*.json"
  - ".agent/update-manifest.yaml"
---

# Floor Routes

A denial is not a bug and not a puzzle to solve. Denied unconditionally: `init.sh`,
`full_boot.sh`, `CLAUDE.md`/`AGENTS.md`, `.claude/settings.json`, `.claude/hooks/*`,
`execution/hooks/*`, `.agent/autonomy_matrix.json`, `.agent/enforcement_breakglass.json`,
credential stores. Pick the route that fits:

- **`--force-path`**: the manifest marks the path `HARNESS` and it is merely stale. Run
  `python3 execution/update_template.py --apply --force-path <path>`; the updater writes it
  itself (old copy backed up), so the floor never engages.
- **Route 1, contract `enforcement_edits`**: project-owned file an active mission has to
  touch. Name each exact path in the feature's contract; the permit is scoped to that mission
  and the contract is the audit record. Prefer this whenever a mission is open.
- **Route 2, operator breakglass**: one-off with no mission. Only the operator creates
  `.agent/enforcement_breakglass.json` naming one path; single-use, expires in 15 minutes.
  An agent writing that file is the laundering case.
- **Route 3, emergency**: urgent, no mission, operator away. Write
  `.agent/enforcement_emergency.json` with one exact `path`, a `reason` of at least 20
  characters and `created_at`. Expires in 30 minutes, consumed on grant, one path per permit,
  logged to `.agent/memory/project/enforcement_edit_audit.log`.

Route 3 can never reach credential stores (`.env`, `.ssh/`, `.aws/`, `.gnupg/`, `*.pem`,
`*.key`, `secrets/`), `.git/`, `autonomy_matrix.json`, the breakglass and emergency files, or
`check_autonomy.sh`; those need Route 1 or the operator.
