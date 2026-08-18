#!/usr/bin/env python3
"""A5 (supplementary, non-load-bearing) structural check for
admin-signout-revocation/contract-f1.yaml.

Extracts the body of the `export async function DELETE(...)` handler from the given
route file and fails if it reads any client-supplied input (request.json(),
request.nextUrl.searchParams, request.url query parsing, or a destructured request
body) when resolving whose session to revoke. The uid must come only from the
'session' cookie already on the request via next/headers cookies().

This is deliberately a single-file, single-line-invocable script (not inline
python3 -c) per this project's contract assertion rules — multiline python3 -c
commands fail at contract.py gate execution time even when correct.

Usage: python3 check_no_body_read.py <path-to-route.ts>
Exit 0 = PASS, exit 1 = FAIL (reason printed).
"""
import re
import sys


def extract_delete_handler(source: str) -> str | None:
    match = re.search(r"export\s+async\s+function\s+DELETE\s*\([^)]*\)\s*\{", source)
    if not match:
        return None
    start = match.end() - 1  # position of the opening '{'
    depth = 0
    for i in range(start, len(source)):
        if source[i] == '{':
            depth += 1
        elif source[i] == '}':
            depth -= 1
            if depth == 0:
                return source[start:i + 1]
    return None


FORBIDDEN_PATTERNS = [
    r"\.json\(\s*\)",           # request.json()
    r"\.formData\(\s*\)",       # request.formData()
    r"\.text\(\s*\)",           # request.text() (a raw body read)
    r"searchParams",            # nextUrl.searchParams / URL query parsing
    r"req\.url",
    r"request\.url",
]


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: check_no_body_read.py <path-to-route.ts>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    with open(path, encoding="utf-8") as f:
        source = f.read()

    handler = extract_delete_handler(source)
    if handler is None:
        print(f"FAIL: could not find 'export async function DELETE(...)' in {path}")
        return 1

    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, handler):
            print(
                f"FAIL: DELETE handler in {path} matches forbidden client-input "
                f"pattern /{pattern}/ — the revoked uid must come only from the "
                "'session' cookie, never client-supplied input."
            )
            return 1

    print(f"PASS: DELETE handler in {path} reads no client-supplied body/query input")
    return 0


if __name__ == "__main__":
    sys.exit(main())
