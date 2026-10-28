#!/usr/bin/env python3
"""Proof runner for the project-owned gate hooks: prove_gate_hooks.py <scenario>.

Reads the oracle in .agent/memory/project/specs/harness-gate-hooks/goldens/ (the scenario
matrix, the fixture contracts and the stub scripts) and never embeds expectations. For each
scenario it builds a fixture project under .tmp/sandbox/gate-hooks-proof/<scenario>/, runs the
stock `execution/contract.py gate` against a throwaway contract there, and checks the exit
code, the --report-json phases and the output.

GATE_HOOKS_PROOF_NEUTER=1 replaces every registered hook with /usr/bin/true. That is the
negative control: a blocking scenario must then mismatch, which proves the hooks are what
blocks.

Exit 0 every expectation met, 1 an expectation mismatch, 2 usage or harness error.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDENS = REPO_ROOT / ".agent" / "memory" / "project" / "specs" / "harness-gate-hooks" / "goldens"
MATRIX_PATH = GOLDENS / "scenario-matrix.json"
FIXTURES = GOLDENS / "fixtures"
REAL_REGISTRY = REPO_ROOT / ".agent" / "contract_kinds.json"
PROOF_ROOT = REPO_ROOT / ".tmp" / "sandbox" / "gate-hooks-proof"
SAFE_DELETE = REPO_ROOT / "execution" / "safe_delete.py"
CONTRACT_PY = REPO_ROOT / "execution" / "contract.py"
GATE_TIMEOUT_SECONDS = 150
NEUTER_ENV_VAR = "GATE_HOOKS_PROOF_NEUTER"
NEUTER_COMMAND = ["/usr/bin/true"]
RESIDUE_FIXTURE_ENV_VAR = "CONTRACT_GATE_RESIDUE_FIXTURE"
TRIAD_ENV_PREFIX = "TRIAD_"
CONTRACT_NAME = "c.yaml"
BAD_UTF8_BYTES = b"\xff\xfe\xfd"
EXIT_OK = 0
EXIT_MISMATCH = 1
EXIT_USAGE = 2


class HarnessError(Exception):
    """A usage or harness problem (unknown scenario, missing golden): exit 2."""


def substitute(text: str, sandbox: Path) -> str:
    return text.replace("${SANDBOX}", str(sandbox)).replace("${REPO}", str(REPO_ROOT))


def load_matrix() -> dict:
    try:
        return json.loads(MATRIX_PATH.read_text())
    except (OSError, ValueError) as exc:
        raise HarnessError(f"cannot read {MATRIX_PATH}: {type(exc).__name__}: {exc}")


def remove_tree(path: Path) -> None:
    subprocess.run([sys.executable, str(SAFE_DELETE), str(path)], check=True,
                   capture_output=True, text=True)


def build_registry(sandbox: Path, neuter: bool) -> None:
    try:
        registry = json.loads(REAL_REGISTRY.read_text())
    except (OSError, ValueError) as exc:
        raise HarnessError(f"cannot read {REAL_REGISTRY}: {type(exc).__name__}: {exc}")
    for hook in registry.get("gate_hooks", []):
        if neuter:
            hook["command"] = list(NEUTER_COMMAND)
        elif not os.path.isabs(hook["command"][0]):
            hook["command"][0] = str(REPO_ROOT / hook["command"][0])
    (sandbox / ".agent" / "contract_kinds.json").write_text(json.dumps(registry, indent=2))


def build_fixture(name: str, scenario: dict, sandbox: Path, neuter: bool) -> Path:
    if sandbox.exists():
        remove_tree(sandbox)
    (sandbox / ".agent").mkdir(parents=True)
    build_registry(sandbox, neuter)
    shutil.copytree(FIXTURES / "stubs", sandbox / "stubs")
    source = FIXTURES / scenario["contract"]
    if not source.is_file():
        raise HarnessError(f"missing fixture contract {source}")
    contract = sandbox / CONTRACT_NAME
    contract.write_text(substitute(source.read_text(), sandbox))
    return contract


def run_prepare(scenario: dict, sandbox: Path) -> None:
    for step in scenario.get("prepare", []):
        if "copy" not in step:
            raise HarnessError(f"unknown prepare step {step}")
        source = Path(substitute(step["copy"], sandbox))
        if not source.is_file():
            raise HarnessError(f"missing prepare source {source}")
        shutil.copyfile(source, Path(substitute(step["to"], sandbox)))


def write_baseline(mode: str, sandbox: Path, contract: Path) -> dict:
    baseline = sandbox / "baseline.txt"
    pins = sandbox / "baseline.sha256"
    if mode == "empty":
        baseline.write_text("")
        pins.write_text("")
    elif mode in ("listed_pinned", "listed_pinned_then_edited"):
        digest = hashlib.sha256(contract.read_bytes()).hexdigest()
        baseline.write_text(f"{CONTRACT_NAME}\n")
        pins.write_text(f"{digest}  {CONTRACT_NAME}\n")
        if mode == "listed_pinned_then_edited":
            with contract.open("a") as handle:
                handle.write("\n# edited after pinning\n")
    elif mode == "listed_unpinned":
        baseline.write_text(f"{CONTRACT_NAME}\n")
        pins.write_text("")
    elif mode == "dir":
        baseline.mkdir()
        pins.write_text("")
    elif mode == "bad_utf8":
        baseline.write_bytes(BAD_UTF8_BYTES)
        pins.write_text("")
    elif mode == "hash_dir":
        baseline.write_text(f"{CONTRACT_NAME}\n")
        pins.mkdir()
    else:
        raise HarnessError(f"unknown triad_baseline mode {mode!r}")
    return {"TRIAD_BASELINE_FILE": str(baseline), "TRIAD_BASELINE_HASH_FILE": str(pins)}


def build_env(defaults: dict, scenario: dict, baseline_env: dict, sandbox: Path) -> dict:
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(TRIAD_ENV_PREFIX) and k != RESIDUE_FIXTURE_ENV_VAR}
    env[RESIDUE_FIXTURE_ENV_VAR] = substitute(defaults["residue_fixture"], sandbox)
    env.update(baseline_env)
    for key, value in scenario.get("env", {}).items():
        env[key] = substitute(value, sandbox)
    return env


def run_gate(contract: Path, sandbox: Path, phase: int, env: dict) -> tuple:
    report = sandbox / "report.json"
    cmd = [sys.executable, str(CONTRACT_PY), "gate", str(contract), "--phase", str(phase),
           "--run-checks", "--report-json", str(report)]
    proc = subprocess.run(cmd, cwd=str(REPO_ROOT), env=env, capture_output=True, text=True,
                          timeout=GATE_TIMEOUT_SECONDS)
    try:
        data = json.loads(report.read_text())
    except (OSError, ValueError):
        data = None
    return proc.returncode, proc.stdout + proc.stderr, data


def subset_matches(want, got) -> bool:
    if isinstance(want, dict):
        return isinstance(got, dict) and all(
            k in got and subset_matches(v, got[k]) for k, v in want.items())
    if isinstance(want, list):
        return isinstance(got, list) and want == got
    return str(want) == str(got) if isinstance(want, str) or isinstance(got, str) else want == got


def check_expectations(expect: dict, code: int, output: str, report) -> list:
    problems = []
    if code != expect["exit"]:
        problems.append(f"exit {code}, expected {expect['exit']}")
    phases = (report or {}).get("phases", [])
    if report is None and (expect.get("phases") or expect.get("overall")):
        problems.append("no --report-json was written")
    for want in expect.get("phases", []):
        match = [p for p in phases if str(p.get("phase")) == str(want["phase"])]
        if not match:
            problems.append(f"no report phase {want['phase']!r} (have "
                            f"{[p.get('phase') for p in phases]})")
        elif not subset_matches(want, match[0]):
            problems.append(f"phase {want['phase']!r} mismatch: want {want}, got {match[0]}")
    prefix = expect.get("no_phase_prefix")
    if prefix:
        bad = [str(p.get("phase")) for p in phases if str(p.get("phase")).startswith(prefix)]
        if bad:
            problems.append(f"unexpected report phase(s) {bad} starting with {prefix!r}")
    if "overall" in expect and (report or {}).get("overall") != expect["overall"]:
        problems.append(f"overall {(report or {}).get('overall')!r}, expected {expect['overall']!r}")
    problems += [f"output lacks {s!r}" for s in expect.get("stdout_contains", []) if s not in output]
    problems += [f"output contains forbidden {s!r}" for s in expect.get("stdout_absent", [])
                 if s in output]
    return problems


def run_scenario(name: str) -> int:
    matrix = load_matrix()
    scenario = matrix["scenarios"].get(name)
    if scenario is None:
        raise HarnessError(f"unknown scenario {name!r}; known: {', '.join(matrix['scenarios'])}")
    defaults = matrix["defaults"]
    neuter = os.environ.get(NEUTER_ENV_VAR) == "1"
    sandbox = PROOF_ROOT / name
    contract = build_fixture(name, scenario, sandbox, neuter)
    run_prepare(scenario, sandbox)
    mode = scenario.get("triad_baseline", defaults["triad_baseline"])
    baseline_env = write_baseline(mode, sandbox, contract)
    env = build_env(defaults, scenario, baseline_env, sandbox)
    code, output, report = run_gate(contract, sandbox, defaults["phase"], env)
    problems = check_expectations(scenario["expect"], code, output, report)
    label = f"{name}{' [NEUTERED]' if neuter else ''}"
    if problems:
        print(f"MISMATCH {label}:")
        for problem in problems:
            print(f"  - {problem}")
        print(f"  fixture kept at {sandbox}")
        return EXIT_MISMATCH
    remove_tree(sandbox)
    print(f"OK {label}: {scenario['description']}")
    return EXIT_OK


def main(argv: list) -> int:
    if len(argv) != 2:
        print("usage: prove_gate_hooks.py <scenario>", file=sys.stderr)
        return EXIT_USAGE
    try:
        return run_scenario(argv[1])
    except (HarnessError, subprocess.SubprocessError, OSError) as exc:
        print(f"HARNESS ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main(sys.argv))
