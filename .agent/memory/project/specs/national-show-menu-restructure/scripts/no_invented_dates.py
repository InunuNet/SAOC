#!/usr/bin/env python3
"""Guard against a fabricated date/commitment: the NEW exhibitor-page banner and the
exhibitor OPTIONS entry's body on the tickets page must not contain a 4-digit year
or a day-of-week name. The honest claim is only "not yet open" — no invented date.

Scoped to just the new/changed text, not the whole file, since the tickets page's
PageHero lede already legitimately says "2027 SAOC National Show" (pre-existing,
unrelated content) — a whole-file check would false-fail on that.
"""
import re
import sys

YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
DAY_RE = re.compile(
    r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b", re.IGNORECASE
)


def offending(text: str) -> str | None:
    if YEAR_RE.search(text):
        return "contains a 4-digit year"
    if DAY_RE.search(text):
        return "contains a day-of-week name"
    return None


def main() -> int:
    failed = False

    exhibitors_path = "app/(marketing)/national-show/exhibitors/page.tsx"
    src = open(exhibitors_path, encoding="utf-8").read()
    idx = src.lower().find("not yet open")
    if idx == -1:
        print(f"{exhibitors_path}: banner text not found", file=sys.stderr)
        return 1
    line_start = src.rfind("\n", 0, idx) + 1
    line_end = src.find("\n", idx)
    banner_line = src[line_start : line_end if line_end != -1 else len(src)]
    problem = offending(banner_line)
    if problem:
        print(f"{exhibitors_path}: banner line {problem}", file=sys.stderr)
        failed = True

    tickets_path = "app/(marketing)/national-show/tickets/page.tsx"
    src = open(tickets_path, encoding="utf-8").read()
    match = re.search(
        r"id:\s*'exhibitor'.*?body:\s*(['\"])(.*?)\1", src, re.DOTALL
    )
    if not match:
        print(f"{tickets_path}: exhibitor OPTIONS body not found", file=sys.stderr)
        return 1
    problem = offending(match.group(2))
    if problem:
        print(f"{tickets_path}: exhibitor body {problem}", file=sys.stderr)
        failed = True

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
