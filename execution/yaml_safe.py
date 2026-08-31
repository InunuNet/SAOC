#!/usr/bin/env python3
"""YAML-safe prose helper.

Run free-form prose through ``safe_scalar()`` before splicing it into a YAML
``key: <value>`` field (contract.yaml ``command:``/``description:``, mission
frontmatter, etc). Detects constructs that break YAML's plain-scalar syntax
(colon+whitespace, whitespace+hash, and anything else that would parse back
to something other than the original text) and, only when needed, rewrites
the text as an indented block literal that round-trips exactly through
``yaml.safe_load()``.
"""
import re
import sys

import yaml

BLOCK_INDENT = 2
DIAGNOSE_WINDOW_BACKWARD = 40
DIAGNOSE_WINDOW_FORWARD = 5

_BLOCK_HEADER_RE = re.compile(r"^(\s*)(?:-\s*)?[A-Za-z0-9_.\-]+:\s*[|>][+-]?\d*\s*$")
_KEY_VALUE_RE = re.compile(r"^(\s*(?:-\s*)?)([A-Za-z0-9_.\-]+):(\s(.*)|)$")
_COLON_SPACE_RE = re.compile(r":(\s|$)")
_SPACE_HASH_RE = re.compile(r"(?<=\s)#")


def safe_scalar(text: str) -> str:
    """Return a YAML-plain-scalar-safe form of text.

    If text already round-trips as a plain scalar when spliced as
    ``key: <text>``, it is returned unchanged. Otherwise it is rewritten as
    a block-literal (``|``-style) scalar, re-indented so that splicing it as
    ``key: <output>`` reproduces the exact original text via
    ``yaml.safe_load()``.
    """
    if text == "":
        return '""'

    probe_doc = f"key: {text}\n"
    try:
        loaded = yaml.safe_load(probe_doc)
        if isinstance(loaded, dict) and set(loaded) == {"key"} and loaded["key"] == text:
            return text
    except yaml.YAMLError:
        pass

    return _block_literal(text)


def _block_literal(text: str, indent: int = BLOCK_INDENT) -> str:
    pad = " " * indent

    if text.endswith("\n"):
        core = text.rstrip("\n")
        trailing_newlines = len(text) - len(core)
        # Clip chomping needs at least one content line to hang the newline on;
        # with an empty core it would parse back as "" instead of blank lines.
        chomp = "" if trailing_newlines == 1 and core != "" else "+"
        lines = core.split("\n")
    else:
        chomp = "-"
        lines = text.split("\n")

    header = f"|{indent}{chomp}"
    body_lines = [pad + line if line else "" for line in lines]

    if chomp == "+" and text.endswith("\n"):
        extra_blank_lines = trailing_newlines - 1
        body_lines.extend([""] * extra_blank_lines)

    return "\n".join([header, *body_lines])


def _excluded_block_literal_lines(lines: list[str]) -> set[int]:
    """Line indices that fall inside a block-literal (`|`/`>`) body.

    Authors escape into block literals precisely to avoid the colon-space /
    space-hash plain-scalar trap, so those bodies must never be scanned.
    """
    excluded: set[int] = set()
    i = 0
    while i < len(lines):
        header = _BLOCK_HEADER_RE.match(lines[i])
        if not header:
            i += 1
            continue
        header_indent = len(header.group(1))
        j = i + 1
        while j < len(lines):
            line = lines[j]
            if line.strip() == "":
                excluded.add(j)
                j += 1
                continue
            indent = len(line) - len(line.lstrip(" "))
            if indent > header_indent:
                excluded.add(j)
                j += 1
            else:
                break
        i = j
    return excluded


def diagnose_scalar_break(source: str, err: yaml.YAMLError) -> str | None:
    """Best-effort hint for the colon-space / space-hash plain-scalar failure shape.

    ``source`` is the exact raw text handed to ``yaml.safe_load()``. Searches a
    window around ``err``'s mark (biased backward, since the real break site is
    consistently before PyYAML's reported line for this failure class) for a
    ``key: value`` line whose unquoted value contains an unescaped colon-space
    or space-hash sequence -- the two constructs that break YAML plain scalars.
    Returns ``None`` when nothing recognizable is found. Never raises: a bug
    here must never mask or replace the original PyYAML error.
    """
    try:
        lines = source.split("\n")
        mark = getattr(err, "problem_mark", None) or getattr(err, "context_mark", None)
        center = mark.line if mark is not None else 0

        lo = max(0, center - DIAGNOSE_WINDOW_BACKWARD)
        hi = min(len(lines), center + DIAGNOSE_WINDOW_FORWARD)

        excluded = _excluded_block_literal_lines(lines)

        for idx in range(lo, hi):
            if idx in excluded:
                continue
            line = lines[idx]
            stripped = line.strip()
            if stripped == "" or stripped.startswith("#"):
                continue

            kv = _KEY_VALUE_RE.match(line)
            if not kv:
                continue
            value = kv.group(4) or ""
            if value.strip()[:1] in ('"', "'"):
                continue

            candidates = []
            colon_match = _COLON_SPACE_RE.search(value)
            if colon_match:
                candidates.append(("colon-space", colon_match.start()))
            hash_match = _SPACE_HASH_RE.search(value)
            if hash_match:
                candidates.append(("space-hash", hash_match.start()))
            if not candidates:
                continue

            candidates.sort(key=lambda c: c[1])
            signature = candidates[0][0]
            return (
                f"line {idx + 1}: unquoted plain scalar contains a {signature} "
                "sequence, which YAML reads as ending the value early -- quote "
                "the value or rewrite it as a block literal (|-)"
            )

        return None
    except Exception:
        return None


def main() -> int:
    text = sys.stdin.read()
    if text.endswith("\n"):
        text = text[:-1]
    sys.stdout.write(safe_scalar(text))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
