#!/usr/bin/env python3
"""F1 (mission drive-docx-version-export) -- structural read-only guarantee
for execution/drive_docx_sync.py, mirroring execution/gws_inbox_check.sh's
own structural guard (see its module docstring): the tool must be
INCAPABLE of writing to Lee-Ann's Drive, not merely instructed to avoid it.

RED today (script does not exist) -- expected; goes GREEN once @dev implements
per goldens/README.md's spec:
  - the script's own source may reference gws `drive files list` and
    `drive files get` and nothing else Drive-write-shaped
  - no gws write-verb token for any Drive mutation appears anywhere in the file
  - no eval/exec/dynamic-subprocess-argv-from-string-formatting pattern that
    could let a corrupted/malicious Drive response or world fixture choose
    which gws subcommand runs at runtime

A wrong implementation that merely avoids write calls IN PRACTICE today, but
leaves e.g. a `gws drive files update` call reachable behind an untested
branch (a "clean up duplicates" feature, a future "mark as processed"
Drive-side flag) would fail this check the moment that code is added --
this is deliberately broader than "have I seen it call something bad", it's
"is calling something bad possible at all from this source".

Hardened (post-QA gap #6, see .agent/memory/project/specs/
drive-docx-version-export/goldens/README.md): the plain literal-token grep
below only ever caught a write verb spelled out as a literal string. A verb
assembled via str.format(), old-style %% formatting, string concatenation,
or read out of a variable/environment/config would never appear as a
matching literal substring and would sail through untouched. The functions
below resolve each subprocess.run/call/Popen(...) call's actual argv
expression (an inline list literal, or the nearest preceding assignment to
the identifier passed in) and inspect THAT expression -- not the whole
file -- for those construction techniques, and separately require every
argv element before the first flag-shaped literal (i.e. every element in
"verb position": `gws`, `drive`, `files`, `list`/`get`) to itself be a
plain string literal, not an identifier, so the subcommand cannot be
chosen by a variable at all. This closes a latent hole in the guard's own
coverage -- the current script is clean, so this hardening does not report
a live defect in drive_docx_sync.py today; it's here so a later change that
introduces one of these patterns is caught immediately instead of quietly
passing this check forever.
"""
import re
import sys

PRODUCT_SCRIPT = "execution/drive_docx_sync.py"

FORBIDDEN_WRITE_VERBS = [
    "files create", "files update", "files delete", "files copy",
    "files emptyTrash", "files generateIds", "files watch",
    "permissions create", "permissions update", "permissions delete",
    "revisions delete", "revisions update",
    "comments create", "comments update", "comments delete",
    "replies create", "replies update", "replies delete",
]

ALLOWED_SUBCOMMANDS = {"drive files list", "drive files get"}

SUBPROCESS_CALL_RE = re.compile(r"subprocess\.(run|call|Popen)\(")
STRING_LITERAL_RE = re.compile(r'^[frbuFRBU]*("""(?:.|\n)*"""|\'\'\'(?:.|\n)*\'\'\'|"[^"]*"|\'[^\']*\')$')


def _extract_balanced(source, start_idx, open_char, close_char):
    """Returns (inner_text_without_outer_brackets, index_just_past_close)."""
    depth = 1
    i = start_idx
    while i < len(source) and depth > 0:
        if source[i] == open_char:
            depth += 1
        elif source[i] == close_char:
            depth -= 1
        i += 1
    return source[start_idx:i - 1], i


def _first_top_level_arg(call_args_text):
    depth = 0
    in_str = None
    i = 0
    while i < len(call_args_text):
        c = call_args_text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in "\"'":
            in_str = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            return call_args_text[:i].strip()
        i += 1
    return call_args_text.strip()


def _split_top_level(list_inner_text):
    """Split a comma-separated expression list at top level (respecting
    nested brackets and quoted strings) -- used to inspect each argv list
    element individually."""
    parts = []
    depth = 0
    current = []
    in_str = None
    i = 0
    while i < len(list_inner_text):
        c = list_inner_text[i]
        if in_str:
            current.append(c)
            if c == "\\" and i + 1 < len(list_inner_text):
                current.append(list_inner_text[i + 1])
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in "\"'":
            in_str = c
            current.append(c)
        elif c in "([{":
            depth += 1
            current.append(c)
        elif c in ")]}":
            depth -= 1
            current.append(c)
        elif c == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
            i += 1
            continue
        else:
            current.append(c)
        i += 1
    if current:
        parts.append("".join(current).strip())
    return [p for p in parts if p]


def _is_string_literal(token):
    return bool(STRING_LITERAL_RE.match(token.strip()))


def _looks_like_flag_literal(token):
    if not _is_string_literal(token):
        return False
    inner = token.strip().strip("frbuFRBU").strip("\"'")
    return inner.startswith("-")


