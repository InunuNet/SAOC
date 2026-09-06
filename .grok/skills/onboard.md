# /onboard Skill

Onboarding is a **program**, not a form you fill in from memory. Run it, and
relay what it prints.

<!-- onboard:run -->
```bash
python3 execution/onboard_flow.py run
```

That command **is** the interview. It asks the questions, displays the harness
defaults, quarantines any inherited workspace state, calls the one writer,
proposes the git remote and ends with the boot panel. Do not ask the questions
yourself, do not paraphrase what it prints, and do not write any of the files
it owns.

## The one law it enforces

> Every value the operator sees is either DISPLAYED FROM DISK AND CONFIRMED,
> or ASKED. Nothing is inferred. Nothing is invented to fill a gap.

**The project name is the folder name. Never ask for it.** It is already in
`WORKSPACE`, and the flow reads it from there — which is why nothing below
passes a name flag.

A field the human does not supply is recorded as **unset and named as unset**:
no archetype guessed from the mission text, no stack guessed from the platform,
no scale guessed from how the work sounds. "Unknown until we look" is a
supported answer, not a dodge — say it, and put a scoping step first.

## The ten steps it runs, in order

1. `identity` — agent name (the project name, suggested), role, archetype.
2. `user-profile` — the harness default profile, confirmed or replaced whole.
3. `comms-contract` — the six fixed communication rules, confirmed.
4. `mission` — the human's words, read back before anything is written.
5. `scale` — asked separately, because it cannot be read off the mission.
6. `tech-stack` — proposed with reasons, or left unset.
7. `quarantine` — inherited memory and identity docs moved aside, never deleted.
8. `write-identity` — `execution/onboard_headless.py` writes; the gate flips here.
9. `git` — the proposal is shown; the human's confirmation is the only authorisation.
10. `panel` — the boot panel, and the last bytes of the run.

`python3 execution/onboard_flow.py steps` prints that list. A run that stops
early is visible in the panel's verdict rather than silent.

## Answering it

Interactively, answer each prompt as it comes. A confirm step takes `confirm`
or `edit` and nothing else; the git step takes `CONFIRM` or `DECLINE`.
Case does not matter, in a file or at the prompt — but those are the only
moves, and anything else is refused with nothing written.

For a scripted boot, put the answers in a JSON object — `agent_name`, `role`,
`archetype`, `user_profile`, `comms_contract`, `mission`, `scale`,
`tech_stack`, `git` — and point the flow at it:

```bash
ATHANOR_ONBOARD_ANSWERS=answers.json python3 execution/onboard_flow.py run
```

Empty `archetype` or `tech_stack` means unset. The run announces on its first
line that it is answering non-interactively.

## After it exits 0

Tell the human onboarding is complete, repeat the mission and the recorded
scale back in two lines, and name anything the panel reported as not ready —
git provisioning declined or unverified, most often. If the flow named a
quarantine directory, say so: it holds another workspace's memory, and only
the human decides what comes back out of it.

Exit 2 means an answer was neither of the two moves a confirm step offers:
nothing was written and nothing was created. Exit 1 means a step failed; the
boot gate stayed shut and the next boot retries.

## Driving the writer by hand

Only when the flow itself cannot run. One command performs every write —
`project_name` and `agent_name` in `.agent/profile.json`, `soul.md`, `user.md`,
the `## Mission` and `## Scale` sections of `goals.md`, `WORKSPACE`, and the
identity block of `AGENTS.md` with its clones:

```bash
python3 execution/onboard_headless.py \
  --agent-name "<agent_name>" \
  --role "<project_role>" \
  --archetype "<archetype>" \
  --mission "<mission>" \
  --mission-scale "<mission_scale>" \
  --tech-stack "<tech_stack>"
```

Add `--user-context "<user_context>"` only when the human replaced the default
profile. Every value is re-read from disk before the boot gate opens, so a
non-zero exit means the gate stayed **shut** — read the error, which names the
value that did not land, fix the cause, and re-run. It is idempotent.
