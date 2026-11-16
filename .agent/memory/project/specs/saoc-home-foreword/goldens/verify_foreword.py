"""Check every source paragraph appears verbatim (whitespace-collapsed) in the foreword data file."""
import re
import sys

norm = lambda s: re.sub(r"\s+", " ", s).strip()
src = open(sys.argv[1], encoding="utf-8").read().split("\n\n")
dst = norm(open(sys.argv[2], encoding="utf-8").read())
missing = [p for p in (norm(x) for x in src) if p and p not in dst]
if missing:
    print("MISSING:", missing[0][:80])
    sys.exit(1)
print("ok", len(src))
