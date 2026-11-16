"""Verify the What to Expect v1.2 page: before-page.tsx + the four pinned edits == the page, exactly.
usage: verify_wte_v12.py <edits.json> <before-page.tsx> <page.tsx>"""
import json
import sys

edits_path, before_path, page_path = sys.argv[1:4]
edits = json.load(open(edits_path))["edits"]
expected = open(before_path).read()
for e in edits:
    found = expected.count(e["before"])
    want = e.get("count", 1)
    if found != want:
        sys.exit("golden drift: %s before-string found %d times, want %d" % (e["id"], found, want))
    expected = expected.replace(e["before"], e["after"])
actual = open(page_path).read()
if actual != expected:
    import difflib
    d = "".join(list(difflib.unified_diff(expected.splitlines(1), actual.splitlines(1), "expected", "actual"))[:40])
    sys.exit("page differs from before-page.tsx plus the four edits:\n" + d)
print("OK: page is before-page.tsx plus exactly the four pinned edits")
