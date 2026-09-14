#!/usr/bin/env python3
"""F4 cross-depth link check: a skill file shipped to MORE THAN ONE install depth
cannot carry `../`-relative path arithmetic and remain correct at every depth it
ships to. Currently two depths exist: .agent/skills/ (2 levels deep from repo
root) and template/.agent/skills/ (3 levels deep). No single `../` count is
valid at both simultaneously — a link like `../../docs/foo.md` resolves
correctly from one depth and is broken from the other. Because of that, ANY
`../`-relative link found anywhere in the body of a file that ships to more
than one depth is unsafe by construction: there is no need to compute where a
given `../../foo` actually resolves at each depth to know it is wrong
somewhere, so this check does not attempt that arithmetic at all.

Multi-depth file set is discovered MECHANICALLY, never hand-listed: it is the
filename INTERSECTION of .agent/skills/*.md and template/.agent/skills/*.md.
A hand-listed set is exactly the failure mode this check exists to close (see
this mission's SPEC.md, F4) — a file added to both trees six months from now,
naming a file that doesn't exist today, is caught automatically because it
becomes a member of the intersection, not because someone remembered to add
its name to a list inside this script. Both copies of every shared filename
are scanned (the canonical .agent/skills/ copy AND the template/.agent/skills/
copy) — a violation in either copy is reported, independent of whether the
two copies currently happen to be byte-identical (that is F2's concern, not
this check's; a `../` link is unsafe on arrival even before F2 has had a
chance to propagate it into the other copy).

Four link forms are all detected by ONE general pattern -- `\\.\\./` followed by
a run of non-whitespace, non-`)"'<>` characters -- rather than four separate
regexes, because all four forms share the identical defect shape (a
`../`-prefixed path substring embedded in different surrounding syntax):
  1. markdown inline links        [text](../path)
  2. reference-style definitions  [label]: ../path
  3. HTML href attributes         <a href="../path">
  4. bare relative paths in prose e.g. "see ../../docs/foo.md for details"
The surrounding-context sniff in classify_form() below only affects the
wording used to describe a match in the failure message (which form was it);
it never affects whether a match fires -- the single RELATIVE_LINK_RE pattern
is what decides that, uniformly across all four forms.

Fenced code blocks (``` ... ```) are EXEMPT from ALL FOUR forms, not merely
the bare-prose form. A `../` written inside a fenced example is illustrative
documentation of what a link/href looks like -- a reader or renderer will
never resolve it as a live reference -- and that is just as true when the
fenced content happens to be shaped like a markdown link or an href as when
it is shaped like plain prose. So fenced regions are blanked out (line count
preserved, so line numbers reported for real matches outside the fence stay
accurate) before ANY of the four forms is scanned for, uniformly.

What is legal and never flagged: same-directory sibling links
([alembic](alembic.md) -- no `../`, depth-invariant, correct at any depth),
root-relative or absolute references (also no `../` substring), and
skill-relative `./` links (also depth-invariant). None of these contain the
`../` substring the pattern below looks for, so they are never candidates.

This check has NO legitimate SKIP condition. Unlike F3 (verify_skill_drift.py),
which depends on an external Alembic daemon that genuinely may not be running,
both .agent/skills/ and template/.agent/skills/ are checked into this
repository -- their absence is a real defect, not an environmental unknown --
so a missing directory degrades to FAIL ("cannot verify"), matching F2's
convention for the same class of missing-directory case, never to SKIP. Exit
code 77 is reserved by house convention (execution/contract.py's gate/check
machinery recognizes it natively as the autotools skip signal) but is never
returned by this script -- there is nothing this check can be legitimately
unsure about the way F3 can be unsure whether the proxy is merely offline.

Known limits of the regex approach, stated rather than papered over: this is
not a markdown parser. Four-space-indented code blocks (not triple-backtick
fenced) are NOT exempted -- only ``` ... ``` fencing is, matching the spec's
explicit carve-out -- so a `../` inside an indented code example still fires.
Single-backtick inline code spans are also NOT exempted, only full fenced
blocks are. The check does not resolve or validate where a multi-segment
`../../..` path actually lands at either depth; it does not need to, since
per the opening paragraph any occurrence in a multi-depth file is unsafe by
construction regardless of where it resolves.

Exit 0, silent: no cross-depth-unsafe relative link found in any multi-depth
skill file.
Exit non-zero, naming every offending file + line + link + form: at least one
cross-depth-unsafe relative link found.
Exit non-zero, "cannot verify": .agent/skills/ or template/.agent/skills/ is
missing, or no filename ships to both (safe default is to block, never
silently pass).
"""
import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_SKILLS_DIR = ".agent/skills"
TEMPLATE_SKILLS_DIR = "template/.agent/skills"

