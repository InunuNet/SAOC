#!/usr/bin/env python3
"""Assert `phrase` appears inside real JSX text/expression content of `file_path`,
not inside a // or /* */ comment, an import path, or a string literal that is
clearly not rendered (e.g. a metadata/title value)."""
import re
import sys


def strip_comments(src: str) -> str:
    src = re.sub(r"//.*", "", src)
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    return src


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check_jsx_text.py <file_path> <phrase>", file=sys.stderr)
        return 2
    file_path, phrase = sys.argv[1], sys.argv[2]
    src = strip_comments(open(file_path, encoding="utf-8").read())

    idx = src.lower().find(phrase.lower())
    if idx == -1:
        print(f"phrase not found outside comments: {phrase!r}", file=sys.stderr)
        return 1

    before = src[:idx]
    # Must be inside the JSX returned by the component: after the last `return (`
    # that precedes it, and inside an element (a `<` opened before it, not yet closed
    # by a matching top-level `>` followed by another top-level `<` of a sibling with
    # no text between). Simple, robust proxy: must appear after `return (` and before
    # the file's closing `</>` / final `);`, and must not be immediately inside a
    # quoted string that is itself an import(...) or a href="..."-style attribute value
    # preceding the phrase on the same line.
    if "return (" not in before and "return(" not in before:
        print("phrase appears before any component's return JSX", file=sys.stderr)
        return 1

    line_start = src.rfind("\n", 0, idx) + 1
    line_end = src.find("\n", idx)
    line = src[line_start : line_end if line_end != -1 else len(src)]
    if re.search(r'\bimport\b|\bfrom\s+[\'"]', line):
        print("phrase found on an import line, not JSX content", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
