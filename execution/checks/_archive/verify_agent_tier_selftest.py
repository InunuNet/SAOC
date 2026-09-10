#!/usr/bin/env python3
"""
verify_agent_tier_selftest.py — Mutation proof for verify_agent_model_frontmatter.py
(spec A), verify_agent_tier_matrix.py (spec B), and verify_no_literal_model_in_canonical.py
(spec C).

For every failure mode named in goldens/frontmatter_checker_spec.md, builds a temp
fixture reproducing exactly that fault, runs the checker as a subprocess, and
asserts BOTH a non-zero exit code AND that stderr contains the specified message
prefix. Then asserts a clean fixture exits 0. An assertion never observed to fail
for the right reason is evidence of nothing.

Usage:
  verify_agent_tier_selftest.py [--apex | --untouched]

--apex reuses the same matrix fixture cases against apex-tier model values
(opus / gemini-2.5-pro) instead of the standard tier (sonnet / gemini-2.5-flash),
per F2/A8, and also runs the two apex YAML-trap fixtures (ruling 17). The
frontmatter and canonical-sweep cases (test_frontmatter_checker,
test_literal_model_checker) are value-agnostic and run at their fixed
standard-tier value (sonnet / flash) in every mode, including --apex.

--untouched runs only the --untouched-baseline mutation suite (nine cases,
goldens/untouched_baseline_mutation_cases.md), per F2/A10. The default
(no-flag) run includes it too; --apex does not.

Fixtures live under tempfile.mkdtemp() and are removed in a finally block. This
script never touches the real .agent/, .claude/, or .gemini/ trees.
"""
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTMATTER_CHECKER = REPO_ROOT / "execution" / "checks" / "verify_agent_model_frontmatter.py"
MATRIX_CHECKER = REPO_ROOT / "execution" / "checks" / "verify_agent_tier_matrix.py"
LITERAL_MODEL_CHECKER = REPO_ROOT / "execution" / "checks" / "verify_no_literal_model_in_canonical.py"

results = []  # (case_name, passed: bool, detail: str)


def record(case_name: str, passed: bool, detail: str = ""):
    results.append((case_name, passed, detail))
    status = "ok" if passed else "MUTATION-CHECK-FAILED"
    print(f"[{status}] {case_name} {detail}")


def run(cmd, env=None):
    full_env = dict(os.environ)
    if env:
        full_env.update(env)
    proc = subprocess.run(
        [sys.executable] + cmd, capture_output=True, text=True, env=full_env
    )
    return proc.returncode, proc.stdout, proc.stderr


def assert_fails_with(case_name, cmd, expected_prefix, env=None):
    code, out, err = run(cmd, env=env)
    if code == 0:
        record(case_name, False, f"expected non-zero exit, got 0. stdout={out!r}")
        return
    if expected_prefix not in err:
        record(case_name, False, f"expected stderr to contain {expected_prefix!r}, got {err!r}")
        return
    record(case_name, True)


def assert_passes(case_name, cmd, env=None):
    code, out, err = run(cmd, env=env)
    if code != 0:
        record(case_name, False, f"expected exit 0, got {code}. stderr={err!r}")
        return
    record(case_name, True)


