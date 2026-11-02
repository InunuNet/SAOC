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

- **Service folder.** `/Users/vetus/ai/Voice/MacOS/` holds the model, its venv and `tools/speak.py`. It
  lives outside git. `VOICE_HOME` or `--home` selects another folder.
- **Off by default.** Nothing speaks until the operator creates `/Users/vetus/ai/Voice/MacOS/.enabled`.
  Deleting that file turns the voice off again. Agents do not create it.
- **Away.** A project containing `.agent/memory/scratch/UNATTENDED` is silent. Both the switch and
  UNATTENDED are read on every call.
- **Platform.** macOS only. Elsewhere the speaker exits 0, silently in hook mode, with one stderr line
  otherwise.

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
