#!/usr/bin/env python3
"""verify_secrets_gate_e2e.py -- assertion-shape-audit F2 repair.

Replaces two bucket-C (text-as-proxy) assertions:

  - harness-security-hardening/contract.yaml A7/A8: compared grep LINE
    NUMBERS of "secret_guard" vs "git push origin HEAD:main" in
    execution/improvement_loop.sh (and the template copy) to infer that
    the scan runs before the push. This observes source-text ORDERING,
    never the actual control flow: stripping the abort branch entirely
    (e.g. `secret_guard.py --stdin > /dev/null || true`, no `return 1`)
    leaves line order untouched and the assertion still green while the
    gate is dead.
  - wrap-mission-secrets-guard/contract-f1.yaml A4: `grep -q
    "secret_guard.py" execution/skills/wrap_mission.sh` -- presence-only,
    not even ordering. Satisfied by a comment mentioning the filename.

This replacement actually EXERCISES the real driver script's secret-abort
path end to end, in a disposable scratch git repo with a local (non-network)
bare "origin" remote:

  1. clean scenario: stage an ordinary file change, run the driver ->
     expect success AND a real commit landed on the scratch bare remote.
  2. secret scenario: additionally drop a file whose PATH matches
     secret_guard.py's own classifier (an extension/dirname pattern --
     content is irrelevant to that classifier, so the fixture file's
     content is an explicit, obviously-synthetic placeholder, never a
     real-looking credential) -> expect the driver to exit non-zero AND
     the scratch bare remote's main ref to be COMPLETELY unchanged (no
     push occurred), not merely "the function returned 1".

Two drivers, selected with --driver:
  improvement_loop  -- execution/improvement_loop.sh's gate_and_commit().
                        Extracted as a standalone function (brace-matched
                        from the real file, not retyped) and executed
                        alone, because the file's top-level main loop
                        (ghost-test discovery, ~10 iterations) is out of
                        scope for this gate and unsafe to run unfixtured.
  wrap_mission      -- execution/skills/wrap_mission.sh, copied verbatim
                        into the fixture and run end-to-end (it has no
                        main-loop wrapper, so no extraction is needed).
                        Its own execution/brain.py dependency is stubbed
                        (no-op) in the fixture only -- brain.py itself is
                        unrelated to the secret gate under test.

Override the driver source file via DRIVER_SCRIPT_UNDER_TEST (absolute
path) for negative verification against a deliberately broken temp copy --
never used in the production assertion, which always tests the real repo
file.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SECRET_FIXTURE_NAME = "synthetic_test_fixture.pem"
SECRET_FIXTURE_CONTENT = (
    "FIXTURE -- not a real credential. Used only by "
    "verify_secrets_gate_e2e.py to exercise secret_guard.py's PATH-based "
    "classifier (execution/skills/lib/secret_guard.py matches on filename/"
    "extension, not content).\n"
)

FAILURES = []


def fail(name, msg):
    FAILURES.append(f"{name}: {msg}")
    print(f"FAIL [{name}]: {msg}", file=sys.stderr)


def ok(name, msg):
    print(f"OK [{name}]: {msg}")


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=kw.pop("timeout", 30), **kw)


def extract_bash_function(source: str, func_name: str) -> str:
    """Return the full text of a top-level bash function definition
    (`name() {` ... matching `}`), located by naive brace counting. Good
    enough for well-formed shell where quoted strings never contain an
    unbalanced brace -- true of gate_and_commit() as of this writing."""
    lines = source.splitlines(keepends=True)
    start = None
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{func_name}()") and "{" in line:
            start = i
            break
    if start is None:
        raise ValueError(f"function {func_name}() not found")
    depth = 0
    out = []
    for line in lines[start:]:
        depth += line.count("{") - line.count("}")
        out.append(line)
        if depth == 0:
            break
    else:
        raise ValueError(f"unbalanced braces extracting {func_name}()")
    return "".join(out)


def init_bare_remote(tmp_root: Path) -> Path:
    bare = tmp_root / "origin.git"
    run(["git", "init", "--bare", "-q", str(bare)], check=True)
    return bare


def init_fixture_repo(tmp_root: Path, bare: Path) -> Path:
    repo = tmp_root / "repo"
    repo.mkdir()
    run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    run(["git", "-C", str(repo), "config", "user.email", "fixture@example.invalid"], check=True)
    run(["git", "-C", str(repo), "config", "user.name", "fixture"], check=True)
    run(["git", "-C", str(repo), "remote", "add", "origin", str(bare)], check=True)

    # Minimal repo skeleton so the driver's own machinery (make test / the
    # contract-gate glob) is a fast no-op, not a mock of the mechanism
    # under test (the secret scan + abort).
    (repo / "Makefile").write_text("test:\n\t@true\n.PHONY: test\n")
    (repo / ".agent" / "memory" / "project" / "specs").mkdir(parents=True)
    lib_dir = repo / "execution" / "skills" / "lib"
    lib_dir.mkdir(parents=True)
    shutil.copy(REPO_ROOT / "execution" / "skills" / "lib" / "secret_guard.py", lib_dir / "secret_guard.py")

    (repo / "README.md").write_text("fixture repo for verify_secrets_gate_e2e.py\n")
    run(["git", "-C", str(repo), "add", "-A"], check=True)
    run(["git", "-C", str(repo), "commit", "-q", "-m", "initial"], check=True)
    run(["git", "-C", str(repo), "push", "-q", "origin", "main"], check=True)
    return repo


def bare_head(bare: Path) -> str:
    r = run(["git", "--git-dir", str(bare), "rev-parse", "main"])
    return r.stdout.strip()


# ─── improvement_loop driver ──────────────────────────────────────────────

def improvement_loop_source() -> str:
    path = Path(os.environ.get(
        "DRIVER_SCRIPT_UNDER_TEST",
        str(REPO_ROOT / "execution" / "improvement_loop.sh"),
    ))
    return path.read_text()


def run_improvement_loop_gate(repo: Path) -> subprocess.CompletedProcess:
    func_src = extract_bash_function(improvement_loop_source(), "gate_and_commit")
    wrapper = "#!/usr/bin/env bash\nset -uo pipefail\nPROJECT_ROOT=\"$1\"\n" + func_src + "\ngate_and_commit\n"
    wrapper_path = repo.parent / "run_gate_and_commit.sh"
    wrapper_path.write_text(wrapper)
    wrapper_path.chmod(0o755)
    return run(["bash", str(wrapper_path), str(repo)])


# ─── wrap_mission driver ──────────────────────────────────────────────────

def wrap_mission_source() -> str:
    path = Path(os.environ.get(
        "DRIVER_SCRIPT_UNDER_TEST",
        str(REPO_ROOT / "execution" / "skills" / "wrap_mission.sh"),
    ))
    return path.read_text()


def install_wrap_mission(repo: Path):
    dest_dir = repo / "execution" / "skills"
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / "wrap_mission.sh").write_text(wrap_mission_source())
    (dest_dir / "wrap_mission.sh").chmod(0o755)
    # Stub brain.py: wrap_mission.sh calls it unconditionally near the top.
    # brain.py's own DB/memory machinery is unrelated to the secret gate
    # under test here -- stubbed so this fixture doesn't need a real brain
    # DB, not to mask anything the secret gate depends on.
    (repo / "execution" / "brain.py").write_text(
        "#!/usr/bin/env python3\nimport sys\nsys.exit(0)\n"
    )
    (repo / "execution" / "brain.py").chmod(0o755)


def run_wrap_mission_gate(repo: Path) -> subprocess.CompletedProcess:
    install_wrap_mission(repo)
    # No WRAP_EXPECTED_REMOTE override: the fixture's "origin" is a local
    # bare-repo filesystem path, not a URL, so the substring-normalization
    # WRAP_EXPECTED_REMOTE performs doesn't apply cleanly to it. Omitting it
    # exercises wrap_mission.sh's default (unconditional) push branch,
    # which is what real invocations use day to day.
    return run(
        ["bash", "execution/skills/wrap_mission.sh", "e2e-fixture-run", "fixture"],
        cwd=str(repo),
    )


DRIVERS = {
    "improvement_loop": run_improvement_loop_gate,
    "wrap_mission": run_wrap_mission_gate,
}


def scenario_clean(driver_name, run_gate):
    name = f"{driver_name}/clean_push_succeeds"
    with tempfile.TemporaryDirectory() as td:
        tmp_root = Path(td)
        bare = init_bare_remote(tmp_root)
        repo = init_fixture_repo(tmp_root, bare)
        before = bare_head(bare)

        # Modify an already-TRACKED file. `gate_and_commit`'s early-out
        # check is `git diff --quiet && git diff --cached --quiet`, which
        # (correctly, matching real script behavior) only sees changes to
        # tracked content -- a brand-new untracked file alone would not
        # trip it. Real loop iterations always touch tracked files.
        with open(repo / "README.md", "a") as f:
            f.write("an ordinary, non-secret change\n")

        r = run_gate(repo)
        after = bare_head(bare)

        if r.returncode != 0:
            fail(name, f"expected success, got exit={r.returncode} stdout={r.stdout!r} stderr={r.stderr!r}")
            return
        if after == before or not after:
            fail(name, f"expected a new commit pushed to the scratch remote; "
                       f"main ref unchanged (before={before!r} after={after!r})")
            return
        ok(name, f"ordinary change committed and pushed to scratch remote ({before[:7]} -> {after[:7]})")


def scenario_secret_blocks(driver_name, run_gate):
    name = f"{driver_name}/secret_file_blocks_and_no_push"
    with tempfile.TemporaryDirectory() as td:
        tmp_root = Path(td)
        bare = init_bare_remote(tmp_root)
        repo = init_fixture_repo(tmp_root, bare)
        before = bare_head(bare)

        with open(repo / "README.md", "a") as f:
            f.write("an ordinary, non-secret change\n")
        (repo / SECRET_FIXTURE_NAME).write_text(SECRET_FIXTURE_CONTENT)

        r = run_gate(repo)
        after = bare_head(bare)

        if r.returncode == 0:
            fail(name, f"expected non-zero exit (abort) with a secret-looking file staged, "
                       f"got exit=0 stdout={r.stdout!r} stderr={r.stderr!r}")
            return
        if after != before:
            fail(name, f"secret file was staged and the scratch remote's main ref STILL "
                       f"changed -- a push happened despite the secret guard "
                       f"(before={before!r} after={after!r})")
            return
        ok(name, "secret-looking file blocks commit/push; scratch remote untouched "
                 f"(exit={r.returncode})")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--driver", choices=sorted(DRIVERS), required=True)
    args = parser.parse_args()

    run_gate = DRIVERS[args.driver]

    scenario_clean(args.driver, run_gate)
    scenario_secret_blocks(args.driver, run_gate)

    if FAILURES:
        print(f"\n{len(FAILURES)} case(s) failed.", file=sys.stderr)
        return 1
    print(f"\nPASS: {args.driver} secret gate observed end-to-end (real push path, scratch remote)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
