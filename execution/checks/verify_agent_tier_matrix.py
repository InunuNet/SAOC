#!/usr/bin/env python3
"""
verify_agent_tier_matrix.py — Assert the tier declared in canonical actually
reached both provider files, for a named set of agents or for the recorded
untouched-baseline set.

Usage:
  verify_agent_tier_matrix.py <tier_matrix.yaml> --agents a,b,...
  verify_agent_tier_matrix.py <tier_matrix.yaml> --untouched-baseline
  [--root <dir>]

--agents and --untouched-baseline are mutually exclusive.

Every check parses YAML frontmatter (yaml.safe_load); never greps or
substring-matches file text. Canonical declaring a tier is never accepted as
evidence that the value reached the provider files — the provider files are
parsed and compared independently.
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


def parse_frontmatter(path: Path):
    """Returns (dict, None) on success, (None, error_already_printed) on failure."""
    if not path.exists():
        print(f"FAIL: agent file not found: {path}", file=sys.stderr)
        return None, True
    text = path.read_text()
    block = extract_frontmatter_block(text, str(path))
    if block is None:
        return None, True
    try:
        data = yaml.safe_load(block)
    except yaml.YAMLError:
        print(f"FAIL: frontmatter is not valid YAML in {path}", file=sys.stderr)
        return None, True
    if not isinstance(data, dict):
        print(f"FAIL: frontmatter is not a mapping in {path}", file=sys.stderr)
        return None, True
    return data, False


def check_agent(root: Path, name: str, expected: dict) -> list:
    """Checks one agent against its golden entry. Returns a list of failure strings."""
    failures = []

    canonical_path = root / ".agent" / "agents" / f"{name}.md"
    canonical, err = parse_frontmatter(canonical_path)
    if err:
        failures.append(f"{name}: could not parse canonical frontmatter at {canonical_path}")
        return failures

    expected_tier = expected.get("model_tier")
    actual_tier = canonical.get("model_tier")
    if actual_tier != expected_tier:
        failures.append(
            f"{name}: canonical model_tier mismatch: expected {expected_tier}, got {actual_tier}"
        )

    if "model" in canonical:
        failures.append(f"{name}: canonical frontmatter contains a literal model: key")

    claude_path = root / ".claude" / "agents" / f"{name}.md"
    claude_fm, err = parse_frontmatter(claude_path)
    if err:
        failures.append(f"{name}: could not parse .claude frontmatter at {claude_path}")
    else:
        expected_claude = expected.get("claude")
        actual_claude = claude_fm.get("model")
        if actual_claude != expected_claude:
            failures.append(
                f"{name}: .claude model mismatch: expected {expected_claude}, got {actual_claude}"
            )
        if claude_fm.get("name") != name:
            failures.append(
                f"{name}: .claude frontmatter name: {claude_fm.get('name')!r} does not equal {name!r}"
            )

    gemini_path = root / ".gemini" / "agents" / f"{name}.md"
    gemini_fm, err = parse_frontmatter(gemini_path)
    if err:
        failures.append(f"{name}: could not parse .gemini frontmatter at {gemini_path}")
    else:
        expected_gemini = expected.get("gemini")
        actual_gemini = gemini_fm.get("model")
        if actual_gemini != expected_gemini:
            failures.append(
                f"{name}: .gemini model mismatch: expected {expected_gemini}, got {actual_gemini}"
            )
        if gemini_fm.get("name") != name:
            failures.append(
                f"{name}: .gemini frontmatter name: {gemini_fm.get('name')!r} does not equal {name!r}"
            )

    return failures


def check_untouched(root: Path, name: str, baseline: dict) -> list:
    """Asserts canonical model_tier and both provider model values are unchanged."""
    failures = []

    canonical_path = root / ".agent" / "agents" / f"{name}.md"
    canonical, err = parse_frontmatter(canonical_path)
    if err:
        failures.append(f"{name}: could not parse canonical frontmatter at {canonical_path}")
        return failures

    expected_tier = baseline.get("model_tier")
    actual_tier = canonical.get("model_tier")
    if actual_tier != expected_tier:
        failures.append(
            f"{name}: untouched baseline drift: canonical model_tier expected {expected_tier}, got {actual_tier}"
        )

    claude_path = root / ".claude" / "agents" / f"{name}.md"
    claude_fm, err = parse_frontmatter(claude_path)
    if err:
        failures.append(f"{name}: could not parse .claude frontmatter at {claude_path}")
    else:
        expected_claude = baseline.get("claude")
        actual_claude = claude_fm.get("model")
        if actual_claude != expected_claude:
            failures.append(
                f"{name}: untouched baseline drift: .claude model expected {expected_claude}, got {actual_claude}"
            )

    gemini_path = root / ".gemini" / "agents" / f"{name}.md"
    gemini_fm, err = parse_frontmatter(gemini_path)
    if err:
        failures.append(f"{name}: could not parse .gemini frontmatter at {gemini_path}")
    else:
        expected_gemini = baseline.get("gemini")
        actual_gemini = gemini_fm.get("model")
        if actual_gemini != expected_gemini:
            failures.append(
                f"{name}: untouched baseline drift: .gemini model expected {expected_gemini}, got {actual_gemini}"
            )

    return failures


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print("usage: verify_agent_tier_matrix.py <tier_matrix.yaml> [--agents a,b,...] [--untouched-baseline] [--root <dir>]", file=sys.stderr)
        return 1

    golden_path = Path(args[0])
    rest = args[1:]

    agents_csv = None
    untouched = False
    root = Path(".")

    i = 0
    while i < len(rest):
        tok = rest[i]
        if tok == "--agents":
            agents_csv = rest[i + 1]
            i += 2
        elif tok == "--untouched-baseline":
            untouched = True
            i += 1
        elif tok == "--root":
            root = Path(rest[i + 1])
            i += 2
        else:
            print(f"FAIL: unrecognized argument: {tok}", file=sys.stderr)
            return 1

    if agents_csv is not None and untouched:
        print("FAIL: --agents and --untouched-baseline are mutually exclusive", file=sys.stderr)
        return 1
    if agents_csv is None and not untouched:
        print("FAIL: one of --agents or --untouched-baseline is required", file=sys.stderr)
        return 1

    if not golden_path.exists():
        print(f"FAIL: golden file not found: {golden_path}", file=sys.stderr)
        return 1

    try:
        golden = yaml.safe_load(golden_path.read_text())
    except yaml.YAMLError:
        print(f"FAIL: golden file is not valid YAML: {golden_path}", file=sys.stderr)
        return 1

    if not isinstance(golden, dict):
        print(f"FAIL: golden is not a mapping: {golden_path}", file=sys.stderr)
        return 1

    all_failures = []

    if untouched:
        baseline_map = golden.get("untouched") or {}
        if not baseline_map:
            print("FAIL: golden contains no untouched: baseline entries", file=sys.stderr)
            return 1
        for name, baseline in baseline_map.items():
            print(f"checking (untouched) {name}")
            all_failures.extend(check_untouched(root, name, baseline))
    else:
        agents_map = golden.get("agents", {})
        names = [n.strip() for n in agents_csv.split(",") if n.strip()]
        for name in names:
            if name not in agents_map:
                all_failures.append(f"{name}: not present in golden agents: map")
                continue
            print(f"checking {name}")
            all_failures.extend(check_agent(root, name, agents_map[name]))

    if all_failures:
        for f in all_failures:
            print(f"FAIL: {f}", file=sys.stderr)
        return 1

    print("PASS: tier matrix matches golden")
    return 0


if __name__ == "__main__":
    sys.exit(main())
