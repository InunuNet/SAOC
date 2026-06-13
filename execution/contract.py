#!/usr/bin/env python3
"""
contract.py — Validation Contract CLI for Athanor.
Usage:
  contract.py validate <contract.yaml>          — validate schema
  contract.py check <contract.yaml> --assertion A1 [--handoff <file>]
  contract.py gate <contract.yaml> --phase N [--run-checks]  — exit 0 iff all phase-N assertions pass; --run-checks auto-runs any missing checks first
  contract.py report <contract.yaml>            — print coverage table
  contract.py clear <contract.yaml>             — delete result files for this contract
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

RESULTS_DIR = Path(".agent/memory/scratch/contract-results")


def load_contract(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        print(f"ERROR: contract file not found: {path}", file=sys.stderr)
        sys.exit(1)
    try:
        # Try YAML first, fall back to JSON
        try:
            import yaml
            with open(p) as f:
                contract = yaml.safe_load(f)
        except ImportError:
            with open(p) as f:
                contract = json.load(f)
        return normalize_contract(contract)
    except Exception as e:
        print(f"ERROR: failed to parse {path}: {e}", file=sys.stderr)
        sys.exit(1)


def normalize_contract(contract: dict) -> dict:
    """
    Convert @architect-generated contract format to the internal format contract.py uses.

    @architect format:
      assertions:
        phase: 4
        checks:
          - id: A1
            description: ...
            command: grep -q "..." path

    Internal format:
      assertions:
        - id: A1
          description: ...
          verify:
            kind: shell
            cmd: grep -q "..." path
      phases:
        - id: 4
          assertions: [A1, A2, ...]

    Also normalizes:
      - slug -> spec (if spec missing)
      - goal -> description (if description missing at top level)
    """
    c = dict(contract)

    # Normalize slug -> spec
    if "spec" not in c and "slug" in c:
        c["spec"] = c["slug"]

    assertions_raw = c.get("assertions", [])

    # Detect @architect dict format: {phase: N, checks: [...]}
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        phase_id = assertions_raw.get("phase", 1)
        try:
            phase_id = int(phase_id)
        except (TypeError, ValueError):
            pass
        checks = assertions_raw.get("checks", [])

        # Convert checks to internal assertion list
        assertion_list = []
        assertion_ids = []
        for check in checks:
            cid = check.get("id", "")
            desc = check.get("description", "")
            cmd = check.get("command", "")
            assertion_list.append({
                "id": cid,
                "description": desc,
                "verify": {
                    "kind": "shell",
                    "cmd": cmd,
                }
            })
            assertion_ids.append(cid)

        c["assertions"] = assertion_list

        # Synthesize phases if not present
        if "phases" not in c:
            c["phases"] = [{"id": phase_id, "assertions": assertion_ids}]

    return c


def slug_from_spec(contract: dict) -> str:
    spec = contract.get("spec", "unknown")
    return Path(spec).stem.replace(" ", "-")


def results_dir(contract: dict) -> Path:
    return RESULTS_DIR / slug_from_spec(contract)


def result_file(contract: dict, assertion_id: str) -> Path:
    return results_dir(contract) / f"{assertion_id}.json"


def write_result(contract: dict, assertion_id: str, verdict: str, evidence: str):
    d = results_dir(contract)
    d.mkdir(parents=True, exist_ok=True)
    r = result_file(contract, assertion_id)
    r.write_text(json.dumps({
        "id": assertion_id,
        "verdict": verdict,
        "evidence": evidence,
        "ts": datetime.now(timezone.utc).isoformat()
    }, indent=2))


def validate_cmd(args):
    contract = load_contract(args.contract)
    errors = []

    # Required fields
    for field in ["schema", "created_at", "assertions"]:
        if field not in contract:
            errors.append(f"Missing required field: {field}")
    if "spec" not in contract and "slug" not in contract:
        errors.append("Missing required field: spec or slug")

    if contract.get("schema") != "athanor.contract/v1":
        errors.append(f"Unknown schema: {contract.get('schema')}")

    assertions = contract.get("assertions", [])
    ids = set()
    binary_kinds = {"shell", "file_exists", "file_contains", "json_path", "handoff_field"}
    binary_count = 0
    for a in assertions:
        aid = a.get("id", "")
        if not re.match(r"^[A-Za-z0-9][A-Za-z0-9_-]*$", aid):
            errors.append(f"Invalid assertion ID: {aid}")
        if aid in ids:
            errors.append(f"Duplicate assertion ID: {aid}")
        ids.add(aid)
        if not a.get("description", ""):
            errors.append(f"Assertion {aid} missing description")
        if "verify" not in a:
            errors.append(f"Assertion {aid} missing verify block")
        elif a["verify"].get("kind") in binary_kinds:
            binary_count += 1

        # Detect prohibited multiline python3 -c pattern
        verify = a.get("verify", {})
        cmd = verify.get("cmd", "")
        if "python3" in cmd and "-c" in cmd and ("\n" in cmd or "\\n" in cmd):
            errors.append(
                f"Assertion {aid}: multiline python3 -c is prohibited — "
                "use single-line grep/test instead"
            )

    strict = getattr(args, "strict", False)
    if strict and binary_count == 0 and len(assertions) > 0:
        errors.append("No binary assertions (shell/file_exists/file_contains/json_path/handoff_field). "
                      "Contracts must have at least one machine-verifiable assertion.")

    if errors:
        for e in errors:
            print(f"  x {e}")
        sys.exit(1)

    binary_pct = int(100 * binary_count / len(assertions)) if assertions else 0
    print(f"Contract valid: {len(assertions)} assertions "
          f"({binary_count} binary/{len(assertions)-binary_count} agent_review, {binary_pct}% machine-verifiable), "
          f"schema={contract['schema']}")


def check_cmd(args):
    contract = load_contract(args.contract)
    assertion_id = args.assertion

    assertion = next((a for a in contract.get("assertions", []) if a["id"] == assertion_id), None)
    if not assertion:
        print(f"ERROR: assertion {assertion_id} not found in contract", file=sys.stderr)
        sys.exit(1)

    verify = assertion.get("verify", {})
    kind = verify.get("kind", "")
    verdict = "fail"
    evidence = ""

    if kind == "shell":
        cmd = verify.get("cmd", "")
        expected_exit = verify.get("expect_exit", 0)
        timeout = getattr(args, "timeout_seconds", 60)
        tf_name = None
        try:
            import tempfile
            actual_cmd = cmd
            use_shell = True
            # Any multiline command → write to a temp bash script to avoid shell parsing issues
            # (covers multiline python3 -c, heredocs emitted by @architect, and bare multiline cmds)
            if "\n" in cmd or "\\n" in cmd:
                cleaned = cmd.replace("\\n", "\n")
                with tempfile.NamedTemporaryFile(mode="w", suffix=".sh", delete=False) as tf:
                    tf.write("#!/usr/bin/env bash\n" + cleaned)
                    tf_name = tf.name
                os.chmod(tf_name, 0o755)
                actual_cmd = tf_name
                use_shell = False
            if use_shell:
                result = subprocess.run(actual_cmd, shell=True, capture_output=True, text=True,
                                        timeout=timeout, executable="/bin/bash")
            else:
                result = subprocess.run(actual_cmd, capture_output=True, text=True, timeout=timeout)
            evidence = (result.stdout + result.stderr).strip()[:500]
            verdict = "pass" if result.returncode == expected_exit else "fail"
        except subprocess.TimeoutExpired:
            evidence = f"Command timed out after {timeout}s"
            verdict = "fail"
        finally:
            if tf_name:
                try: os.unlink(tf_name)
                except: pass

    elif kind == "file_exists":
        path = verify.get("path", "")
        exists = Path(path).exists()
        verdict = "pass" if exists else "fail"
        evidence = f"Path {'exists' if exists else 'does not exist'}: {path}"

    elif kind == "file_contains":
        path = verify.get("path", "")
        pattern = verify.get("pattern", "")
        # Translate POSIX bracket expressions to Python regex equivalents
        posix_to_python = {
            "[:space:]": r"\s",
            "[:alpha:]": r"[a-zA-Z]",
            "[:digit:]": r"\d",
            "[:alnum:]": r"[a-zA-Z0-9]",
        }
        py_pattern = pattern
        for posix, python_equiv in posix_to_python.items():
            py_pattern = py_pattern.replace(f"[{posix}]", python_equiv)
        try:
            content = Path(path).read_text()
            found = bool(re.search(py_pattern, content))
            verdict = "pass" if found else "fail"
            evidence = f"Pattern {'found' if found else 'not found'}: {pattern!r} in {path}"
        except FileNotFoundError:
            verdict = "fail"
            evidence = f"File not found: {path}"

    elif kind == "json_path":
        path = verify.get("path", args.handoff or "")
        jsonpath = verify.get("jsonpath", "")
        expected = verify.get("equals")
        try:
            data = json.loads(Path(path).read_text())
            # Simple dot-notation traversal
            keys = jsonpath.lstrip("$.").split(".")
            val = data
            for k in keys:
                if isinstance(val, dict):
                    val = val.get(k)
                else:
                    val = None
                    break
            if expected is not None:
                verdict = "pass" if val == expected else "fail"
                evidence = f"Value at {jsonpath}: {val!r} (expected {expected!r})"
            else:
                verdict = "pass" if val is not None else "fail"
                evidence = f"Value at {jsonpath}: {val!r}"
        except Exception as e:
            verdict = "fail"
            evidence = str(e)

    elif kind == "handoff_field":
        handoff_file = args.handoff
        if not handoff_file:
            verdict = "skip"
            evidence = "No handoff file provided (--handoff)"
        else:
            jsonpath = verify.get("jsonpath", "")
            try:
                data = json.loads(Path(handoff_file).read_text())
                keys = jsonpath.lstrip("$.").split(".")
                val = data
                for k in keys:
                    if isinstance(val, dict):
                        val = val.get(k)
                    elif isinstance(val, list):
                        break
                    else:
                        val = None
                        break
                verdict = "pass" if val is not None else "fail"
                evidence = f"Field {jsonpath}: {'present' if val is not None else 'missing'}"
            except Exception as e:
                verdict = "fail"
                evidence = str(e)

    elif kind == "agent_review":
        rubric = verify.get("rubric", "")
        verdict = "skip"
        evidence = f"Agent review required. Rubric: {rubric[:200]}"
        print(f"SKIP {assertion_id}: agent_review — qa must verify manually")
        print(f"   Rubric: {rubric}")

    else:
        verdict = "fail"
        evidence = f"Unknown verify kind: {kind}"

    write_result(contract, assertion_id, verdict, evidence)
    icon = "PASS" if verdict == "pass" else ("SKIP" if verdict == "skip" else "FAIL")
    print(f"{icon} {assertion_id} ({kind}): {verdict.upper()}")
    if evidence:
        print(f"   {evidence[:200]}")
    sys.exit(0 if verdict in ("pass", "skip") else 1)


def _phase_matches(phase_id, target_str: str) -> bool:
    if str(phase_id) == target_str:
        return True
    try:
        return int(phase_id) == int(target_str)
    except (ValueError, TypeError):
        return False


def _gate_single_phase(contract: dict, args, assertion_ids_override=None) -> bool:
    """Helper function to gate a single phase."""
    phase_n = args.phase
    run_checks = getattr(args, "run_checks", False)

    if assertion_ids_override is not None:
        phase_assertions = assertion_ids_override
    else:
        # Find assertions for this phase
        phases = contract.get("phases", [])
        phase = next((p for p in phases if _phase_matches(p["id"], phase_n)), None)
        if not phase:
            print(f"ERROR: phase {phase_n} not found in contract", file=sys.stderr)
            return False
        phase_assertions = phase.get("assertions", [])

    # Auto-run checks for assertions that don't have a result file yet
    if run_checks:
        for aid in phase_assertions:
            rf = result_file(contract, aid)
            if not rf.exists():
                print(f"  AUTO-CHECK {aid}: no result file — running check now")
                check_args = argparse.Namespace(
                    contract=args.contract,
                    assertion=aid,
                    handoff=getattr(args, "handoff", None),
                    timeout_seconds=getattr(args, "timeout_seconds", 60),
                )
                # check_cmd calls sys.exit; capture it and continue
                try:
                    check_cmd(check_args)
                except SystemExit:
                    pass

    failing = []

    for aid in phase_assertions:
        rf = result_file(contract, aid)
        if not rf.exists():
            print(f"  WARNING: {aid}: no result file — run check first")
            failing.append(aid)
            continue
        result = json.loads(rf.read_text())
        verdict = result.get("verdict", "fail")
        icon = "PASS" if verdict == "pass" else ("SKIP" if verdict == "skip" else "FAIL")
        print(f"  {icon} {aid}: {verdict}")
        if verdict == "fail":
            failing.append(aid)

    if failing:
        print(f"\nFAIL Phase {phase_n} gate FAILED. Failing: {', '.join(failing)}")
        print("   Resolve before proceeding to the next phase.")
        return False
    else:
        print(f"\nPASS Phase {phase_n} gate PASSED. Proceed to next phase.")
        return True


def gate_cmd(args):
    contract = load_contract(args.contract)

    # Pre-flight: reject prohibited multiline python3 -c assertions before running
    for _a in contract.get("assertions", []):
        _cmd = _a.get("verify", {}).get("cmd", "")
        if "python3" in _cmd and "-c" in _cmd and ("\n" in _cmd or "\\n" in _cmd):
            print(f"ERROR: Assertion {_a['id']}: multiline python3 -c is prohibited — "
                  f"rewrite as a single-line command or a script file.", file=sys.stderr)
            sys.exit(1)

    if args.phase == "all":
        phases_data = sorted(contract.get("phases", []), key=lambda p: p.get("id", 0))

        # If phases are not explicitly defined or only a single phase is present
        # (which happens when normalized from @architect single-phase format),
        # ensure all assertions are gated as a single "all" phase.
        if not phases_data or (len(phases_data) == 1 and phases_data[0]['id'] in (1, '1') and
                               len(phases_data[0].get('assertions', [])) == len(contract.get('assertions', []))):
            print("INFO: No explicit multi-phase definition found. Gating all assertions as a single phase.")
            all_assertion_ids = [a["id"] for a in contract.get("assertions", [])]
            if not all_assertion_ids:
                print("No assertions found in contract to gate.")
                sys.exit(0)
            phases_data = [{"id": "all_assertions", "assertions": all_assertion_ids}]

        for phase_def in phases_data:
            phase_id = phase_def['id']
            print(f"\n--- Gating Phase {phase_id} ---")
            # Create a temporary args object for _gate_single_phase
            single_phase_args = argparse.Namespace(
                contract=args.contract,
                phase=str(phase_id),
                run_checks=getattr(args, "run_checks", False),
                handoff=getattr(args, "handoff", None)
            )
            # Pass assertion_ids directly so synthesized phases don't require a contract lookup
            if not _gate_single_phase(contract, single_phase_args, assertion_ids_override=phase_def.get("assertions")):
                print(f"\nFAIL: Phase {phase_id} failed. Stopping all-phase gate.")
                sys.exit(2) # Exit on first failure
        print("\nPASS All phases gated successfully.")
        sys.exit(0)
    elif args.phase == "max":
        phases = contract.get("phases", [])
        phase_n = max((p["id"] for p in phases), default=1)
        args.phase = str(phase_n) # Update args for _gate_single_phase
        if not _gate_single_phase(contract, args):
            sys.exit(2)
        sys.exit(0)
    else: # Specific phase number
        if not _gate_single_phase(contract, args):
            sys.exit(2)
        sys.exit(0)




def report_cmd(args):
    contract = load_contract(args.contract)
    assertions = contract.get("assertions", [])
    phases = contract.get("phases", [])

    # Build phase map
    phase_map = {}
    for p in phases:
        for aid in p.get("assertions", []):
            phase_map[aid] = p["id"]

    print(f"\nValidation Contract Report")
    print(f"Spec: {contract.get('spec')}")
    print(f"{'ID':<6} {'Phase':<6} {'Kind':<16} {'Verdict':<8} Description")
    print("-" * 80)

    for a in assertions:
        aid = a["id"]
        phase_id = phase_map.get(aid, "?")
        kind = a.get("verify", {}).get("kind", "?")
        rf = result_file(contract, aid)
        verdict = json.loads(rf.read_text()).get("verdict", "pending") if rf.exists() else "pending"
        desc = a.get("description", "")[:40]
        icon = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP", "pending": "PEND"}.get(verdict, "?")
        print(f"{aid:<6} {str(phase_id):<6} {kind:<16} {icon} {verdict:<6} {desc}")


def clear_cmd(args):
    contract = load_contract(args.contract)
    d = results_dir(contract)
    if d.exists():
        for f in d.glob("*.json"):
            f.unlink()
        print(f"Cleared results for {slug_from_spec(contract)}")
    else:
        print("Nothing to clear.")


def main():
    parser = argparse.ArgumentParser(description="Athanor Validation Contract CLI")
    sub = parser.add_subparsers(dest="cmd")

    v = sub.add_parser("validate", help="Validate contract schema. Use --strict to require at least one binary assertion.")
    v.add_argument("contract")
    v.add_argument("--strict", action="store_true", default=False,
                   help="Fail if no binary (machine-verifiable) assertions exist")

    c = sub.add_parser("check")
    c.add_argument("contract")
    c.add_argument("--assertion", required=True)
    c.add_argument("--handoff")
    c.add_argument("--timeout-seconds", type=int, default=60,
                   help="Shell assertion timeout in seconds (default: 60)")

    g = sub.add_parser("gate", help="Exit 0 iff all phase-N assertions pass. Use --run-checks to auto-run any missing checks before evaluating.")
    g.add_argument("contract")
    g.add_argument("--phase", type=str, required=True, choices=['all', 'max'] + [str(i) for i in range(1, 10)],
                   help="Phase id (integer), 'max' for highest phase, or 'all' for all phases in contract")
    g.add_argument("--run-checks", action="store_true", default=False,
                   help="Auto-run check for each assertion that lacks a result file before evaluating the gate")
    g.add_argument("--timeout-seconds", type=int, default=60,
                   help="Shell assertion timeout in seconds (default: 60)")

    r = sub.add_parser("report")
    r.add_argument("contract")

    cl = sub.add_parser("clear")
    cl.add_argument("contract")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(1)

    {"validate": validate_cmd, "check": check_cmd, "gate": gate_cmd,
     "report": report_cmd, "clear": clear_cmd}[args.cmd](args)


if __name__ == "__main__":
    main()