def _resolve_argv_expression(source, call_start, first_arg):
    """Given the first positional argument text passed to a subprocess.*
    call, return the text of the actual argv-building expression: the
    inline list literal itself, or -- if it's a bare identifier -- the
    right-hand side of that identifier's most recent prior assignment."""
    if first_arg.startswith("["):
        return first_arg, "inline argv list"

    ident_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)$", first_arg)
    if not ident_match:
        return None, first_arg

    name = ident_match.group(1)
    before = source[:call_start]
    assign_matches = list(re.finditer(rf"\b{re.escape(name)}\s*=(?!=)\s*", before))
    if not assign_matches:
        return None, f"identifier {name!r} (no prior assignment found)"

    rhs_start = assign_matches[-1].end()
    if rhs_start < len(source) and source[rhs_start] == "[":
        inner, end_idx = _extract_balanced(source, rhs_start + 1, "[", "]")
        return "[" + inner + "]", f"argv assembled into {name!r}"

    newline_idx = source.find("\n", rhs_start)
    rhs_text = source[rhs_start:newline_idx if newline_idx != -1 else len(source)]
    return rhs_text, f"argv assembled into {name!r} (non-list expression)"


def check_argv_construction(source):
    """For every subprocess.run/call/Popen(...) call, resolve its argv
    expression and check it for command construction via str.format(),
    old-style %% formatting, string concatenation, or a value pulled from
    os.environ/config -- any of which would let the actual gws verb be
    assembled or chosen dynamically instead of appearing as a fixed
    literal token, defeating the plain verb-token grep in main(). Also
    requires every element before the first flag-shaped literal (e.g.
    "--params", "-o") to itself be a string literal, so the gws
    subcommand path (drive/files/list/get) can never be read out of a
    variable at all."""
    findings = []
    for m in SUBPROCESS_CALL_RE.finditer(source):
        call_args_text, _end = _extract_balanced(source, m.end(), "(", ")")
        first_arg = _first_top_level_arg(call_args_text)

        if first_arg.startswith(("f\"", "f'", "F\"", "F'")):
            findings.append(
                f"subprocess call's argv is an f-string literal ({first_arg[:80]!r}) -- the gws "
                "subcommand must never be built by interpolating a value into the argv itself"
            )
            continue

        argv_expr, desc = _resolve_argv_expression(source, m.start(), first_arg)
        if argv_expr is None:
            findings.append(
                f"subprocess call's argv could not be statically resolved to a literal list or a "
                f"traceable prior assignment ({desc}) -- cannot confirm the gws subcommand is fixed"
            )
            continue

        if re.search(r"\.format\(", argv_expr):
            findings.append(f"{desc} uses .format() to build the gws argv: {argv_expr[:160]!r}")
        if re.search(r'["\']\s*%\s*[\(\["\']', argv_expr) or re.search(r"%\([a-zA-Z_]+\)s", argv_expr):
            findings.append(f"{desc} uses old-style %% string formatting to build the gws argv: {argv_expr[:160]!r}")
        if re.search(r"os\.environ|getenv\(|config\[|config\.get\(", argv_expr):
            findings.append(f"{desc} pulls a value from environment/config into the gws argv rather than a fixed literal: {argv_expr[:160]!r}")

        if argv_expr.strip().startswith("["):
            inner = argv_expr.strip()
            inner = inner[1:-1] if inner.endswith("]") else inner[1:]
            elements = _split_top_level(inner)
            if re.search(r"[\"'][^\"']*[\"']\s*\+|\+\s*[\"'][^\"']*[\"']", inner):
                findings.append(
                    f"{desc} concatenates strings inside the argv list itself: {argv_expr[:160]!r} -- "
                    "a subcommand token built from '+' concatenation would not match the literal-verb "
                    "grep above"
                )
            reached_flag = False
            for el in elements:
                if _looks_like_flag_literal(el):
                    reached_flag = True
                    continue
                if reached_flag:
                    continue  # values after a flag (fileId, params json, output path) may be variables
                if not _is_string_literal(el):
                    findings.append(
                        f"{desc} has a non-literal token {el!r} in gws subcommand position (before any "
                        "'-'-prefixed flag) -- the gws verb/subcommand path must be a fixed string "
                        "literal, never read from a variable, config, or expression, or it could be "
                        "made to resolve to a write verb at runtime"
                    )

    return findings


def main():
    try:
        with open(PRODUCT_SCRIPT) as f:
            source = f.read()
    except FileNotFoundError:
        print(f"RED (expected pre-implementation): {PRODUCT_SCRIPT} does not exist yet.")
        sys.exit(1)

    failures = []

    for verb in FORBIDDEN_WRITE_VERBS:
        if verb in source:
            failures.append(f"forbidden Drive write-verb token found in source: {verb!r}")

    if re.search(r"\beval\s*\(", source):
        failures.append("source contains eval(...) -- structural read-only guarantee requires no dynamic code execution")

    failures.extend(check_argv_construction(source))

    if failures:
        print("FAIL")
        for f in failures:
            print(f"FAIL: {f}")
        sys.exit(1)

    print(f"PASS: {PRODUCT_SCRIPT} is structurally read-only (only {sorted(ALLOWED_SUBCOMMANDS)} referenced, no eval, no dynamically-assembled gws argv)")
    sys.exit(0)


if __name__ == "__main__":
    main()
