---
schema: athanor.directive/v1
id: ATH-20261115-role-skills-codex-dev
targets: [all]
issued_at: '2026-11-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: Role agents get in-house craft skills on every provider; codex_dev.sh delegates dev work to Codex
verify: test -f execution/sync_agents_core.py && test -f execution/codex_dev.sh && test -f .agent/skills/role-dev-craft.md && bash execution/sync_agents.sh --check
---

Brad, 2026-11-15: "if we launch a designer, we use the best available design skills... We need
a library of skills that we build ourselves... that get deployed with the sub-agents each time
they are created." And: "you have quota you can use with OpenAI and ... Google ... this is why
we want the load balancing in place."

- **Role skills.** `.agent/skills/role-*.md` (design craft, architecture, analysis, dev craft,
  adversarial QA, docs writing) are listed in each canonical `.agent/agents/<role>.md`.
  `make update-template` runs `sync_agents.sh`, which puts them in Claude frontmatter `skills:`
  and inlines them into the Codex, Grok and Antigravity agent files.
- **Your customised agent files are kept.** A provider agent file you edited by hand is never
  overwritten. Sync writes `<file>.athanor-new` beside it and exits 1. Merge it, then delete the
  `.athanor-new`. Every overwrite is backed up under `.agent/memory/scratch/agent-backups/`.
  `bash execution/sync_agents.sh --check` must exit 0.
- **Designer screenshots.** `python3 execution/browser_qa.py --url <url> --screenshot out.png
  --width 360|768|1440` works without Playwright through headless Chrome. Assertions still
  need Playwright.
- **Codex dev path.** `bash execution/codex_dev.sh run --task <file> --id <slug> [--apex]`, then
  `apply --id <slug>` or `discard --id <slug>`. It has the same shape as `agy_dev.sh`: a
  worktree from committed HEAD, Codex `workspace-write` sandbox, a main-checkout escape audit,
  floor paths refused on apply, one ledger row per run. Commit before you delegate.
- **agy_dev audit.** `pulse.log` is no longer reported as an escape.
- **Open item.** The Windows launch of a `.cmd` or script codex is written but has not been run
  on a Windows host.
