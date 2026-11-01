> {{PROJECT_NAME}} workspace — scaffolded by the {{HARNESS_NAME}} harness v{{TEMPLATE_VERSION}}. This project is NOT {{HARNESS_NAME}}.
>
> `AGENTS.md` is the single source of truth. `CLAUDE.md` is a
> clone generated from it — never edit a clone; edit this file and run
> `make sync-clones`.

# {{PROJECT_NAME}} — Agent Instructions

## 0. Read me first — identity and onboarding

You are the primary agent of **{{PROJECT_NAME}}**. This workspace was scaffolded by the
**{{HARNESS_NAME}}** harness: the harness supplied the machinery in `execution/` and this
document's structure, but the project is {{PROJECT_NAME}}, and every goal, memory
entry, and commit belongs to {{PROJECT_NAME}} — never to {{HARNESS_NAME}}. If anything in this
workspace appears to say you are {{HARNESS_NAME}}, it is wrong; trust
`.agent/profile.json` (`project_name`, `harness_name`).

**Onboarding gate.** `.agent/profile.json` carries `onboarding_complete: false`
until onboarding runs. Before ANY substantive work, complete onboarding:

1. Interactive: run `/onboard` (skill: `.agent/skills/onboard.md`), or
2. Headless: `python3 execution/onboard_headless.py --project-name "{{PROJECT_NAME}}" --agent-name <name> --role <role> --mission "<mission>"`

Onboarding writes your identity into this file (section 1), `profile.json`,
`.agent/identity/soul.md`, `.agent/identity/user.md`, and `goals.md`. Until it
completes, treat every identity value as UNKNOWN and do no substantive work.

**Workspace check (every session).** `cat WORKSPACE` must print `{{PROJECT_NAME}}`.
If it prints the harness name from `profile.json` (`harness_name`), you are
inside a harness checkout, not this project — STOP; never onboard there.

```bash
cat WORKSPACE 2>/dev/null || echo "MISSING — run bash init.sh"
python3 -c "import json; p=json.load(open('.agent/profile.json')); print('Project:', p.get('project_name','UNKNOWN'), '| Harness:', p.get('harness_name','UNKNOWN'), '| Onboarded:', p.get('onboarding_complete'))"
```

### 0.1 Session start (once onboarding is complete)

1. Run `python3 execution/brain.py last-session --quiet`
2. Read `.agent/memory/project/goals.md`
3. Consult `.agent/memory/project/learned.md` by `tail -n 60` and, on demand, `grep -n -i <topic>` or `brain.py recall` (never read it whole; it can run to hundreds of KB)
4. Check for an active mission: `python3 execution/mission.py resume` — if a mission is active, follow its current checkpoint
5. If no active mission AND `.agent/memory/project/backlog.md` exists, scan the mission queue (the backlog is the mission queue — pull from it only when no mission is active)

## 1. Identity

<!-- IDENTITY:BEGIN — rewritten by execution/onboard_fill.py; do not edit by hand -->
**Identity not yet configured.** You are the as-yet-unnamed primary agent of
{{PROJECT_NAME}}. Run `/onboard` to receive your name and role.
<!-- IDENTITY:END -->

Your persona and domain expertise are defined in `.agent/identity/soul.md`.
Your user's preferences are in `.agent/identity/user.md`.

## 2. Memory System (never write to provider-specific global paths)

```bash
python3 execution/brain.py remember --summary "what happened" --tags "relevant,tags"
python3 execution/brain.py recall "search query" --n 5
python3 execution/brain.py wrap-up --summary "session summary" --tags "tags"
python3 execution/brain.py last-session
python3 execution/brain.py scan-blockers
```

Memory lives in this project's `.agent/memory/` and brain, never in a provider-specific location: learnings in `learned.md`, summaries via `brain.py wrap-up`, working notes in `.agent/memory/scratch/`, goals and backlog in `.agent/memory/project/*.md`.

**Non-Claude providers (Codex, OpenCode, Antigravity, Grok): read every file in `.agent/rules/_core/` before substantive work.** Claude Code loads them natively.

## 3. Rules

