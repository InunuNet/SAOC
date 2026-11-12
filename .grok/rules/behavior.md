---
description: Behavioral rules.
paths:
  - "execution/**"
  - "**/*.{py,sh}"
---

# Behavioral Rules

- Surgical fixes only: the smallest change that fixes the actual bug. Never delete, gut or
  rearchitect a component to make a problem go away; a hook throws, repair the line it threw on.
- Never assert without verification. Never state that something is a certain way until a tool
  has shown you; verify (test result, diff, screenshot) before claiming success.
- Minimal scope: change only what was asked. One change at a time when debugging: isolate,
  verify, proceed.
- Don't modify user content: quotes and text the user supplied are reproduced exactly.
- "Create a plan" means present the plan and STOP. No execution without approval.
- Compaction summaries: dense takeaways, no code blocks or transcripts, cite
  `execution/foo.py:42`, well under 2,000 tokens.

## Destructive actions: scoped by blast radius
Ask first for anything irreversible or outward-facing (force push, production deploy, deleting
outside the project, dropping unregenerable data, spending money), naming the consequence. Do
not ask for reversible work inside the project, or twice for what is already authorised. Report
the three cases distinctly:
- a guard or permission stopped you: **BLOCKED**, with path, guard and route tried
- done, but a judgment call is the operator's: **DECISION NEEDED**, recommendation first
- merely unsure: neither; make the call, name the assumption, continue

## Operator away
When the operator says they are away ("i'm afk", "going to bed", "run overnight"), first create
`.agent/memory/scratch/UNATTENDED`. Prompts then return as denials: do not retry one, take a
route needing no approval or skip and list it. The operator's next message removes the file.

## Token cost check
Before spawning multiple agents, bulk API calls or processing large files, say what it costs.
Low/medium autonomy: wait for a yes. High/autonomous: say the number and proceed. Stop and ask
at any level when spend is unusual or is money rather than tokens.

## Quota counts UP
0% is a fresh window and 100% is exhausted; the number is what has been SPENT. `5H 2% used`
just after a reset is 98% left, the best possible state with plenty of room. That is the reset
trap: a low figure after a reset is not "nearly out". At `85% used` finish the current feature,
commit, pause; at 100% stop and checkpoint. Read the `left` figure (`python3 execution/quota.py
status`). Codex and Antigravity native displays show % LEFT, counting down: establish direction
before acting. Never narrow scope, decline work or announce quota short on a reading whose
direction you have not checked.

## Voice and desktop
Speech goes only through `python3 execution/voice_say.py --text "..."`; never macOS `say`, `afplay` or the Voice backend directly, the floor denies them. One natural sentence that names the project once inside it, under 160 characters, never `--event` together with `--text`. A project owns its own entry in `~/.athanor/voice/voices.json` and changes its voice there when the operator says so; `--voice NAME` auditions one (Brad 2026-11-05). Brad saying "voice on" or "voice off" in a project toggles that project's own voice, even while the fleet is asleep.
Any action that touches the shared screen (opening or focusing a GUI app, screenshots, mouse or keyboard driving, browser automation, computer-use) runs under `python3 execution/desktop_turn.py run --reason "..." -- <command>` or between `acquire` and `release`; one holder at a time, ten minutes max; headless work needs no turn.
