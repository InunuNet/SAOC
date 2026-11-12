# Voice output

The harness can speak one short sentence on the operator's Mac when a mission gate goes green or an
agent needs the operator's input. It is off until the operator turns it on, and it never speaks twice
at once.

## What speaks

| Trigger | Sentence |
|---|---|
| `mission.py gate` passes a milestone | `<project>: gate green, mission <slug>` |
| Claude Code raises a Notification that needs input | `<project>: I need your input` |

Both start `execution/voice_say.py` in the background. A missing speaker, a missing service folder or a
failing backend never changes a gate verdict or blocks a prompt. A failing gate says nothing.

## Switch and silence

- **Service folder.** `/Users/vetus/.athanor/voice/` holds the model, its venv and `tools/speak.py`. It
  lives outside git. `VOICE_HOME` or `--home` selects another folder. (Migration: before 2026-11-08 the old home was ~/ai/Voice/MacOS.)
- **Chosen at onboarding.** `onboard_flow.py` prints, just before the closing panel, the voice the project
  gets by default, the audition command (`voice_say.py --voice NAME --text ...`) and the pool. The operator
  picks one and the agent records it as the project's entry in `voices.json`.
- **Off by default.** Nothing speaks until the operator creates `/Users/vetus/.athanor/voice/.enabled`.
  Deleting that file turns the voice off again. Agents do not create it.
- **Away.** A project containing `.agent/memory/scratch/UNATTENDED` is silent. Both the switch and
  UNATTENDED are read on every call.
- **Goodnight.** A prompt saying goodnight, going to bed or the like, typed in ANY project, makes the
  UserPromptSubmit hook (`voice_say.py --hook --event prompt`) write `/Users/vetus/.athanor/voice/.asleep`,
  and every project is then silent. The first prompt in any project at least 4 hours later
  (`VOICE_SLEEP_MIN_SECONDS`) removes it, so the operator's morning message resumes voice updates.
  Delete `.asleep` by hand to wake it sooner.
- **Platform.** macOS only. Elsewhere the speaker exits 0, silently in hook mode, with one stderr line
  otherwise.

## Voice for one project

Working through the night on one project: say "voice on" in it. The UserPromptSubmit hook creates that
project's `.agent/memory/scratch/VOICE_ON`, and the project speaks even while the fleet-wide `.asleep` is
set; every other project stays silent. "Voice off" removes the flag (no effect if it is absent), and a
goodnight in the project removes it while writing `.asleep` as usual. `.enabled` stays the master switch
and UNATTENDED still silences.

## One voice per project

Each project speaks in its own voice and under its own spoken name. The registry is
`voices.json` in the service folder. The operator owns it, the speaker only reads it, and a missing or
malformed file behaves like no entry:

```json
{"default": "af_nova", "projects": {
  "Alembic": {"voice": "bm_george", "name": "Alembic"},
  "JordanPumps": {"voice": "bm_daniel", "name": "Geordie"}}}
```

- **Key.** The project directory name, matched case-insensitively.
- **Voice.** The entry's `voice`, passed to the backend as `RANGER_VOICE` (always set, replacing any
  inherited value). A voice outside the pool passes through for the service to validate.
- **Hash fallback.** A project with no entry gets a stable voice from the pool of 28 English Kokoro
  voices (`af_`, `am_`, `bf_`, `bm_`): the pool entry at sha256 of the lowercase directory name, modulo
  the pool size. It is the same in every process. The registry's `default` key is informational only.
- **Spoken name.** The entry's `name`, else the directory name as spelled on disk.
- **No repeated introduction.** Before the sentence is composed, introduction units are stripped from the
  start of the message: the spoken name or directory name, optional filler words (`here`, `project`,
  `agent`, `session`, `speaking`, `is`, `this`) and then a separator (`, : . ; -`), the end of the message,
  or the word `here` or `speaking` right before the real text. "Alembic here, Alembic project, gate
  green" is spoken as "Alembic: gate green". Without such an ending nothing is stripped, so "Alembic is
  ready" keeps its words, and a name later in the message is never touched. A message that is empty after
  stripping says nothing.

## One voice at a time

Every call takes an exclusive `flock` on `.speak.lock` in the service folder and holds it for the whole
playback, so callers from any project queue. A line that waited longer than `VOICE_MAX_WAIT_SECONDS`
(default 60) for its turn is dropped and logged in `.speak.log`.

## Sentence rules

`<project directory name>: <message>`, whitespace collapsed, at most 160 characters, cut at a word
boundary. The backend is a subprocess: `VOICE_BACKEND_CMD` (the text is appended as the last argument)
or `<home>/.venv-voice/bin/python <home>/tools/speak.py`.

## Verification

Gates prove the queue, the policy and both triggers against a fake backend. Audible speech is the
operator's first listen after creating the switch file.