def test_frontmatter_checker(tmp: Path):
    """Spec A — every failure row in the table."""
    d = tmp / "a"
    d.mkdir()

    # file does not exist
    assert_fails_with(
        "A: file not found",
        [str(FRONTMATTER_CHECKER), str(d / "nope.md"), "sonnet"],
        "FAIL: agent file not found:",
    )

    # file does not start with ---
    f = d / "no_frontmatter.md"
    f.write_text("# just a heading\nno frontmatter here\n")
    assert_fails_with(
        "A: no frontmatter block",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: no YAML frontmatter block in",
    )

    # unterminated frontmatter block
    f = d / "unterminated.md"
    f.write_text("---\nmodel: sonnet\nno closing delimiter\n")
    assert_fails_with(
        "A: unterminated frontmatter",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: unterminated frontmatter block in",
    )

    # block is not valid YAML
    f = d / "bad_yaml.md"
    f.write_text("---\nmodel: [unclosed\n---\nbody\n")
    assert_fails_with(
        "A: invalid YAML",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: frontmatter is not valid YAML in",
    )

    # block parses to a non-dict
    f = d / "non_dict.md"
    f.write_text("---\n- one\n- two\n---\nbody\n")
    assert_fails_with(
        "A: non-dict frontmatter",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: frontmatter is not a mapping in",
    )

    # no model key
    f = d / "no_model_key.md"
    f.write_text("---\nname: architect\n---\nbody\n")
    assert_fails_with(
        "A: no model key",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: no model: key in frontmatter of",
    )

    # value mismatch
    f = d / "mismatch.md"
    f.write_text("---\nname: architect\nmodel: opus\n---\nbody\n")
    assert_fails_with(
        "A: model mismatch",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: model mismatch in",
    )

    # pyyaml not importable — shadow the real yaml module with a stub that
    # raises ImportError at import time, via a PYTHONPATH-injected fake module.
    f = d / "clean.md"
    f.write_text("---\nname: architect\nmodel: sonnet\n---\nbody\n")
    fake_site = tmp / "fake_site"
    fake_site.mkdir()
    (fake_site / "yaml.py").write_text("raise ImportError('pyyaml blocked for test')\n")
    env = {"PYTHONPATH": str(fake_site) + os.pathsep + os.environ.get("PYTHONPATH", "")}
    assert_fails_with(
        "A: pyyaml not importable",
        [str(FRONTMATTER_CHECKER), str(f), "sonnet"],
        "FAIL: pyyaml not importable",
        env=env,
    )

    # clean fixture passes
    assert_passes("A: clean fixture passes", [str(FRONTMATTER_CHECKER), str(f), "sonnet"])


def write_agent(root: Path, provider_dir: str, name: str, frontmatter_lines, body="body\n"):
    d = root / provider_dir / "agents"
    d.mkdir(parents=True, exist_ok=True)
    content = "---\n" + "\n".join(frontmatter_lines) + "\n---\n" + body
    (d / f"{name}.md").write_text(content)


def build_clean_matrix_root(tmp: Path, name: str, tier: str, claude_model: str, gemini_model: str) -> Path:
    root = tmp / f"matrix_{name}_{tier}"
    write_agent(root, ".agent", name, [f"model_tier: {tier}", f"name: {name}"])
    write_agent(root, ".claude", name, [f"name: {name}", f"model: {claude_model}"])
    write_agent(root, ".gemini", name, [f"name: {name}", f"model: {gemini_model}"])
    return root


def write_golden(tmp: Path, name: str, tier: str, claude_model: str, gemini_model: str) -> Path:
    golden = tmp / f"golden_{name}.yaml"
    golden.write_text(
        "schema: athanor.tier-matrix/v1\n"
        "agents:\n"
        f"  {name}:\n"
        f"    model_tier: {tier}\n"
        f"    claude: {claude_model}\n"
        f"    gemini: {gemini_model}\n"
    )
    return golden


