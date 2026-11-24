#!/usr/bin/env python3
"""Fill a page's copy-doc source JSON from its legacy Drive doc, using the role map in the JSON.

The role map is part of each page's JSON: every element names the legacy paragraph it comes from
(`legacyPara`, an index into the docx's paragraphs) and, when the legacy doc wrote "Role: copy",
the prefix to drop (`legacyPrefix`). This script slices each element's `text` out of that
paragraph; copy is parsed, never retyped (docs/rules/no-invention.md).

It refuses, and writes nothing, when:
  - an element has no `legacyPara`, or its paragraph does not start with its `legacyPrefix`;
  - the elements do not follow the legacy doc's order (the copy check compares in order);
  - a non-empty legacy line is neither copy nor a Heading-styled label: every line must be mapped,
    so nothing in the editor's doc is silently dropped;
  - a Heading-styled legacy line is used as copy but is not listed in `legacyCopyHeadings`.

Usage:
  import_legacy.py copy-docs/source/nos-landing.json legacy.docx --parsed-on 2026-11-25 [--write]
Without --write it only reports. `source.parsedFromMd5` records the md5 of the legacy file read.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import date
from pathlib import Path

try:
    import docx
except ImportError:
    sys.exit("python-docx is required: python3 -m venv .venv && .venv/bin/pip install python-docx")


def fill(data: dict, legacy: Path, parsed_on: str) -> list[str]:
    """Fill `data` in place from the legacy doc; return a list of problems (empty means OK)."""
    paras = docx.Document(str(legacy)).paragraphs
    problems: list[str] = []
    copy_headings = set(data.get("legacyCopyHeadings", []))
    used: dict[int, str] = {}
    last = 0

    if data.get("title") != paras[0].text:
        problems.append(f"title {data.get('title')!r} is not the legacy doc's first line {paras[0].text!r}")

    for section in data["sections"]:
        for e in section["elements"]:
            where = f"{section['name']} / {e.get('role')}"
            i = e.get("legacyPara")
            if not isinstance(i, int) or not 0 < i < len(paras):
                problems.append(f"{where}: no valid legacyPara (copy is never retyped)")
                continue
            if i in used:
                problems.append(f"{where}: legacy paragraph {i} already used by {used[i]}")
            if i <= last:
                problems.append(f"{where}: legacy paragraph {i} is out of page order (after {last})")
            used[i], last = where, max(last, i)
            p = paras[i]
            prefix = e.get("legacyPrefix", "")
            if not p.text.startswith(prefix):
                problems.append(f"{where}: paragraph {i} {p.text[:60]!r} does not start with {prefix!r}")
                continue
            if p.style is not None and p.style.name.startswith("Heading") and p.text not in copy_headings:
                problems.append(f"{where}: paragraph {i} is a Heading line not listed in legacyCopyHeadings")
            e["text"] = p.text[len(prefix):]

    for i, p in enumerate(paras[1:], start=1):
        if not p.text or i in used:
            continue
        if p.style is not None and p.style.name.startswith("Heading") and p.text not in copy_headings:
            continue            # a section title of the legacy doc: a label, not page copy
        problems.append(f"legacy paragraph {i} {p.text[:60]!r} is not mapped to any element")

    src = data.setdefault("source", {})
    src["parsedFromMd5"] = hashlib.md5(legacy.read_bytes()).hexdigest()
    src["parsedOn"] = parsed_on
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("source", type=Path, help="the page's source JSON, holding the role map")
    ap.add_argument("legacy", type=Path, help="the legacy Drive doc, downloaded as .docx")
    ap.add_argument("--parsed-on", default=date.today().isoformat())
    ap.add_argument("--write", action="store_true", help="write the filled JSON back to `source`")
    a = ap.parse_args()

    data = json.loads(a.source.read_text(encoding="utf-8"))
    problems = fill(data, a.legacy, a.parsed_on)
    if problems:
        print(f"REFUSED: {len(problems)} problem(s); nothing written")
        for line in problems:
            print(f"  - {line}")
        return 1
    n = sum(len(s["elements"]) for s in data["sections"])
    out = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if a.write:
        a.source.write_text(out, encoding="utf-8")
        print(f"OK: {n} elements filled from {a.legacy.name}; wrote {a.source}")
    else:
        same = out == a.source.read_text(encoding="utf-8")
        print(f"OK: {n} elements filled from {a.legacy.name}; JSON {'unchanged' if same else 'would change'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
