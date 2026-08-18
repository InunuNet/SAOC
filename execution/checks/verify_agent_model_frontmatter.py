#!/usr/bin/env python3
"""
verify_agent_model_frontmatter.py — Assert a provider agent file's YAML
frontmatter parses to a specific `model` value.

Usage:
  verify_agent_model_frontmatter.py <file> <expected_model>

Parses the frontmatter with yaml.safe_load; never greps or substring-matches
file text. See goldens/frontmatter_checker_spec.md section A for the exact
failure-mode message contract this script implements.
"""
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("FAIL: pyyaml not importable", file=sys.stderr)
    sys.exit(1)


def extract_frontmatter_block(text: str, file_label: str) -> str:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        print(f"FAIL: no YAML frontmatter block in {file_label}", file=sys.stderr)
        sys.exit(1)
    end_idx = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        print(f"FAIL: unterminated frontmatter block in {file_label}", file=sys.stderr)
        sys.exit(1)
    return "\n".join(lines[1:end_idx])


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: verify_agent_model_frontmatter.py <file> <expected_model>", file=sys.stderr)
        return 1

    file_arg, expected_model = sys.argv[1], sys.argv[2]
    path = Path(file_arg)

    if not path.exists():
        print(f"FAIL: agent file not found: {file_arg}", file=sys.stderr)
        return 1

    text = path.read_text()
    block = extract_frontmatter_block(text, file_arg)

    try:
        data = yaml.safe_load(block)
    except yaml.YAMLError:
        print(f"FAIL: frontmatter is not valid YAML in {file_arg}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print(f"FAIL: frontmatter is not a mapping in {file_arg}", file=sys.stderr)
        return 1

    if "model" not in data:
        print(f"FAIL: no model: key in frontmatter of {file_arg}", file=sys.stderr)
        return 1

    actual = str(data["model"]).strip()
    if actual != expected_model:
        print(
            f"FAIL: model mismatch in {file_arg}: expected {expected_model}, got {actual}",
            file=sys.stderr,
        )
        return 1

    print(f"{file_arg}: model={actual} PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