def test_matrix_checker(tmp: Path, tier: str, claude_model: str, gemini_model: str):
    """Spec B — steps 2 through 6."""
    name = "testagent"
    golden = write_golden(tmp, name, tier, claude_model, gemini_model)

    # step 2: canonical model_tier mismatch
    root = build_clean_matrix_root(tmp, name, "local", claude_model, gemini_model)
    assert_fails_with(
        f"B[{tier}]: canonical model_tier mismatch",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: canonical model_tier mismatch",
    )

    # step 3: canonical has a literal model: key
    root = tmp / f"matrix_{name}_{tier}_literalmodel"
    write_agent(root, ".agent", name, [f"model_tier: {tier}", f"name: {name}", f"model: {claude_model}"])
    write_agent(root, ".claude", name, [f"name: {name}", f"model: {claude_model}"])
    write_agent(root, ".gemini", name, [f"name: {name}", f"model: {gemini_model}"])
    assert_fails_with(
        f"B[{tier}]: canonical literal model key",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: canonical frontmatter contains a literal model: key",
    )

    # step 4: claude model mismatch
    root = tmp / f"matrix_{name}_{tier}_claudewrong"
    write_agent(root, ".agent", name, [f"model_tier: {tier}", f"name: {name}"])
    write_agent(root, ".claude", name, [f"name: {name}", "model: wrong-model"])
    write_agent(root, ".gemini", name, [f"name: {name}", f"model: {gemini_model}"])
    assert_fails_with(
        f"B[{tier}]: .claude model mismatch",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: .claude model mismatch",
    )

    # step 5: gemini model mismatch
    root = tmp / f"matrix_{name}_{tier}_geminiwrong"
    write_agent(root, ".agent", name, [f"model_tier: {tier}", f"name: {name}"])
    write_agent(root, ".claude", name, [f"name: {name}", f"model: {claude_model}"])
    write_agent(root, ".gemini", name, [f"name: {name}", "model: wrong-model"])
    assert_fails_with(
        f"B[{tier}]: .gemini model mismatch",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: .gemini model mismatch",
    )

    # step 6: provider name: does not match agent name (copied-and-half-renamed)
    root = tmp / f"matrix_{name}_{tier}_namewrong"
    write_agent(root, ".agent", name, [f"model_tier: {tier}", f"name: {name}"])
    write_agent(root, ".claude", name, ["name: some-other-agent", f"model: {claude_model}"])
    write_agent(root, ".gemini", name, [f"name: {name}", f"model: {gemini_model}"])
    assert_fails_with(
        f"B[{tier}]: .claude name mismatch",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: .claude frontmatter name:",
    )

    # --agents and --untouched-baseline are mutually exclusive
    root = build_clean_matrix_root(tmp, name, tier, claude_model, gemini_model)
    assert_fails_with(
        f"B[{tier}]: --agents and --untouched-baseline are mutually exclusive",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--untouched-baseline", "--root", str(root)],
        "FAIL: --agents and --untouched-baseline are mutually exclusive",
    )

    # clean fixture passes
    root = build_clean_matrix_root(tmp, name, tier, claude_model, gemini_model)
    assert_passes(
        f"B[{tier}]: clean fixture passes",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
    )


def test_yaml_trap_apex(tmp: Path):
    """DECISION.md ruling 17 -- an unquoted description: value containing a
    `word: value` phrase is invalid YAML (PyYAML raises ScannerError before any
    checker-specific logic runs). Pinned here rather than left to the generic
    "invalid YAML" case because detection is coupled to every checker handing
    the whole frontmatter block to yaml.safe_load and catching yaml.YAMLError
    broadly -- a future line-wise parser would reopen the trap with nothing to
    catch it. Folded into A8's apex suite, no new assertion (per ruling 17)."""
    name = "trapagent"

    # canonical file: matrix checker must fail with "could not parse canonical
    # frontmatter at" -- not a silent misparse.
    root = tmp / "yaml_trap_canonical"
    write_agent(
        root,
        ".agent",
        name,
        [
            "model_tier: apex",
            f"name: {name}",
            "description: Apex-tier system design, declaring tier: apex inline unquoted.",
        ],
    )
    write_agent(root, ".claude", name, [f"name: {name}", "model: opus"])
    write_agent(root, ".gemini", name, [f"name: {name}", "model: gemini-2.5-pro"])
    golden = write_golden(tmp, name, "apex", "opus", "gemini-2.5-pro")
    assert_fails_with(
        "A8: YAML trap in canonical description (unquoted word: value)",
        [str(MATRIX_CHECKER), str(golden), "--agents", name, "--root", str(root)],
        f"{name}: could not parse canonical frontmatter at",
    )

    # provider file: frontmatter checker must fail with "FAIL: frontmatter is
    # not valid YAML in" -- not a silent misparse.
    d = tmp / "yaml_trap_provider"
    d.mkdir()
    f = d / f"{name}.md"
    f.write_text(
        "---\n"
        f"name: {name}\n"
        "model: opus\n"
        "description: Apex-tier system design, declaring tier: apex inline unquoted.\n"
        "---\n"
        "body\n"
    )
    assert_fails_with(
        "A8: YAML trap in provider description (unquoted word: value)",
        [str(FRONTMATTER_CHECKER), str(f), "opus"],
        "FAIL: frontmatter is not valid YAML in",
    )


