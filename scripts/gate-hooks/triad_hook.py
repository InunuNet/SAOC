#!/usr/bin/env python3
"""Gate hook: verification-triad coverage preflight (registered as triad-coverage).

Usage: triad_hook.py <contract-path>. Runs execution/verify_triad_coverage.py against the
contract and maps the result onto the stock gate's hook exit codes: 0 compliant, exempt or
grandfathered, 1 confirmed missing triad kinds that are not grandfathered, 2 infrastructure
error (the registry marks this hook on_error closed, so 2 blocks the gate).

A contract is grandfathered only when it is listed in the baseline AND pinned AND the
sha256 of its live bytes equals the pin; an edit since pinning forfeits the grandfather.
The baseline is read only when the linter reports a finding. The contract key is its path
relative to cwd (the project root, which the gate sets). The repo is located from this
file, never from cwd. Linter output is captured as bytes: a decode failure, like any
unexpected exception, is an infrastructure error (exit 2), never a finding. Ported from the pinned contract.py's _run_triad_coverage_preflight.
"""
import hashlib
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LINTER_TIMEOUT_SECONDS = 30
LINTER_VALID_EXIT_CODES = (0, 1)
LINTER_ENV_VAR = "TRIAD_LINTER_SCRIPT_OVERRIDE"
BASELINE_ENV_VAR = "TRIAD_BASELINE_FILE"
BASELINE_HASH_ENV_VAR = "TRIAD_BASELINE_HASH_FILE"
DEFAULT_LINTER = REPO_ROOT / "execution" / "verify_triad_coverage.py"
DEFAULT_BASELINE = REPO_ROOT / "execution" / "triad-baseline-exempt.txt"
DEFAULT_BASELINE_HASH = REPO_ROOT / "execution" / "triad-baseline-exempt.sha256"
EXIT_OK = 0
EXIT_FINDING = 1
EXIT_ERROR = 2
BANNER = "=" * 78


class PreflightError(Exception):
    """An infrastructure failure: maps to exit 2, never a pass and never a finding."""


def load_baseline_paths(baseline_path: Path) -> set:
    """Plain path per line, comments and blanks ignored. Missing file means empty baseline."""
    if not baseline_path.exists():
        return set()
    return {
        line.strip()
        for line in baseline_path.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    }


def load_baseline_hashes(hash_path: Path) -> dict:
    """`<sha256>  <path>` per line -> {path: hash}. Missing file means no pins."""
    entries: dict = {}
    if not hash_path.exists():
        return entries
    for line in hash_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        entries[parts[1].strip()] = parts[0].strip()
    return entries


def is_grandfathered(contract_key: str) -> bool:
    baseline_path = Path(os.environ.get(BASELINE_ENV_VAR, str(DEFAULT_BASELINE)))
    hash_path = Path(os.environ.get(BASELINE_HASH_ENV_VAR, str(DEFAULT_BASELINE_HASH)))
    try:
        listed = load_baseline_paths(baseline_path)
    except (OSError, UnicodeDecodeError) as exc:
        raise PreflightError(f"could not read {baseline_path} -- {type(exc).__name__}: {exc}")
    if contract_key not in listed:
        return False
    try:
        pinned = load_baseline_hashes(hash_path).get(contract_key)
    except (OSError, UnicodeDecodeError) as exc:
        raise PreflightError(f"could not read {hash_path} -- {type(exc).__name__}: {exc}")
    if not pinned:
        return False  # listed but unpinned cannot be honoured
    live = Path.cwd() / contract_key
    try:
        digest = hashlib.sha256(live.read_bytes()).hexdigest()
    except OSError:
        return False
    return digest == pinned


def run_linter(contract_path: str) -> int:
    linter = Path(os.environ.get(LINTER_ENV_VAR, str(DEFAULT_LINTER)))
    print(f"--- Verification-triad coverage preflight: {linter} ---")
    try:
        # Invoked by its own path, not sys.executable, so a non-Python stub runs under its shebang.
        result = subprocess.run([str(linter), contract_path], capture_output=True,
                                timeout=LINTER_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError) as exc:
        raise PreflightError(f"could not run {linter} against {contract_path} -- "
                             f"{type(exc).__name__}: {exc}")
    try:
        stdout = result.stdout.decode("utf-8")
        stderr = result.stderr.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise PreflightError(f"{linter} output is not valid UTF-8 ({exc.reason}); exit code "
                             f"{result.returncode} is not trusted")
    if stdout:
        print(stdout.rstrip())
    if stderr:
        print(stderr.rstrip(), file=sys.stderr)
    if result.returncode not in LINTER_VALID_EXIT_CODES:
        raise PreflightError(f"{linter} exited {result.returncode}, outside its documented "
                             f"classification contract {LINTER_VALID_EXIT_CODES}")
    return result.returncode


def check(contract_path: str) -> int:
    if run_linter(contract_path) == 0:
        return EXIT_OK  # PASS or EXEMPT: the baseline is never read
    contract_key = os.path.relpath(os.path.abspath(contract_path), os.getcwd())
    if is_grandfathered(contract_key):
        print(f"TRIAD PREFLIGHT: {contract_key} is missing triad kind(s) but is grandfathered "
              "in the rollout baseline (unedited since baselining) -- warning, not blocking.")
        return EXIT_OK
    print(BANNER, file=sys.stderr)
    print(f"TRIAD PREFLIGHT BLOCKED: {contract_key} is a UI/workflow contract missing "
          "verification-triad kind(s) and is not grandfathered (either never baselined, or "
          "edited since baselining -- an edit forfeits the grandfather). Add the missing triad "
          "assertions, or, only with real justification, add it to "
          "execution/triad-baseline-exempt.txt with a matching pin in "
          "execution/triad-baseline-exempt.sha256.", file=sys.stderr)
    print(BANNER, file=sys.stderr)
    return EXIT_FINDING


def main(argv: list) -> int:
    if len(argv) != 2:
        print("TRIAD PREFLIGHT ERROR: usage: triad_hook.py <contract-path>", file=sys.stderr)
        return EXIT_ERROR
    try:
        return check(argv[1])
    except Exception as exc:  # exit 1 is a finding; anything unexpected must be exit 2
        detail = str(exc) if isinstance(exc, PreflightError) else \
            f"unexpected {type(exc).__name__}: {exc}"
        print(BANNER, file=sys.stderr)
        print(f"TRIAD PREFLIGHT ERROR: {detail}", file=sys.stderr)
        print("This is an infrastructure failure, not a finding: the triad preflight fails "
              "CLOSED because it has no external dependency, so a missing or crashing linter "
              "or an unreadable baseline is a real regression.", file=sys.stderr)
        print(BANNER, file=sys.stderr)
        return EXIT_ERROR


if __name__ == "__main__":
    sys.exit(main(sys.argv))
