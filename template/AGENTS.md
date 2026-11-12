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

## 1. Identity

<!-- IDENTITY:BEGIN — rewritten by execution/onboard_fill.py; do not edit by hand -->
**Identity not yet configured.** You are the as-yet-unnamed primary agent of
{{PROJECT_NAME}}. Run `/onboard` to receive your name and role.
<!-- IDENTITY:END -->

Your persona and domain expertise are defined in `.agent/identity/soul.md`.
Your user's preferences are in `.agent/identity/user.md`.

Codex CLI, OpenCode, Antigravity and Grok read this file as AGENTS.md and get no boot hook: on
your first turn run `bash execution/hooks/full_boot.sh` and read its output. Claude Code also
loads the path-scoped files in `.claude/rules/` when you touch a matching file; the others read
`.agent/rules/_core/` on demand.

## 2. Memory: read on demand, never whole

Memory lives in this project's `.agent/memory/` and the brain, never in a provider-specific
location. None of it is loaded at session start.
- `project/goals.md`, `project/backlog.md` (the mission queue, pulled only when no mission is
  active), `project/rules.md` (project rules, they take precedence): read when the task needs
  them.
- `project/learned.md` is large: `tail -n 60`, then `grep -n -i <topic>` or
  `python3 execution/brain.py recall "<query>" --n 5`. Never read it whole.
- Working notes go in `.agent/memory/scratch/`. Store each distinct topic, decision and root
  cause as its own tagged `brain.py remember --summary ... --tags ...`; run `brain.py wrap-up`
  once at session end.

## 3. Hard rules

1. **Scope**: nothing outside this project folder is read, written or modified without permission
   asked and granted first. The one standing exception is appending a finding to another
   project's root `comms.md`. Blocked at the boundary: stop, name the path and operation, ask.
2. **Security**: confirm before `rm -rf` on a broad path, `git push --force`, `chmod 777`,
   `curl | sh`. Never read `~/.ssh`, `~/.aws/credentials`, `~/.gnupg` or another project's
   `.env`. Never commit a `.env`, log a credential, or put one in source; use
   `python3 execution/env_keys.py`.
3. **Sandbox**: scratch work goes in `.tmp/sandbox/<purpose>/`, never `/tmp` or a bare `mktemp`.
   Never `cd`: use relative paths inside the project, absolute only outside it. Never put a
   variable in an `rm` argument; use `python3 execution/safe_delete.py`. Quote every glob.
4. **Chain Continuous**: never pause between chain steps; stop only at a mission boundary or a
   BLOCKED verdict.
5. **Context-Lean**: about 100k tokens working context per session, 300k hard ceiling. The
   orchestrator never does grunt work, each spawned agent gets ONE narrow self-contained
   mission, and on-disk scratch/specs/memory is the transfer channel. Agents reply in at most 10
   lines and the lead reads scratch results head/tail capped, never the whole file
   ([detail](docs/harness/CONTEXT_LEAN_ORCHESTRATION.md)).
6. **Native first, real code, least tokens**: platform features before custom code, no
   placeholders, BLUF and bullets. Writers serial, readers parallel: one writer per feature.
7. **Self-anneal**: error, fix, record the lesson in `learned.md`.
8. **Harness updates are mandatory**: Brad improves Athanor so every project works better, and
   each harness release is his direct instruction to update. When boot, a directive or Athanor
   reports a newer harness, commit in-flight work, run `make update-template`, commit the result
   and restart when convenient. Never ask Brad first; your `settings.local.json` overrides stay
   yours (Brad 2026-11-11).

## 4. Workflow

**Mission = goal = purpose**: the outcome the work is for. A green gate whose goal state is not
true is a failed mission, so every assertion tests the outcome itself, executed, never a proxy.

Classify every request before substantive work, then run the lean lane: contract + dev + gate,
with docs inline in the commit and the maintainer step one `brain.py remember`. @architect only
when the feature declares a design decision; cross-model @qa only when blast radius says so
(credentials, floor-protected files, hooks, production config). Classification is by blast
radius, not file count. Decision tree, draft lane and cross-model QA rule:
`.agent/rules/_core/workflow.md`. DONE = the goal is verifiably true, docs verified, brain
wrapped. `contract.py gate` runs the current spec's assertions only; read
[docs/harness/GATE_SWEEP.md](docs/harness/GATE_SWEEP.md) before `make gate-all`.

## 5. Reference

Agent roster, harness commands, service mapping (Alembic, gws) and per-provider notes:
[docs/harness/AGENT_REFERENCE.md](docs/harness/AGENT_REFERENCE.md). Web fetches go through
Alembic and Google Workspace through `gws`; both have scoped rules and skills.