def write_untouched_golden(tmp: Path, suffix: str, empty: bool = False, absent: bool = False) -> Path:
    golden = tmp / f"untouched_golden_{suffix}.yaml"
    if absent:
        golden.write_text("schema: athanor.tier-matrix/v1\n")
    elif empty:
        golden.write_text("schema: athanor.tier-matrix/v1\nuntouched: {}\n")
    else:
        golden.write_text(
            "schema: athanor.tier-matrix/v1\n"
            "untouched:\n"
            "  alpha: {model_tier: flash, claude: sonnet, gemini: gemini-2.5-flash}\n"
            "  beta:  {model_tier: local, claude: haiku,  gemini: gemini-2.5-flash-lite}\n"
        )
    return golden


def build_untouched_root(tmp: Path, suffix: str) -> Path:
    """Clean two-entry (alpha/beta) fixture root matching the baseline golden's
    values exactly, per goldens/untouched_baseline_mutation_cases.md."""
    root = tmp / f"untouched_root_{suffix}"
    write_agent(root, ".agent", "alpha", ["model_tier: flash", "name: alpha"])
    write_agent(root, ".claude", "alpha", ["name: alpha", "model: sonnet"])
    write_agent(root, ".gemini", "alpha", ["name: alpha", "model: gemini-2.5-flash"])
    write_agent(root, ".agent", "beta", ["model_tier: local", "name: beta"])
    write_agent(root, ".claude", "beta", ["name: beta", "model: haiku"])
    write_agent(root, ".gemini", "beta", ["name: beta", "model: gemini-2.5-flash-lite"])
    return root


def test_untouched_baseline(tmp: Path):
    """A10 -- mutation coverage for verify_agent_tier_matrix.py's
    --untouched-baseline / check_untouched code path, per
    goldens/untouched_baseline_mutation_cases.md (nine cases U1-U9). Do not
    add, remove, or reword cases -- raise it with @architect-apex instead."""
    golden = write_untouched_golden(tmp, "clean")

    # U1: canonical model_tier drift
    root = build_untouched_root(tmp, "u1")
    write_agent(root, ".agent", "alpha", ["model_tier: apex", "name: alpha"])
    assert_fails_with(
        "U1: canonical model_tier drift",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: untouched baseline drift: canonical model_tier expected flash, got apex",
    )

    # U2: claude model drift
    root = build_untouched_root(tmp, "u2")
    write_agent(root, ".claude", "alpha", ["name: alpha", "model: opus"])
    assert_fails_with(
        "U2: claude model drift",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: untouched baseline drift: .claude model expected sonnet, got opus",
    )

    # U3: gemini model drift
    root = build_untouched_root(tmp, "u3")
    write_agent(root, ".gemini", "alpha", ["name: alpha", "model: gemini-2.5-pro"])
    assert_fails_with(
        "U3: gemini model drift",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: untouched baseline drift: .gemini model expected gemini-2.5-flash, got gemini-2.5-pro",
    )

    # U4: canonical file missing
    root = build_untouched_root(tmp, "u4")
    (root / ".agent" / "agents" / "alpha.md").unlink()
    assert_fails_with(
        "U4: canonical file missing",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: could not parse canonical frontmatter at",
    )

    # U5: claude file missing
    root = build_untouched_root(tmp, "u5")
    (root / ".claude" / "agents" / "alpha.md").unlink()
    assert_fails_with(
        "U5: claude file missing",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: could not parse .claude frontmatter at",
    )

    # U6: gemini file missing
    root = build_untouched_root(tmp, "u6")
    (root / ".gemini" / "agents" / "alpha.md").unlink()
    assert_fails_with(
        "U6: gemini file missing",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "alpha: could not parse .gemini frontmatter at",
    )

    # U7: empty untouched: map -- both shapes (key present but empty, key
    # absent entirely) must FAIL, not silently iterate zero entries and pass.
    root = build_untouched_root(tmp, "u7")
    empty_golden = write_untouched_golden(tmp, "u7_empty", empty=True)
    assert_fails_with(
        "U7: empty untouched: map (key present, empty)",
        [str(MATRIX_CHECKER), str(empty_golden), "--untouched-baseline", "--root", str(root)],
        "FAIL: golden contains no untouched: baseline entries",
    )
    absent_golden = write_untouched_golden(tmp, "u7_absent", absent=True)
    assert_fails_with(
        "U7: empty untouched: map (key absent)",
        [str(MATRIX_CHECKER), str(absent_golden), "--untouched-baseline", "--root", str(root)],
        "FAIL: golden contains no untouched: baseline entries",
    )

    # U8: drift in second entry only -- the loop must not short-circuit on a
    # clean first entry (alpha).
    root = build_untouched_root(tmp, "u8")
    write_agent(root, ".claude", "beta", ["name: beta", "model: sonnet"])
    assert_fails_with(
        "U8: drift in second entry only",
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)],
        "beta: untouched baseline drift: .claude model expected haiku, got sonnet",
    )

    # U9: clean baseline passes -- positive control. Without it, a
    # check_untouched that always returns a failure would pass every other case.
    root = build_untouched_root(tmp, "u9")
    code, out, err = run(
        [str(MATRIX_CHECKER), str(golden), "--untouched-baseline", "--root", str(root)]
    )
    if code != 0 or "PASS" not in out:
        record("U9: clean baseline passes", False, f"code={code} stdout={out!r} stderr={err!r}")
    else:
        record("U9: clean baseline passes", True)


