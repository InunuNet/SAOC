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

## Never delete sandbox files. Ever.

`.tmp/` is gitignored. Leaving a scratch file there costs nothing. Deleting one costs
an operator interruption, because `rm` with a variable or glob path is not statically
resolvable and the harness prompts on it — `rm -rf` is denied outright by an autonomy hook,
and even a guarded `rm -f -- "$d/$f"` prompts.

| | |
|---|---|
| ✅ do | leave scratch files in `.tmp/sandbox/<purpose>/` when done |
| ❌ never | `rm`, `rm -f`, `rm -rf`, or `rmdir` against any sandbox path |

An interruption is far more expensive than a stale scratch file. If `.tmp/` ever genuinely
needs clearing, that is a housekeeping task the operator runs, not something an agent does
mid-mission.

This applies to every agent, including subagent briefs: do not instruct a subagent to
"remove your subdirectory when done."

## Never prompt the operator. Route blockers upstream instead.

A permission prompt breaks autonomous operation. It is not a neutral checkpoint — it stalls
the mission and the answer is no.

When a tool call is blocked or would prompt:

1. Find the path that does not prompt (a different command shape, or simply skipping the
   step — as with sandbox deletes above).
2. If none exists, file it upstream against `InunuNet/Athanor` with the exact command,
   the hook or heuristic that blocked it, and a proposed fix.
3. Continue the mission. Never stop to ask, never re-run the rejected command verbatim,
   never route the same action through a peer session or subagent.

Blocked ≠ ask. Blocked = work around it, report it, keep going.

## THE GOLDEN RULE: never block. Ever.

**A command that stops on a permission modal is a mission failure, not a checkpoint.**
The operator's answer is no, the session hangs, and every agent downstream stalls behind it.
Nothing an individual command achieves is worth that.

So: **never issue a command that can prompt.** If one is denied or would prompt, change the
command shape and continue. Never re-run the same shape, never wait, never ask, never route
it through a peer. Completing the mission outranks any individual command.

### The single biggest cause: `cd`

`cd` makes the *following* command's target statically unresolvable. The harness cannot tell
what will be read, a `Read()` deny rule exists, and it escalates to a human modal. **Your cwd
is already the project root**, so a `cd` there buys nothing and costs the session.

| never | always |
|---|---|
| `cd /abs/path && grep -rl X lib/*.ts` | `grep -rl X lib/` |
| `grep -rl X .` | `grep -rl X components/` |
| `grep -rn X lib/*.ts` | `grep -rn --include='*.ts' X lib/` |

Name the directory. Never a bare `.`. Never an absolute path inside the project. Quote every
glob (`--include='*.ts'`) — this is zsh; an unquoted glob is expanded before the command sees
it and a no-match aborts the line.

### Other known prompt-triggers, all avoidable

- Any delete against a sandbox path — don't delete, ever (see above).
- `find` with `-exec` or `-delete` — denied outright; use `ls -lhR` or a plain `find` and pipe.
- A command whose *arguments* contain `contract.py` … `gate`, or a recursive-force delete
  string — two hooks match the whole command line, not the executed command. Rephrase to
  avoid the literal tokens.

### If you are ever stuck at a prompt anyway

Do not sit there. Abandon that command shape, record what was attempted, and continue the
mission by another route. A partially-verified step reported honestly beats a hung session.
