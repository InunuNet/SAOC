# Sandbox Rule

Permission bypass is **scoped to the project folder**. Work done outside it is not
covered, falls through to permission heuristics, and prompts the user by hand — which
stalls any autonomous mission.

## Sandbox inside the project. Always.

| | path |
|---|---|
| ✅ use | `<project>/.tmp/sandbox/<purpose>/` |
| ❌ never | `/tmp/...`, `/private/tmp/...`, the session scratchpad, a bare `mktemp -d` |

`.tmp/` is gitignored — an in-project sandbox pollutes nothing. Remove your subdirectory
when done; leave `.tmp/sandbox/` in place.

This binds shipped `contract.yaml` assertion commands too. **An assertion that prompts
cannot run in a gate.**

## Guard every variable delete path

A bare `rm "$A/$B/$C"` prompts even inside the project — an empty variable makes it a
dangerous-path delete.

```sh
del(){ [ -n "$1" ] && [ -e "$1" ] && rm -f -- "$1"; }
del "$W/$prov/$cls/$victim"
```

Same for `rm -r` on a sandbox dir: guard the variable, always `--`, never let an unset
variable expand into a delete path.

## Never `cd`. Inside the project, use relative paths

**Never `cd`** — because it makes the *following* command's target statically
unresolvable. `grep`/`cat`/`head`/`sed`/`find` prompt the operator whenever the
harness cannot determine what will be read; the scaffold ships `Read(~/.ssh/*)`
and its siblings as deny rules, and once any `Read()` deny exists, an
unresolvable target must be approved by hand — no matter that `Bash`/`Grep` are
allowed and the command is read-only. A bare `.` search root is exactly as
unresolvable as a `cd`; name the directory.

**Your cwd is already the project root.** So write paths relative to it. A
`cd` to the root is redundant churn that costs a prompt, and absolute paths
inside the project are noise that make every command longer to read without
making it safer.

| don't | do |
|---|---|
| `cd "$dir" && grep -n foo file.py` | `grep -n foo execution/file.py` |
| `grep -rl foo .` | `grep -rl foo execution/` |
| `grep -rn x /Users/you/ai/Proj/execution/` | `grep -rn x execution/` |

**Absolute paths are for outside the project only** — because a prompt that
does fire out there has to be *approvable*. `~/.claude/settings.json` (the
machine-global file, shared by every project) and `<project>/.claude/settings.json`
(this project's own file) both render to the operator as `.claude/settings.json`
once the path is relative — they cannot tell which tree is about to be touched,
and can only refuse. `scope.md` states the same requirement for permission
requests ("names the full path and says which tree it is in"); that applies to
any tool call reaching beyond the project boundary.

Quote every glob-bearing argument (`--include='*.sh'`). This is zsh: an
unquoted glob is expanded by the shell before the command sees it, and a
no-match aborts the whole command.

`cd` is the single most common source of interruptions during autonomous work.

## The Claude auto-memory directory is outside the project. Do not write to it.

`~/.claude/projects/<project-slug>/memory/` is **outside the project folder**, so every write
there is an out-of-sandbox write and prompts the operator by hand.

This one is easy to miss because the model's own system prompt describes that directory as its
persistent memory and tells it to write there — the instruction predates this rule and does not
know the sandbox boundary exists. Following it stalls the mission.

| | path |
|---|---|
| ✅ use | `.agent/memory/project/learned.md`, `.agent/memory/project/backlog.md`, `python3 execution/brain.py remember` |
| ❌ never | `~/.claude/projects/<slug>/memory/`, `~/.claude/MEMORY/` |

`scope.md` already routes global-memory writes to the in-project equivalents; this states the
sandbox consequence of ignoring it. A promise to write to the right place is not a fix — moving
the memory in-project removes the out-of-root write entirely, so the prompt cannot fire.

## Escalate, don't route around

Needing to write outside the project folder is a **stop and ask**, not a judgment call.
See `scope.md`. Never ask a peer session or subagent to perform an action blocked in
your own — that launders the user's permission decision.
