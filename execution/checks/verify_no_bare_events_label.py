#!/usr/bin/env python3
"""Contract assertion for ticketing-nav-restructure/contract-f1.yaml (A8).

Scans exactly the files this contract touches/creates — nav-config.ts, MegaMenu.tsx,
Header.tsx, MobileMenu.tsx, and the new tickets chooser page — for the bare word
"Events" used to label something other than the existing, legitimate top-level societies-
calendar nav item (href /events). Deliberately does NOT scan the whole repo: app/(marketing)
/events/** and its content are the real, correct use of the word and must never be flagged.

An occurrence of "Events" is ALLOWED only when a line within 2 lines of it also mentions
the literal href '/events' (i.e. it's plausibly the same flat nav-item object/JSX block as
the legitimate top-level Events link). Any other occurrence is a naming-collision violation.
"""
import re
import sys

TARGET_FILES = [
    "components/chrome/nav-config.ts",
    "components/chrome/MegaMenu.tsx",
    "components/chrome/Header.tsx",
    "components/chrome/MobileMenu.tsx",
    "app/(marketing)/national-show/tickets/page.tsx",
]

WORD_RE = re.compile(r"\bEvents\b")
HREF_RE = re.compile(r"['\"]\/events['\"]")

def main() -> int:
    violations = []

    for path in TARGET_FILES:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if not WORD_RE.search(line):
                continue
            window = lines[max(0, i - 2): i + 3]
            if any(HREF_RE.search(w) for w in window):
                continue
            violations.append((path, i + 1, line.strip()))

    if violations:
        print("FAIL: bare 'Events' found outside the legitimate /events nav item:")
        for path, lineno, text in violations:
            print(f"  {path}:{lineno}: {text}")
        return 1

    print("PASS: no bare 'Events' label found outside the legitimate /events nav item")
    return 0

if __name__ == "__main__":
    sys.exit(main())
