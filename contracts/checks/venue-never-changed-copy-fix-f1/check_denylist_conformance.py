#!/usr/bin/env python3
"""A8 — proves the denylist regex is identical across check-seed-script.sh,
check_golden_json.py, check_live_doc.py and check_negative_controls.py, so this
contract cannot suffer the exact drift bug venue-prose-residue's v2 found in
itself (documented phrase list wider than what the checker actually
implemented, gate green while the defect stayed open). Every DENYLIST source in
this directory must match byte-for-byte.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent

SOURCES = {
    "check-seed-script.sh": re.compile(r"DENYLIST='([^']+)'"),
    "check_golden_json.py": re.compile(r'DENYLIST = re\.compile\(\s*\n?\s*r"([^"]+)"\s*\n?\s*r"([^"]+)"', re.DOTALL),
    "check_live_doc.py": re.compile(r'DENYLIST = re\.compile\(\s*\n?\s*r"([^"]+)"\s*\n?\s*r"([^"]+)"', re.DOTALL),
    "check_negative_controls.py": re.compile(r'DENYLIST = re\.compile\(\s*\n?\s*r"([^"]+)"\s*\n?\s*r"([^"]+)"', re.DOTALL),
}


def extract(name: str) -> str:
    text = (HERE / name).read_text(encoding="utf-8")
    pattern = SOURCES[name]
    m = pattern.search(text)
    if not m:
        raise ValueError(f"could not locate DENYLIST in {name}")
    return "".join(g for g in m.groups() if g)


def main() -> int:
    values = {name: extract(name) for name in SOURCES}
    baseline_name, baseline = next(iter(values.items()))
    ok = True
    for name, value in values.items():
        if value != baseline:
            print(f"FAIL: DENYLIST in {name} differs from {baseline_name}\n  {name}: {value!r}\n  {baseline_name}: {baseline!r}")
            ok = False
    if ok:
        print("PASS: DENYLIST regex is identical across all four checker scripts")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