def test_literal_model_checker(tmp: Path):
    """Spec C."""
    d = tmp / "c_clean"
    d.mkdir()
    (d / "ok.md").write_text("---\nname: ok\nmodel_tier: flash\n---\nbody\n")
    assert_passes(
        "C: clean canonical sweep passes",
        [str(LITERAL_MODEL_CHECKER), "--root", str(d)],
    )

    d = tmp / "c_offender"
    d.mkdir()
    (d / "ok.md").write_text("---\nname: ok\nmodel_tier: flash\n---\nbody\n")
    (d / "bad.md").write_text("---\nname: bad\nmodel_tier: flash\nmodel: opus\n---\nbody\n")
    assert_fails_with(
        "C: literal model key detected",
        [str(LITERAL_MODEL_CHECKER), "--root", str(d)],
        "FAIL: literal model: key found in canonical frontmatter of",
    )


def main() -> int:
    argv = sys.argv[1:]
    apex = "--apex" in argv
    untouched_only = "--untouched" in argv

    tmp_dir = tempfile.mkdtemp(prefix="agent_tier_selftest_")
    try:
        tmp = Path(tmp_dir)

        if untouched_only:
            # A10 -- dedicated run of the --untouched-baseline mutation suite.
            test_untouched_baseline(tmp)
        elif apex:
            test_frontmatter_checker(tmp)
            test_literal_model_checker(tmp)
            test_matrix_checker(tmp, "apex", "opus", "gemini-2.5-pro")
            test_yaml_trap_apex(tmp)
        else:
            test_frontmatter_checker(tmp)
            test_literal_model_checker(tmp)
            test_matrix_checker(tmp, "flash", "sonnet", "gemini-2.5-flash")
            # also exercise apex fixtures unconditionally so a plain run still
            # proves both tiers behave the same way
            test_matrix_checker(tmp, "apex", "opus", "gemini-2.5-pro")
            test_untouched_baseline(tmp)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} mutation checks observed failing for the right reason")

    if failed:
        for name, _, detail in failed:
            print(f"FAIL: mutation case did not behave as specified: {name} ({detail})", file=sys.stderr)
        return 1

    print("PASS: all checkers observed failing for the right reason, and passing on clean fixtures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
