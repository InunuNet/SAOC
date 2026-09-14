#!/usr/bin/env python3
"""
verify_no_literal_model_in_canonical.py — Sweep every canonical agent file and
assert none carries a literal `model:` key in its frontmatter. sync_agents.sh
reads `model_tier` only; a literal `model:` in canonical would be a silent
second source of truth that sync ignores.

Usage:
  verify_no_literal_model_in_canonical.py [--root <dir>]

Counts files by parsing the glob result, never by grep, and asserts the
parsed count equals the number of files found on disk.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable", file=sys.stderr)
    sys.exit(1)


def extract_frontmatter_block(text: str, file_label: str):
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        print(f"FAIL: no YAML frontmatter block in {file_label}", file=sys.stderr)
        return None
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        print(f"FAIL: unterminated frontmatter block in {file_label}", file=sys.stderr)
        return None
    return "\n".join(lines[1:end_idx])


def main() -> int:
    root = ".agent/agents"
    args = sys.argv[1:]
    if args:
        if len(args) == 2 and args[0] == "--root":
            root = args[1]
        else:
            print("usage: verify_no_literal_model_in_canonical.py [--root <dir>]", file=sys.stderr)
            return 1

    agents_dir = Path(root)
    files = sorted(agents_dir.glob("*.md"))
    files_on_disk = len(files)

    parsed_count = 0
    offenders = []

    for path in files:
        text = path.read_text()
        block = extract_frontmatter_block(text, str(path))
        if block is None:
            offenders.append(str(path))
            continue
        try:
            data = yaml.safe_load(block)
        except yaml.YAMLError:
            print(f"FAIL: frontmatter is not valid YAML in {path}", file=sys.stderr)
            offenders.append(str(path))
            continue
        if not isinstance(data, dict):
            print(f"FAIL: frontmatter is not a mapping in {path}", file=sys.stderr)
            offenders.append(str(path))
            continue
        parsed_count += 1
        if "model" in data:
            offenders.append(str(path))

    print(f"parsed {parsed_count} of {files_on_disk} canonical agent files")
    if files_on_disk == 0:
        print(f"FAIL: no canonical agent files found under {agents_dir}", file=sys.stderr)
        return 1
    if parsed_count != files_on_disk:
        print(
            f"FAIL: parsed count {parsed_count} does not equal files on disk {files_on_disk}",
            file=sys.stderr,
        )
        return 1

    if offenders:
        for o in offenders:
            print(f"FAIL: literal model: key found in canonical frontmatter of {o}", file=sys.stderr)
        return 1

    print("PASS: no literal model: key in any canonical agent frontmatter")
    return 0


if __name__ == "__main__":
    sys.exit(main())
