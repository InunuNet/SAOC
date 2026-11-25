#!/usr/bin/env python3
"""Fill a page's copy-doc source JSON from its legacy Drive doc, using the role map in the JSON.

The role map is part of each page's JSON: every element names the legacy paragraph it comes from
(`legacyPara`, an index into the docx's paragraphs) and, when the legacy doc wrote "Role: copy",
the prefix to drop (`legacyPrefix`). This script slices each element's `text` out of that
paragraph; copy is parsed, never retyped (docs/rules/no-invention.md).

v3.1: it also carries the author's own inline formatting and lists (read by docfmt.py, which also
reads text inside content controls that python-docx's Paragraph.text skips):
  - an element whose copy has bold, italic, underline, links etc. gets `runs` (the copy cut into
    formatted runs); plain copy gets no `runs`, so its JSON is unchanged from v3;
  - a list paragraph gets `list` ({"num", "level"}), and the JSON's `lists` table records each legacy
    list's level formats, level texts, starts and bullet fonts;
  - the title gets `titleRuns` when its line is formatted.
Paragraph 0 may itself be page copy (e.g. the page's h1). Its element then maps `legacyPara: 0`, and
the JSON's `title` is the Drive file name instead (`"titleFrom": "driveName"`), so the line is kept
once, labelled by its role.

It refuses, and writes nothing, when:
  - an element has no `legacyPara`, or its paragraph does not start with its `legacyPrefix`;
  - the elements do not follow the legacy doc's order (the copy check compares in order);
  - a non-empty legacy line is neither copy nor a section label: every line must be mapped, so
    nothing in the editor's doc is silently dropped. A section label is a Heading-styled line whose
    exact text is listed in `legacySectionLabels`; an unlisted Heading line must be mapped as copy;
  - a line listed in `legacySectionLabels` is also mapped as copy;
  - a line holds something the copy doc cannot carry (tracked changes, fields, images, a character
    style other than Hyperlink, or a run property docfmt.py does not carry);
  - a Heading-styled label line (dropped as a label) holds formatting, links or a list.

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
from collections import Counter
from pathlib import Path

try:
    import docx
except ImportError:
    sys.exit("python-docx is required: python3 -m venv .venv && .venv/bin/pip install python-docx")

sys.path.insert(0, str(Path(__file__).resolve().parent))
import docfmt  # noqa: E402  (sibling module; path set just above)


def fill(data: dict, legacy: Path, parsed_on: str) -> list[str]:
    """Fill `data` in place from the legacy doc; return a list of problems (empty means OK)."""
    paras, body_problems = docfmt.read_document(docx.Document(str(legacy)))
    problems: list[str] = list(body_problems)
    section_labels = set(data.get("legacySectionLabels", []))
    labels_left = Counter(data.get("legacySectionLabels", []))   # each entry covers one line
    used: dict[int, str] = {}
    last = -1
    lists: dict[str, dict] = {}

    elements = [(section["name"], e) for section in data["sections"] for e in section["elements"]]
    title_is_copy = any(e.get("legacyPara") == 0 for _, e in elements)
    elements = [(n, e) for n, e in elements if "acceptedAddition" not in e]   # additions have no legacy line
    if title_is_copy:
        drive_name = data.get("source", {}).get("driveName", "")
        if data.get("titleFrom") != "driveName" or data.get("title") != drive_name.rsplit(".docx", 1)[0]:
            problems.append("paragraph 0 is page copy, so `title` must be the Drive name with titleFrom: driveName")
        data.pop("titleRuns", None)
    else:
        first = paras[0]
        if data.get("title") != first["text"]:
            problems.append(f"title {data.get('title')!r} is not the legacy doc's first line {first['text']!r}")
        problems += [f"title line: {x}" for x in first["problems"]]
        if first["list"]:
            problems.append("title line is a list item")
        if docfmt.formatted(first["runs"]):
            data["titleRuns"] = first["runs"]
        else:
            data.pop("titleRuns", None)

    for name, e in elements:
        where = f"{name} / {e.get('role')}"
        i = e.get("legacyPara")
        if not isinstance(i, int) or not 0 <= i < len(paras) or (i == 0 and not title_is_copy):
            problems.append(f"{where}: no valid legacyPara (copy is never retyped)")
            continue
        if i in used:
            problems.append(f"{where}: legacy paragraph {i} already used by {used[i]}")
        if i <= last:
            problems.append(f"{where}: legacy paragraph {i} is out of page order (after {last})")
        used[i], last = where, max(last, i)
        p = paras[i]
        prefix = e.get("legacyPrefix", "")
        if not p["text"].startswith(prefix):
            problems.append(f"{where}: paragraph {i} {p['text'][:60]!r} does not start with {prefix!r}")
            continue
        if p["text"] in section_labels:
            problems.append(f"{where}: paragraph {i} is listed in legacySectionLabels but mapped as copy")
        problems += [f"{where}: paragraph {i}: {x}" for x in p["problems"]]
        e["text"] = p["text"][len(prefix):]
        runs = docfmt.slice_runs(p["runs"], len(prefix))
        if docfmt.formatted(runs):
            e["runs"] = runs
        else:
            e.pop("runs", None)
        if p["list"]:
            info = p["list"]
            if info.get("format") is None:
                problems.append(f"{where}: paragraph {i} has a list number with no definition")
                continue
            e["list"] = {"num": info["num"], "level": info["level"]}
            levels = lists.setdefault(info["num"], {"levels": {}})["levels"]
            spec = {k: info[k] for k in ("format", "text", "start", "font")}
            if levels.setdefault(str(info["level"]), spec) != spec:
                problems.append(f"{where}: list {info['num']} level {info['level']} changes definition")
        else:
            e.pop("list", None)

    for i, p in enumerate(paras):
        if not p["text"] or i in used or (i == 0 and not title_is_copy):
            continue
        if (p["style"] or "").startswith("Heading") and labels_left[p["text"]] > 0:
            labels_left[p["text"]] -= 1
            if docfmt.formatted(p["runs"]) or p["list"] or p["problems"]:
                problems.append(f"label paragraph {i} {p['text'][:40]!r} has formatting a label would drop")
            continue            # a section title of the legacy doc: a label, not page copy
        problems.append(f"legacy paragraph {i} {p['text'][:60]!r} is not mapped to any element")

    if lists:
        data["lists"] = lists
    else:
        data.pop("lists", None)
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
