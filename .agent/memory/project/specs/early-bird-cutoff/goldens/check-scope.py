#!/usr/bin/env python3
"""early-bird-cutoff scope guard. Fails when the edit touched anything beyond the two allowed
files inside the watched trees (so Ozow, payment, webhook, email, PDF, checkout, components,
copy, tests and goldens are all covered). Usage: check-scope.py <root>"""
import subprocess, sys

root = sys.argv[1] if len(sys.argv) > 1 else "."
ALLOWED = {"lib/data/ticket-card-view-models.ts", "lib/data/ticket-hub-source.ts"}
WATCHED = ("app/", "components/", "lib/", "sanity/", "emails/", "scripts/", "types/", "contracts/", "tests/", "docs/")

def git(*args):
    return subprocess.run(["git", "-C", root, *args], capture_output=True, text=True, check=True).stdout.splitlines()

changed = set(git("diff", "--name-only", "HEAD")) | set(git("ls-files", "--others", "--exclude-standard"))
stray = sorted(p for p in changed if p.startswith(WATCHED) and p not in ALLOWED)
if stray:
    print("FAIL: files outside the allowed edit list were changed:")
    for p in stray:
        print("  " + p)
    sys.exit(1)
print("scope ok: %d allowed file(s) changed, nothing else in the watched trees" % len(changed & ALLOWED))
