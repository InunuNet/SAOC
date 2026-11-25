#!/usr/bin/env python3
"""diff_scope.py -- fail when the working tree changed any file outside the allow-list.

Usage: python3 <this> [--no-default-ignore] [--ignore PREFIX]... ALLOWED...
ALLOWED is an exact path, or a prefix ending in "/". The base is the merge-base of HEAD and
origin/main; committed, staged, unstaged and untracked files all count. By default .agent/ and
AGENTS.md are ignored (spec and memory churn); --no-default-ignore narrows that to the
--ignore prefixes only.
"""
import subprocess
import sys

args = sys.argv[1:]
ignore = [".agent/", "AGENTS.md"]
allowed = []
i = 0
while i < len(args):
    if args[i] == "--no-default-ignore":
        ignore = ["AGENTS.md"]
    elif args[i] == "--ignore":
        i += 1
        ignore.append(args[i])
    else:
        allowed.append(args[i])
    i += 1


def git(*cmd):
    r = subprocess.run(["git", *cmd], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"FAIL: git {' '.join(cmd)}: {r.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    return r.stdout


base = git("merge-base", "HEAD", "origin/main").strip()
changed = set(git("diff", "--name-only", base).split("\n"))
changed |= set(git("ls-files", "--others", "--exclude-standard").split("\n"))
changed.discard("")


def ok(path):
    if any(path == p or (p.endswith("/") and path.startswith(p)) for p in ignore):
        return True
    return any(path == a or (a.endswith("/") and path.startswith(a)) for a in allowed)


bad = sorted(p for p in changed if not ok(p))
if bad:
    print("FAIL: files changed outside the allowed scope:")
    for p in bad:
        print(f"  {p}")
    sys.exit(1)
print(f"OK: {len(changed)} changed path(s), all within scope")
