#!/usr/bin/env python3
"""Verifier for mission claude-md-slim. Usage: verify_slim.py <size|kept|coverage|pointers|guide|files>

HEAD is pinned: CLAUDE.md is compared with the committed copy at PIN, not the moving HEAD.
Run from the project root.
"""
import os
import re
import subprocess
import sys

PIN = "c759899f5fe4a6ec95e0d96ab53bc28f020f301a"
LIMIT = 7000
GUIDE = "PROJECT_GUIDE.md"
KEPT = ["Client Context", "Tech Stack", "Coding Conventions", "Running Locally", "Deployment"]
MOVED = ["Project Structure", "Firebase Setup", "Adding Data (No Code Changes Needed)", "Design Handoff Workflow"]
IGNORED_PREFIXES = (".agent/", ".codex/", "branding/", "test-results/", ".tmp/")
ALLOWED = {"CLAUDE.md", GUIDE}


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def read(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def sections(text):
    """Split on level-2 headings; key '' is the preamble (title)."""
    out, key, buf = {}, "", []
    for line in text.splitlines(keepends=True):
        m = re.match(r"## (.*?)\s*$", line)
        if m:
            out[key] = "".join(buf)
            key, buf = m.group(1), [line]
        else:
            buf.append(line)
    out[key] = "".join(buf)
    return out


def nonblank(text):
    return [ln.rstrip("\n") for ln in text.splitlines() if ln.strip()]


def fail(msg):
    print("FAIL: " + msg)
    sys.exit(1)


def main():
    check = sys.argv[1] if len(sys.argv) > 1 else ""
    head = git("show", f"{PIN}:CLAUDE.md")
    new = read("CLAUDE.md")
    hs = sections(head)

    if check == "size":
        n = len(new.encode("utf-8"))
        if n > LIMIT:
            fail(f"CLAUDE.md is {n} bytes, limit {LIMIT}")
    elif check == "kept":
        pre = hs[""].rstrip()
        if pre not in new:
            fail("title/preamble not byte-identical to HEAD")
        for name in KEPT:
            if name not in hs:
                fail(f"pinned HEAD has no section {name}")
            if hs[name].rstrip() not in new:
                fail(f"kept section not byte-identical: {name}")
    elif check == "coverage":
        guide = read(GUIDE)
        have = set(nonblank(new)) | set(nonblank(guide))
        missing = [ln for ln in nonblank(head) if ln not in have]
        if missing:
            fail(f"{len(missing)} HEAD lines lost, first: {missing[0][:100]!r}")
        for name in MOVED:
            if hs[name].rstrip() not in guide:
                fail(f"moved section not contiguous and verbatim in guide: {name}")
    elif check == "pointers":
        lines = nonblank(new)
        for name in MOVED:
            title = name.split(" (")[0]
            if not any(GUIDE in ln and title in ln and not ln.startswith("#") for ln in lines):
                fail(f"no pointer line naming {name!r} and {GUIDE}")
        headline = [ln for ln in lines if ln.startswith("#")]
        hset = set(nonblank(head))
        stray = [ln for ln in lines if ln not in hset and GUIDE not in ln and not ln.startswith("#")]
        if stray:
            fail(f"CLAUDE.md has non-pointer new line: {stray[0][:100]!r}")
        if len([ln for ln in headline if ln not in hset]) > 1:
            fail("CLAUDE.md adds more than one new heading")
        for name in MOVED:
            if f"## {name}" in new:
                fail(f"moved section heading still in CLAUDE.md as a section: {name}")
    elif check == "guide":
        guide = read(GUIDE)
        hset = set(nonblank(head))
        lines = nonblank(guide)
        if not lines or not lines[0].startswith("# ") or lines[0] in hset:
            fail("guide must open with its own new '# ' title")
        novel = [ln for ln in lines if ln not in hset]
        if len(novel) > 2:
            fail(f"guide has {len(novel)} lines not from HEAD (max 2: title + intro), first extra: {novel[2][:100]!r}")
    elif check == "files":
        changed = set(git("diff", "--name-only", PIN).splitlines())
        changed |= set(git("ls-files", "--others", "--exclude-standard").splitlines())
        extra = sorted(p for p in changed if p not in ALLOWED and not p.startswith(IGNORED_PREFIXES) and p not in BASELINE())
        if extra:
            fail(f"unexpected changed paths: {extra[:5]}")
        if GUIDE not in changed:
            fail(f"{GUIDE} not created")
        if "CLAUDE.md" not in changed:
            fail("CLAUDE.md not changed")
    elif check == "links":
        for f in ("CLAUDE.md", GUIDE):
            for target in re.findall(r"\]\(([^)\s]+)\)", read(f)):
                if re.match(r"^([a-z][a-z0-9+.-]*:|#|/)", target):
                    continue
                path = target.split("#")[0].split("?")[0]
                if not path:
                    continue
                at_pin = subprocess.run(["git", "cat-file", "-e", f"{PIN}:{path}"], capture_output=True).returncode == 0
                if at_pin and not os.path.exists(path):
                    fail(f"{f}: link {target!r} resolved at the pin but not from the repo root now")
    else:
        fail("usage: verify_slim.py size|kept|coverage|pointers|guide|files|links")
    print("PASS " + check)


def BASELINE():
    """Paths already dirty outside the ignored prefixes when the contract was written."""
    path = ".agent/memory/project/specs/claude-md-slim/goldens/baseline-dirty.txt"
    return set(read(path).splitlines())


main()
