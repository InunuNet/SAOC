#!/usr/bin/env python3
"""Exit 0 iff two JSON files are semantically equal (key order / whitespace ignored)."""
import json, sys
a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
if a == b:
    sys.exit(0)
print("MISMATCH", file=sys.stderr)
print("got :", json.dumps(a, sort_keys=True), file=sys.stderr)
print("want:", json.dumps(b, sort_keys=True), file=sys.stderr)
sys.exit(1)