# Any ../-prefixed path substring: the literal ../ followed by a run of
# characters that stop at whitespace or at a delimiter that would close off
# a markdown link, an HTML attribute, or a reference-definition target.
RELATIVE_LINK_RE = re.compile(r"\.\./[^\s)\"'<>]*")


def blank_fenced_blocks(text: str) -> str:
    """Replace the CONTENTS (and the ``` delimiter lines themselves) of every
    fenced code block with blank lines, preserving total line count so line
    numbers reported for real matches outside the fence stay accurate."""
    lines = text.splitlines(keepends=True)
    out = []
    in_fence = False
    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
            out.append("\n" if line.endswith("\n") else "")
            continue
        out.append("\n" if (in_fence and line.endswith("\n")) else ("" if in_fence else line))
    return "".join(out)


def classify_form(line: str, match_start: int) -> str:
    """Best-effort classification of which of the four forms a match belongs
    to, for the failure message only -- never affects whether a match fires."""
    prefix = line[:match_start]
    if prefix.rstrip().endswith("]("):
        return "markdown inline link"
    if re.match(r"^\s*\[[^\]]+\]:\s*$", prefix):
        return "reference-style link definition"
    if re.search(r"href\s*=\s*[\"']$", prefix):
        return "HTML href attribute"
    return "bare relative path in prose"


def find_violations(text: str):
    """Return [(line_no, form, snippet), ...] for every cross-depth-unsafe
    ../ occurrence outside fenced code blocks."""
    scanned = blank_fenced_blocks(text)
    violations = []
    for line_no, line in enumerate(scanned.splitlines(), start=1):
        for m in RELATIVE_LINK_RE.finditer(line):
            violations.append((line_no, classify_form(line, m.start()), m.group(0)))
    return violations


def discover_multi_depth_files(root: Path):
    """Multi-depth file set = filename intersection of .agent/skills/*.md and
    template/.agent/skills/*.md, discovered mechanically. Returns None if
    either directory is missing (cannot verify); returns [] if both exist but
    share no filename."""
    canonical_dir = root / CANONICAL_SKILLS_DIR
    template_dir = root / TEMPLATE_SKILLS_DIR
    if not canonical_dir.is_dir() or not template_dir.is_dir():
        return None

    canonical_names = {p.name for p in canonical_dir.glob("*.md") if p.is_file()}
    template_names = {p.name for p in template_dir.glob("*.md") if p.is_file()}
    shared = sorted(canonical_names & template_names)

    pairs = []
    for name in shared:
        pairs.append(canonical_dir / name)
        pairs.append(template_dir / name)
    return pairs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=str(REPO_ROOT),
        help="Project root to check (default: this repo's root, self-anchored via __file__)",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()

    multi_depth_files = discover_multi_depth_files(root)
    if multi_depth_files is None:
        print(
            f"cannot verify: {root / CANONICAL_SKILLS_DIR} or "
            f"{root / TEMPLATE_SKILLS_DIR} is missing",
            file=sys.stderr,
        )
        return 1
    if not multi_depth_files:
        print(
            "cannot verify: no skill filename ships to both "
            f"{CANONICAL_SKILLS_DIR}/ and {TEMPLATE_SKILLS_DIR}/",
            file=sys.stderr,
        )
        return 1

    failures = []
    for path in multi_depth_files:
        try:
            text = path.read_text(errors="replace")
        except OSError as exc:
            failures.append(f"cannot read {path}: {exc}")
            continue
        for line_no, form, snippet in find_violations(text):
            failures.append(
                f"{path}:{line_no}: cross-depth-unsafe relative link "
                f"({form}) {snippet!r} -- this filename ships to both "
                f"{CANONICAL_SKILLS_DIR}/ (2 levels deep) and "
                f"{TEMPLATE_SKILLS_DIR}/ (3 levels deep); no ../ count is "
                f"correct at both depths, so this link is broken at one of "
                f"them regardless of which one it was written for"
            )

    if failures:
        print("cross-depth link check FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print(
        "cross-depth link check PASSED: no skill file shipped to multiple "
        "install depths contains a ../-relative link outside a fenced code "
        "block."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
