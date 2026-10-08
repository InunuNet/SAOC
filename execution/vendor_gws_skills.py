#!/usr/bin/env python3
"""vendor_gws_skills.py — turn `gws generate-skills` output into Athanor skills.

Google Workspace goes through the gws CLI (rule .agent/rules/_core/gws.md), so
every project ships a core set of gws skills. They are generated, never
hand-edited: refresh them with

    gws generate-skills            # writes ./skills/<name>/SKILL.md
    python3 execution/vendor_gws_skills.py --from skills --to .agent/skills
    python3 execution/vendor_gws_skills.py --from skills --to template/.agent/skills

(run generate-skills inside .tmp/sandbox/, not the project root).

Per skill: the upstream frontmatter is reduced to name + description + the gws
version it was generated from; `../X/SKILL.md` links become `X.md` when X is
vendored too, and plain text when it is not (its help is `gws <svc> <cmd>
--help`). gws-shared gets the Athanor notes appended. A file that would still
carry an upstream SKILL.md path is refused, not written.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SKILLS = (
    "gws-shared", "gws-sheets", "gws-sheets-read", "gws-sheets-append",
    "gws-drive", "gws-docs", "gws-gmail", "gws-calendar",
)

ATHANOR_NOTES = """
## Athanor notes

- Google Workspace work goes through `gws`, never the claude.ai Google MCP
  connectors (rule `.agent/rules/_core/gws.md`).
- Clearing a data validation: send `setDataValidation` with `range` only.
  `"rule": null` fails gws's local schema validation, and the whole
  batchUpdate is rejected.
- Ranges containing `!` must be double-quoted in zsh. From Python, pass argv
  as a list (`subprocess.run(["gws", "sheets", ...])`), never a shell string.
- These skills are generated: refresh with `gws generate-skills` +
  `execution/vendor_gws_skills.py`. Do not edit them by hand.
"""

LINK_RE = re.compile(r"\[([^\]]+)\]\(\.\./(gws-[a-z0-9-]+)/SKILL\.md\)")
PATH_RE = re.compile(r"\.\./(gws-[a-z0-9-]+)/SKILL\.md")


def split_frontmatter(text: str, src: Path) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        raise ValueError(f"{src}: no frontmatter")
    end = text.index("\n---\n", 4)
    head, body = text[4:end], text[end + 5:]
    fields = {}
    for key in ("name", "description"):
        m = re.search(rf"^{key}:\s*(.+)$", head, re.M)
        if not m:
            raise ValueError(f"{src}: frontmatter has no {key}")
        fields[key] = m.group(1).strip()
    m = re.search(r"^\s+version:\s*(\S+)$", head, re.M)
    fields["gws_version"] = m.group(1) if m else "unknown"
    return fields, body


def convert(name: str, text: str, src: Path, shipped: set[str]) -> str:
    fields, body = split_frontmatter(text, src)
    if fields["name"] != name:
        raise ValueError(f"{src}: frontmatter name {fields['name']!r} != {name!r}")

    def link(m):
        label, target = m.group(1), m.group(2)
        return f"[{label}]({target}.md)" if target in shipped else label

    body = LINK_RE.sub(link, body)
    body = PATH_RE.sub(lambda m: f"{m.group(1)}.md", body)
    if "SKILL.md" in body:
        raise ValueError(f"{src}: an upstream SKILL.md path survived conversion")
    if name == "gws-shared":
        body = body.rstrip("\n") + "\n" + ATHANOR_NOTES
    return (f"---\nname: {fields['name']}\ndescription: {fields['description']}\n"
            f"gws_version: {fields['gws_version']}\n---\n{body}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--from", dest="src", required=True,
                    help="the skills/ directory `gws generate-skills` wrote")
    ap.add_argument("--to", dest="dst", required=True,
                    help="destination skills directory (e.g. .agent/skills)")
    args = ap.parse_args(argv)
    src, dst = Path(args.src), Path(args.dst)
    shipped = set(SKILLS)
    out = {}
    for name in SKILLS:
        path = src / name / "SKILL.md"
        try:
            out[name] = convert(name, path.read_text(encoding="utf-8"), path, shipped)
        except (OSError, ValueError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
    dst.mkdir(parents=True, exist_ok=True)
    for name, text in out.items():
        (dst / f"{name}.md").write_text(text, encoding="utf-8")
        print(f"vendored {name}.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
