#!/usr/bin/env python3
"""nos-sticky-aside A1/A3: the branch changes nos-structure.css by exactly one declaration (--doc-aside-top 100px -> 121px) plus optional comment text.

Outside .agent/ and .tmp/ no other tracked file may differ from the merge-base with origin/main. Inside the CSS file, once /* */ comments are stripped
and whitespace normalised, the base file with the one declaration re-valued must equal the working file, so no selector, property, value or content
string changed. Run from the repo root. Exit 0 pass, 1 violation, 2 setup failure."""
import re
import subprocess
import sys

CSS = "app/(nos)/national-show/nos-structure.css"
OLD, NEW = "--doc-aside-top: 100px;", "--doc-aside-top: 121px;"
IGNORED_PREFIXES = (".agent/", ".tmp/")


def git(*args):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"SETUP git {' '.join(args)}: {r.stderr.strip()}")
        sys.exit(2)
    return r.stdout


def strip(text):
    return re.sub(r"\s+", " ", re.sub(r"/\*.*?\*/", "", text, flags=re.S)).strip()


base = git("merge-base", "HEAD", "origin/main").strip()
changed = [p for p in git("diff", "--name-only", base).splitlines() if p and not p.startswith(IGNORED_PREFIXES)]
if changed != [CSS]:
    print(f"FAIL files changed vs {base[:8]}: {changed} (want only [{CSS!r}])")
    sys.exit(1)
old = git("show", f"{base}:{CSS}")
if strip(old).count(OLD) != 1:
    print(f"FAIL base file does not carry exactly one '{OLD}'")
    sys.exit(1)
with open(CSS, encoding="utf-8") as fh:
    new = fh.read()
if strip(old).replace(OLD, NEW) != strip(new):
    print("FAIL code (non-comment) content differs beyond the one declaration")
    sys.exit(1)
print(f"PASS only {CSS} changed; only '{OLD}' -> '{NEW}' outside comments")
