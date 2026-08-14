#!/usr/bin/env python3
"""GH #1296/#1310 — fail if the target script still uses a traversing
`find "$DIR/" -type f ... -delete` pattern (trailing slash on a variable
that may hold a symlinked directory path), which dereferences symlinks and
can delete through them. Usage: verify_no_traversing_find_delete.py <file>
"""
import re
import sys

path = sys.argv[1]
with open(path) as f:
    content = f.read()

pattern = re.compile(r'find\s+"\$\{?\w+\}?/"\s+-type\s+f[^\n]*-delete')
if pattern.search(content):
    print(f"FAIL: {path} still contains a traversing find-delete pattern (symlink-unsafe)")
    sys.exit(1)

print(f"PASS: {path} has no traversing find-delete pattern")
