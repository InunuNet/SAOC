# Workspace Scope

## The boundary

Nothing outside this project folder is read, written, or modified without
permission **asked and granted first** — in that order. Asking afterwards is not
asking; it is a report.

Inside `<project-root>/` you are free. Outside it, everything belongs to someone
else: the operator's home directory, the machine's shared configuration, and every
sibling project. A cross-project edit is how work is lost — the other project has
its own agent, its own history, and no idea you were there.

## Asking properly

A permission request names the **full path** and says **which tree** it is in. A
bare provider-directory path is ambiguous and will be refused, because these are
two different files:

| path | tree | owner |
|---|---|---|
| `~/.claude/settings.json` | global — shared by every project on this machine | the operator |
| `<project>/.claude/settings.json` | this project | you |

The same distinction holds for `~/.gemini/` against `<project>/.gemini/`, and for
every other provider directory. Write the qualifier every time; never make the
reader guess which tree you mean.

Then state the operation and why it cannot be done inside the project — and wait.

## The fix is almost always local

A task that looks like it needs a global edit usually needs a project-scoped one:
configure `<project>/.claude/settings.json` rather than the global file, record
knowledge with `python3 execution/brain.py remember` rather than in a shared notes
tree, and file harness defects upstream (see `athanor.md`) rather than patching a
vendored script in place.

## Escalation

Blocked at the boundary: stop, name the full path and the operation you need, ask,
and wait for an answer. Do not rationalise an exception. Never ask a peer session
or a subagent to perform an action blocked in your own — that launders the
decision instead of obtaining it.
