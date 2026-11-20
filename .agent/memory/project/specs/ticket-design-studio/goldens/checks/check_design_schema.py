#!/usr/bin/env python3
"""Validate ticket-design settings files against goldens/design-schema.json.
usage: check_design_schema.py <settings.json> [more.json ...]   exit 0 ok, 1 invalid."""
import json, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent.parent
schema = json.loads((HERE / "design-schema.json").read_text())

def fail(path, msg):
    print(f"FAIL {path}: {msg}"); sys.exit(1)

def check_block(path, name, block, extra):
    allowed = {**schema["shared"], **schema[extra]}
    if not isinstance(block, dict): fail(path, f"{name} is not an object")
    if set(block) != set(allowed): fail(path, f"{name} keys {sorted(block)} != {sorted(allowed)}")
    for key, val in block.items():
        if not any(val == a and type(val) is type(a) for a in allowed[key]):
            fail(path, f"{name}.{key}={val!r} not in {allowed[key]}")

for p in sys.argv[1:]:
    try: doc = json.loads(pathlib.Path(p).read_text())
    except Exception as e: fail(p, f"unreadable: {e}")
    if set(doc) != {"version", "slug", "email", "pdf"}: fail(p, f"top-level keys {sorted(doc)}")
    if doc["version"] != 1: fail(p, "version != 1")
    if pathlib.Path(p).name.split(".")[0] != doc["slug"]: fail(p, "file name does not match slug")
    check_block(p, "email", doc["email"], "email")
    check_block(p, "pdf", doc["pdf"], "pdf")
print("design schema ok:", len(sys.argv) - 1, "file(s)")
