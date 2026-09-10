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

## Tearing down a whole sandbox directory

Never `rm -rf` a sandbox directory, and never fall back to `find … -delete` —
the autonomy floor denies both unconditionally, with no exception. An agent
that reaches for either is stopped every time.

Use a resolved-path containment guard in Python instead: it deletes only what
is strictly inside the sandbox, and refuses everything else, including the
sandbox root itself.

```python
import shutil
import sys
from pathlib import Path

def safe_rmtree(target: Path) -> None:
    target = target.resolve()
    root = (Path.cwd() / ".tmp" / "sandbox").resolve()
    if target == root or root not in target.parents:
        print(f"refusing to delete outside the sandbox: {target}", file=sys.stderr)
        return
    if target.is_dir():
        shutil.rmtree(target, ignore_errors=True)

if __name__ == "__main__":
    safe_rmtree(Path(sys.argv[1]))
```

Save it as a local script and run it from the project root, naming the case
directory to remove:

```sh
python3 .tmp/sandbox/safe_rmtree.py .tmp/sandbox/<purpose>/<case>
```

## Never `cd`, and always use absolute paths

Two rules, two different reasons — don't collapse them into one.

**Never `cd`** — because it makes the *following* command's target statically
unresolvable. `grep`/`cat`/`head`/`sed`/`find` prompt the operator whenever the
harness cannot determine what will be read; the scaffold ships `Read(~/.ssh/*)`
and its siblings as deny rules, and once any `Read()` deny exists, an
unresolvable target must be approved by hand — no matter that `Bash`/`Grep` are
allowed and the command is read-only. You are already in the project root, so a
`cd` to it is redundant churn that only costs a prompt, and a bare `.` search
root is exactly as unresolvable as a relative file — name the directory.

| don't | do |
|---|---|
| `cd "$dir" && grep -n foo file.py` | `grep -n foo /abs/path/file.py` |
| `grep -rl foo .` | `grep -rl foo /abs/path/` |

**Always use absolute paths** — because a prompt that does still fire has to be
*approvable*. `~/.claude/settings.json` (the machine-global file, shared by
every project) and `<project>/.claude/settings.json` (this project's own file)
both render to the operator as `.claude/settings.json` once the path is
relative — they cannot tell which tree is about to be touched, and can only
refuse. `scope.md` states the same requirement for permission requests ("names
the full path and says which tree it is in"); this is that principle applied
to tool calls, not just requests.

Together, these are the single most common source of interruptions during
autonomous work.

## Escalate, don't route around

Needing to write outside the project folder is a **stop and ask**, not a judgment call.
See `scope.md`. Never ask a peer session or subagent to perform an action blocked in
your own — that launders the user's permission decision.
