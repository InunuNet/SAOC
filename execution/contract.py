#!/usr/bin/env python3
"""
contract.py — Validation Contract CLI for Athanor.
Usage:
  contract.py validate <contract.yaml>          — validate schema
  contract.py check <contract.yaml> --assertion A1 [--handoff <file>]
  contract.py gate <contract.yaml> --phase N [--run-checks]  — exit 0 iff all phase-N assertions pass; --run-checks auto-runs any missing checks first
  contract.py report <contract.yaml>            — print coverage table
  contract.py clear <contract.yaml>             — delete result files for this contract

Exit-code contract for `gate` on a specific phase number (not "all"/"max"):
  0 = every phase-N assertion passed (allowing skips only via --allow-skips).
  1 = reserved specifically for "a real codex_qa adversarial finding is among
      the failing assertions for this phase" — a genuine cross-model QA
      BLOCKED verdict, never anything else.
  2 = every other failure shape: plain shell/file_exists/etc assertion
      failures with no codex_qa assertion involved at all (the pre-existing
      contract every non-codex_qa mission relies on), a pure codex_qa
      wrapper/usage error with zero real fail verdicts (auth/network/usage
      failure, not a finding), or unresolved skips.
  ("all"/"max" phase gating always exits 2 on any failure and 0 on full
  success — the 1-vs-2 codex_qa distinction only applies to the specific-
  phase path above.)
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
MAX_TIMEOUT_SECONDS = 86400  # 24h ceiling -- generous for CI, still finite


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

    # Normalize slug/feature -> spec
    if "spec" not in c and "slug" in c:
        c["spec"] = c["slug"]
    if "spec" not in c and "feature" in c:
        c["spec"] = c["feature"]

    # Normalize description -> goal
    if "goal" not in c and "description" in c:
        c["goal"] = c["description"]

    # Normalize phase-dict format: phases: {name: [{id, name, kind, verify}]}
    phases_raw = c.get("phases")
    if isinstance(phases_raw, dict):
        phase_list = []
        extra_assertions = []
        for phase_key, phase_items in phases_raw.items():
            m = re.match(r"(\d+)", str(phase_key))
            phase_id = int(m.group(1)) if m else phase_key
            assertion_ids = []
            for a in (phase_items or []):
                aid = a.get("id", "")
                verify = a.get("verify")
                if isinstance(verify, str):
                    verify = {"kind": a.get("kind", "shell"), "cmd": verify}
                elif verify is None:
                    verify = {"kind": a.get("kind", "shell"), "cmd": a.get("cmd", a.get("command", ""))}
                extra_assertions.append({
                    "id": aid,
                    "description": a.get("name", a.get("description", "")),
                    "verify": verify,
                })
                assertion_ids.append(aid)
            phase_list.append({"id": phase_id, "assertions": assertion_ids})
        c["phases"] = phase_list
        if not c.get("assertions"):
            c["assertions"] = extra_assertions

    assertions_raw = c.get("assertions", [])

    # Detect @architect dict format: {phase: N, checks: [...]}
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        phase_id = assertions_raw.get("phase", 1)
        try:
            phase_id = int(phase_id)
        except (TypeError, ValueError):
            pass
        checks = assertions_raw.get("checks", [])

        # GH #1317 / F6: if at least one check declares its own `phase:`
        # field, per-check phase routing is active for this whole checks:
        # list -- each check is routed to its own phase (falling back to
        # the block-level phase_id when a check omits the field), instead
        # of every check collapsing onto one block-level phase.
        per_check_phase_active = any("phase" in check for check in checks)

        # Convert checks to internal assertion list
        assertion_list = []
        assertion_ids = []
        phase_order = []
        phase_members = {}
        for check in checks:
            cid = check.get("id", "")
            desc = check.get("description", "")
            cmd = check.get("command", "")
            check_type = check.get("type", "shell")
            if check_type == "codex_qa":
                verify = {
                    "kind": "codex_qa",
                    "target": check.get("target", ""),
                    "script": check.get("script", "execution/codex_qa.sh"),
                    "timeout_seconds": check.get("timeout_seconds", 200),
                }
            else:
                verify = {"kind": "shell", "cmd": cmd}
                if "timeout_seconds" in check:
                    verify["timeout_seconds"] = check["timeout_seconds"]
            assertion_list.append({
                "id": cid,
                "description": desc,
                "verify": verify,
                "required": check.get("required", False),
            })
            assertion_ids.append(cid)

            if per_check_phase_active:
                if "phase" in check:
                    resolved_phase = check.get("phase")
                    try:
                        resolved_phase = int(resolved_phase)
                    except (TypeError, ValueError):
                        pass
                else:
                    resolved_phase = phase_id
                if resolved_phase not in phase_members:
                    phase_order.append(resolved_phase)
                    phase_members[resolved_phase] = []
                phase_members[resolved_phase].append(cid)

        c["assertions"] = assertion_list

        # Synthesize phases if not present
        if "phases" not in c:
            if per_check_phase_active:
                c["phases"] = [
                    {"id": pid, "assertions": phase_members[pid]}
                    for pid in phase_order
                ]
            else:
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


def _timeout_seconds_error(ts) -> str | None:
    """Same rule validate_cmd already enforces at file-scan time; now also
    callable at the point check_cmd is about to consume the value."""
    if isinstance(ts, bool) or not isinstance(ts, int):
        return f"must be an int, got {type(ts).__name__}"
    if ts <= 0:
        return f"must be positive, got {ts}"
    if ts > MAX_TIMEOUT_SECONDS:
        return f"exceeds max {MAX_TIMEOUT_SECONDS}s, got {ts}"
    return None


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

        ts = a.get("verify", {}).get("timeout_seconds")
        if ts is not None:
            ts_error = _timeout_seconds_error(ts)
            if ts_error:
                errors.append(f"Assertion {aid}: timeout_seconds {ts_error}")

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
        timeout = verify.get("timeout_seconds")
        if timeout is not None:
            ts_error = _timeout_seconds_error(timeout)
            if ts_error:
                evidence = f"Invalid timeout_seconds: {ts_error}"
                write_result(contract, assertion_id, "fail", evidence)
                print(f"FAIL {assertion_id} ({kind}): FAIL")
                print(f"   {evidence[:200]}")
                sys.exit(1)
        if timeout is None:
            timeout = getattr(args, "timeout_seconds", 60)
        tf_name = None
        try:
            import tempfile
            # Always execute via a temp bash script (no shell=True, no branching on
            # command content). Writes cmd verbatim -- no mutation of any kind --
            # so literal "\n" sequences inside quoted arguments are never rewritten.
            with tempfile.NamedTemporaryFile(mode="w", suffix=".sh", delete=False) as tf:
                tf.write("#!/usr/bin/env bash\n" + cmd)
                tf_name = tf.name
            os.chmod(tf_name, 0o755)
            # Prefer the project's own .venv for bare python3/pip PATH resolution, so
            # assertions checking installed-package/interpreter state see the venv that
            # actually runs the project, not whatever ambient PATH invoked contract.py.
            # Only affects bare-name resolution; already-hardcoded interpreter paths in
            # an assertion's own cmd string are untouched. No .venv -> no env= override.
            run_env = None
            venv_python = Path.cwd() / ".venv" / "bin" / "python3"
            if venv_python.exists():
                run_env = os.environ.copy()
                run_env["PATH"] = str(venv_python.parent) + os.pathsep + run_env.get("PATH", "")
            result = subprocess.run(tf_name, shell=False, env=run_env,
                                    capture_output=True, text=True, timeout=timeout)
            evidence = (result.stdout + result.stderr).strip()[:500]
            # Reserved skip exit code (autotools convention): checked BEFORE
            # comparison against expect_exit -- exit 77 always means skip,
            # regardless of what expect_exit was configured to.
            if result.returncode == 77:
                verdict = "skip"
            else:
                verdict = "pass" if result.returncode == expected_exit else "fail"
        except subprocess.TimeoutExpired:
            evidence = f"Command timed out after {timeout}s"
            verdict = "fail"
        finally:
            if tf_name:
                try: os.unlink(tf_name)
                except: pass

    elif kind == "codex_qa":
        target = verify.get("target", "")
        script = verify.get("script", "execution/codex_qa.sh")
        timeout = verify.get("timeout_seconds", 200)
        try:
            result = subprocess.run([script, target], capture_output=True,
                                     text=True, timeout=timeout)
            rc = result.returncode
            if rc == 0:
                verdict = "pass"
                evidence = "codex_qa PASS"
            elif rc == 1:
                verdict = "fail"
                evidence = "CODEX_QA_FAIL: " + result.stdout.strip()[:2000]
            elif rc == 2:
                verdict = "error"
                evidence = "CODEX_QA_WRAPPER_ERROR: " + (result.stdout + result.stderr).strip()[:500]
            else:
                verdict = "error"
                evidence = f"codex_qa wrapper exited {rc} (neither 0, 1, nor 2) -- treated as inconclusive, not a QA fail"
        except subprocess.TimeoutExpired:
            verdict = "error"
            evidence = (f"codex_qa wrapper exceeded {timeout}s supervisory timeout "
                        "(check_cmd level, independent of the wrapper's own internal timeout)")

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
    icon = "PASS" if verdict == "pass" else ("SKIP" if verdict == "skip" else
           ("ERROR" if verdict == "error" else "FAIL"))
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


def _gate_single_phase(contract: dict, args) -> bool:
    """Helper function to gate a single phase.

    On failure, also sets args.gate_codex_qa_failure (bool): True iff at
    least one codex_qa-kind assertion is among the failing assertions for
    this phase (a real cross-model adversarial finding). False for every
    other failure shape, including plain shell/file_exists/etc assertion
    failures (no codex_qa involved at all) and pure codex_qa wrapper/usage
    errors with zero real fail verdicts. Callers that care about
    distinguishing a genuine codex_qa BLOCKED from every other kind of gate
    failure (contract.py gate's specific-phase exit code, currently 1 vs 2)
    read this attribute after the call; callers that don't care simply
    ignore it.
    """
    args.gate_codex_qa_failure = False
    phase_n = args.phase
    run_checks = getattr(args, "run_checks", False)

    # Find assertions for this phase
    phases = contract.get("phases", [])
    phase = next((p for p in phases if _phase_matches(p["id"], phase_n)), None)
    if not phase:
        print(f"ERROR: phase {phase_n} not found in contract", file=sys.stderr)
        return False

    phase_assertions = phase.get("assertions", [])
    allow_skips = getattr(args, "allow_skips", False)
    assertions_by_id = {a["id"]: a for a in contract.get("assertions", [])}

    # --run-checks always re-executes every assertion, never reads stale cache
    if run_checks:
        for aid in phase_assertions:
            check_args = argparse.Namespace(
                contract=args.contract,
                assertion=aid,
                handoff=getattr(args, "handoff", None),
                timeout_seconds=getattr(args, "timeout_seconds", 60),
            )
            try:
                check_cmd(check_args)
            except SystemExit:
                pass

    failing = []
    skipped = []
    errors = []
    pass_count = 0
    skip_count = 0
    fail_count = 0
    error_count = 0
    evidence_by_id = {}

    for aid in phase_assertions:
        rf = result_file(contract, aid)
        if not rf.exists():
            print(f"  WARNING: {aid}: no result file — run check first")
            failing.append(aid)
            fail_count += 1
            continue
        result = json.loads(rf.read_text())
        verdict = result.get("verdict", "fail")
        evidence_by_id[aid] = result.get("evidence", "")
        icon = "PASS" if verdict == "pass" else ("SKIP" if verdict == "skip" else
               ("ERROR" if verdict == "error" else "FAIL"))
        print(f"  {icon} {aid}: {verdict}")
        if verdict == "fail":
            failing.append(aid)
            fail_count += 1
        elif verdict == "skip":
            # required:true is a hard override -- a skip on a required check
            # is treated as a failure regardless of --allow-skips.
            required = bool(assertions_by_id.get(aid, {}).get("required", False))
            if required:
                failing.append(aid)
                fail_count += 1
            else:
                skipped.append(aid)
                skip_count += 1
        elif verdict == "error":
            errors.append(aid)
            error_count += 1
        else:
            pass_count += 1

    print(f"\nPhase {phase_n} summary: {pass_count} pass, {skip_count} skip, "
          f"{fail_count} fail, {error_count} error")

    if failing:
        codex_qa_failing = [
            aid for aid in failing
            if assertions_by_id.get(aid, {}).get("verify", {}).get("kind") == "codex_qa"
        ]
        other_failing = [aid for aid in failing if aid not in codex_qa_failing]
        if codex_qa_failing:
            args.gate_codex_qa_failure = True
            print(f"\nBLOCKED Phase {phase_n} gate BLOCKED -- cross-model QA (GPT-5.5) reported findings.")
            for aid in codex_qa_failing:
                print(f"GPT-5.5 findings ({aid}):")
                print(f"   {evidence_by_id.get(aid, '')}")
        if other_failing:
            print(f"\nFAIL Phase {phase_n} gate FAILED. Failing: {', '.join(other_failing)}")
            print("   Resolve before proceeding to the next phase.")
        if errors:
            for aid in errors:
                print(f"\nGATE ERROR Phase {phase_n}: codex_qa wrapper did not produce a verdict for {aid}")
                print(f"   (QA inconclusive -- not a QA failure). {evidence_by_id.get(aid, '')}")
                print("   Fix: ensure the `codex` binary is on PATH and target/prompt is valid.")
                print("   See docs/codex_qa.md.")
        return False
    elif errors:
        for aid in errors:
            print(f"\nGATE ERROR Phase {phase_n}: codex_qa wrapper did not produce a verdict for {aid}")
            print(f"   (QA inconclusive -- not a QA failure). {evidence_by_id.get(aid, '')}")
            print("   Fix: ensure the `codex` binary is on PATH and target/prompt is valid.")
            print("   See docs/codex_qa.md.")
        return False
    elif skipped and not allow_skips:
        print(f"\nFAIL Phase {phase_n} gate FAILED. Skipped (use --allow-skips to permit): {', '.join(skipped)}")
        print("   Resolve before proceeding to the next phase.")
        return False
    elif skipped:
        print(f"\nPASS Phase {phase_n} gate PASSED (skips allowed). Proceed to next phase.")
        return True
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
        if not phases_data:
            print("No phases found in contract to gate.")
            sys.exit(0)

        for phase_def in phases_data:
            phase_id = phase_def['id']
            print(f"\n--- Gating Phase {phase_id} ---")
            # Create a temporary args object for _gate_single_phase
            single_phase_args = argparse.Namespace(
                contract=args.contract,
                phase=str(phase_id),
                run_checks=getattr(args, "run_checks", False),
                handoff=getattr(args, "handoff", None),
                allow_skips=getattr(args, "allow_skips", False),
                timeout_seconds=getattr(args, "timeout_seconds", 60),
            )
            if not _gate_single_phase(contract, single_phase_args):
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
            # Exit code contract for the specific-phase gate path:
            #   1 = reserved specifically for "a real codex_qa adversarial
            #       finding is among the failing assertions for this phase"
            #       (args.gate_codex_qa_failure is True). This is the ONLY
            #       case that exits 1.
            #   2 = every other failure shape: plain shell/file_exists/etc
            #       assertion failures with no codex_qa involved at all (the
            #       pre-existing, widely-relied-on contract for every
            #       non-codex_qa mission), a pure codex_qa wrapper/usage
            #       error with zero real fail verdicts, or unresolved skips.
            # A caller checking the exit code must never mistake a wrapper
            # crash or a plain assertion failure for an adversarial finding,
            # or vice versa (see F2's BLOCKED-vs-GATE-ERROR verdict split).
            sys.exit(1 if getattr(args, "gate_codex_qa_failure", False) else 2)
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
        icon = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP", "error": "ERR",
                "pending": "PEND"}.get(verdict, "?")
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
    g.add_argument("--allow-skips", action="store_true", default=False,
                   help="Do not fail the gate when a non-required assertion is verdict=skip (default: off)")
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
