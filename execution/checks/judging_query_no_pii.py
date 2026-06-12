#!/usr/bin/env python3
"""B5l: judgingPageQuery must not project judge email/phone/contact fields.

Scoped to the judgingPageQuery block only — the file legitimately projects
`email` elsewhere (boardMembersQuery). Exit 0 = pass, 1 = fail.
"""
import re
import sys
from pathlib import Path

QUERIES = Path("/Users/vetus/ai/SAOC/sanity/queries.ts")
PII = re.compile(r"\b(email|phone|contact|mobile|tel)\b", re.IGNORECASE)


def main() -> int:
    if not QUERIES.exists():
        print(f"FAIL: {QUERIES} not found")
        return 1
    src = QUERIES.read_text()
    m = re.search(r"judgingPageQuery\s*=\s*defineQuery\(", src)
    if not m:
        print("FAIL: judgingPageQuery not found in sanity/queries.ts")
        return 1
    # Walk from the opening backtick to its matching closing backtick.
    start = src.find("`", m.end())
    end = src.find("`", start + 1)
    if start == -1 or end == -1:
        print("FAIL: could not isolate judgingPageQuery GROQ body")
        return 1
    body = src[start + 1 : end]
    hit = PII.search(body)
    if hit:
        print(f"FAIL: judgingPageQuery projects forbidden field '{hit.group(0)}'")
        return 1
    print("PASS: judgingPageQuery exposes no email/phone/contact fields")
    return 0


if __name__ == "__main__":
    sys.exit(main())
