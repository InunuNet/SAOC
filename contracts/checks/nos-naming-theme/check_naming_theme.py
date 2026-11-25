#!/usr/bin/env python3
"""Static check for Brad's naming ruling of 25 Nov 2026.

The event is always "National Orchid Show", never "National Show", in public copy. Scans copy
sources under app/, components/, lib/ and content/ (not comments, route paths, or the verbatim
Drive extracts) and fails on any hit not in the reasoned allowlist.json.

Usage: check_naming_theme.py [--root DIR]
Reads source text only (no network, no build, no server). Exit 0 pass, 1 findings.
"""
import argparse
import json
import re
import sys
from pathlib import Path

SCAN_DIRS = ("app", "components", "lib", "content")
SKIP_DIRS = ("content/drive-recovered", "content/drive-source", "node_modules", ".next")
SCAN_SUFFIXES = (".ts", ".tsx", ".mjs", ".json", ".md", ".mdx")
ALLOWLIST = Path(__file__).resolve().parent / "allowlist.json"

# "National Show" not preceded by "Orchid ": the name, any case, any run of spaces. A path segment
# ("National Show/...") and a hyphenated route ("national-show") are not copy.
OLD_NAME = re.compile(r"(?<!Orchid )National\s+Show(?!/)", re.IGNORECASE)
COMMENT_LINE = re.compile(r"^\s*(//|/\*|\*|\{/\*)")


def source_files(root):
    for top in SCAN_DIRS:
        for path in sorted((root / top).rglob("*")):
            rel = path.relative_to(root).as_posix()
            if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
                continue
            if any(f"/{s}/" in f"/{rel}" for s in SKIP_DIRS):
                continue
            yield rel, path.read_text(encoding="utf-8").split("\n")


def allowed(entries, rel, line):
    return any(e["file"] == rel and e["contains"].lower() in line.lower() for e in entries)


def check_naming(root):
    entries = json.loads(ALLOWLIST.read_text(encoding="utf-8"))["naming"]
    problems = []
    for rel, lines in source_files(root):
        for number, line in enumerate(lines, 1):
            if COMMENT_LINE.match(line) and not rel.endswith(".json"):
                continue
            if OLD_NAME.search(line) and not allowed(entries, rel, line):
                problems.append(f"{rel}:{number}: 'National Show' without 'Orchid': {line.strip()[:110]}")
    return problems


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[3]))
    args = parser.parse_args(argv)
    problems = check_naming(Path(args.root))
    for problem in problems:
        print(problem)
    print(f"naming: {'FAIL, ' + str(len(problems)) + ' finding(s)' if problems else 'OK'}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