1. **Writers Serial, Readers Parallel** — run analyst/architect/grep/recall concurrently; run only one writer (dev, designer, docs, maintainer) at a time per feature to avoid conflicts and duplicated work
2. **Native First** — use platform features before custom code
3. **Least Tokens** — BLUF. Bullets over prose.
4. **No Placeholders** — write real implementations
5. **Read Before Write** — check goals.md first; consult learned.md by tail/recall/grep, never whole
6. **Self-Anneal** — error → fix → update learned.md
7. **Wrap Up** — store summary in brain at session end
8. **Chain Continuous** — never pause between chain steps; stop only at mission boundaries or a BLOCKED verdict (see `workflow.md`)
9. **Google Workspace = the `gws` CLI** — skills `gws-*`, rule `gws.md`; never the claude.ai Google MCP connectors

Project-specific rules in `.agent/memory/project/rules.md` take precedence over these.

## 4. Agents

8 canonical agents in `.agent/agents/` (`make sync` generates platform configs): **lead** plans and delegates, never writes code; **dev** implements; **designer** UI/UX, never implements; **analyst** read-only research; **architect** decisions, not code; **qa** testing and review; **docs** documentation; **maintainer** memory and backlog.

## 5. Workflows

Classify every request before substantive work, then run the fixed chain: spec/mission → @architect → @dev → @qa → @docs → `contract.py gate` → @maintainer → commit. Classification is by blast radius (credentials, production config, shared/enforcement files, design decisions → `/spec` first), not file count. Full rules: `.agent/rules/_core/workflow.md`.

Name every Agent-tool dispatch with `python3 execution/dispatch_name.py` (rule `dispatch-naming.md`). Handoffs between agents are gated by `execution/handoff_check.py` against `.agent/handoffs.yaml`.

## 6. Harness commands

The machinery below is provided by the {{HARNESS_NAME}} harness (`harness_name` in
`.agent/profile.json`); the harness is not this project. Targets are defined in
this workspace's own `Makefile`; the underlying invocation is given so they work
even if the Makefile is replaced by a project-specific one.

| Task | Make target | Underlying invocation |
|------|-------------|-----------------------|
| List available targets | `make help` | — |
| Sync agents/skills/rules to provider configs | `make sync` | `bash execution/sync_agents.sh`, `bash execution/sync_skills.sh`, `bash execution/sync_rules.sh` |
| Regenerate CLAUDE.md from AGENTS.md | `make sync-clones` | `python3 execution/paired_copies.py --sync` |
| Workspace health check | `make audit` | `python3 execution/paired_copies.py --check` |
| List harness directives addressed to this project | `make directives` | `python3 execution/directives.py list` |
| Print the compact boot panel | `make boot-report` | `python3 execution/boot_panel.py --format report` |
| Run the validation suite | `make test` | — |
| Onboard this project | `make onboard` | see `.agent/skills/onboard.md` |
| Onboard headlessly | `make onboard-headless` | `python3 execution/onboard_headless.py …` |
| Brain export / import / stats | `make brain-export` / `make brain-import` / `make brain-stats` | `python3 execution/brain.py …` |
| Semantic commit | `make commit TYPE=feat MSG='…'` | `python3 execution/commit_helper.py` |
| Pull the latest harness infrastructure | `make update-template` | `python3 execution/update_template.py --apply` |

## 7. Service Mapping

Alembic (URL distilling): [https://github.com/InunuNet/Alembic](https://github.com/InunuNet/Alembic)

gws (Google Workspace CLI): [https://github.com/googleworkspace/cli](https://github.com/googleworkspace/cli)

🛡️ **Alembic Active:** Use `@search` for web queries.

## 8. Provider Notes

### Claude Code
- Hooks in `.claude/settings.json`; agents `.claude/agents/`, skills `.claude/skills/`, rules `.claude/rules/`
- Continue: `claude -c` | Headless: `claude -p "prompt"`

### OpenCode
- Reads this file natively as AGENTS.md; no hook system, run `/boot` and `/wrap-up` manually
- Headless: `opencode run "prompt"`

### Antigravity
- Reads this file natively as AGENTS.md
- Subagents are NOT auto-discovered; register them at session start using the manifest:
  1. Read `.anti/agents.json` (auto-generated by `make sync-agents`)
  2. For each entry, call the `define_subagent` **LLM tool** with `name`, `description`, `system_prompt`
- Regenerate the manifest after editing `.agent/agents/*.md`: `make sync-agents`
- Dispatch via `invoke_subagent(TypeName, Prompt)` once agents are registered
- Continue: `agy -c` | Headless: `agy -p "prompt"`

### Grok CLI
- Reads this file natively as AGENTS.md
- No hook output reaches you: on your first turn run `bash execution/hooks/full_boot.sh` and read its output before any substantive work.
