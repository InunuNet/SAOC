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

## Never put a variable in an `rm` argument

The shell guard does not help. Claude Code scans the *command text* for a
delete whose path comes from a variable and raises "Dangerous rm operation on
possibly-empty variable path". That scan runs ahead of the permission system,
so neither `defaultMode: bypassPermissions` nor a blanket `Bash` allow rule
suppresses it, and `[ -n "$f" ] && [ -e "$f" ] && rm -f -- "$f"` prompts
exactly like the bare form -- the scanner sees `rm` and `$f`, not the test in
front of it. This rule used to prescribe that guard and was wrong: it cost the
operator a hand-approval on every sandbox cleanup an agent performed.

The autonomy floor separately denies `rm -rf` and `find ... -delete`
unconditionally, with no exception.

So once a path is computed, there is no prompt-free shell delete. Use the
shipped helper, which checks containment against *resolved* paths -- a real
check rather than a textual one:

```sh
python3 execution/safe_delete.py .tmp/sandbox/a12/{real,c1,c2}.toml
python3 execution/safe_delete.py .tmp/sandbox/a12
```

It takes files and directories, treats a missing path as already done, and
refuses anything that is not strictly inside `<project>/.tmp/sandbox` --
including the sandbox root itself. Exit 0 when everything was removed, 1 if
any target was refused.

A literal path with no variable in it is still fine and needs no helper:

```sh
rm -f .tmp/sandbox/a12/probe.toml
```

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

## Escalate, don't route around

Needing to write outside the project folder is a **stop and ask**, not a judgment call.
See `scope.md`. Never ask a peer session or subagent to perform an action blocked in
your own — that launders the user's permission decision.
