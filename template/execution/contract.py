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
import difflib
import json
import os
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "checks"))

RESULTS_DIR = Path(".agent/memory/scratch/contract-results")
MAX_TIMEOUT_SECONDS = 86400  # 24h ceiling -- generous for CI, still finite

# Top-level keys seen across the live 331-contract corpus (schema, goal-style
# prose fields, retirement metadata, etc). An unrecognized top-level key is
# very often an agent guessing a plausible-but-wrong field name (Omarchy
# failure 1) rather than a deliberate new field -- validate_cmd flags it and
# suggests the closest known key instead of silently ignoring it.
KNOWN_TOP_LEVEL_KEYS = {
    "acceptance", "amendment_2026_08_16", "amendment_2026_08_16b", "anti_patterns",
    "architect", "assertions", "autonomy", "classifications", "cleanup", "constraints",
    "contract_ref", "coverage", "created_at", "description", "exclusions", "exit_codes",
    "expected_failures", "feature", "features", "files", "files_changed", "gate_command",
    "gate_policy", "goal", "goldens", "id", "implementation_notes", "issue", "layer",
    "mechanism", "mission", "mission_id", "notes", "pass_criteria", "phase1_scope",
    "phase3_traps", "phase4_gate", "phase_count", "phases", "preconditions",
    "premise_correction", "risks", "retired_reason", "schema", "scope", "side_effects",
    "slug", "spec", "status", "success_criteria", "summary", "title", "traps", "updated_at",
}


def _line_tracking_load(text):
    """Parse YAML with every mapping carrying its own source line number, so
    validation errors can say WHERE the problem is instead of leaving a
    60-assertion contract to be searched by hand.

    Each dict gains two synthetic keys: '__line__' (1-based line of the
    mapping's first key) and '__keylines__' (dict of key -> 1-based line for
    that mapping's own direct keys, not recursive). Both are stripped by
    callers that don't want them; normalize_contract's dict.get() calls
    simply ignore them.
    """
    import yaml

    class _LineLoader(yaml.SafeLoader):
        pass

    def _construct(loader, node, deep=False):
        mapping = {}
        keylines = {}
        for key_node, value_node in node.value:
            key = loader.construct_object(key_node, deep=deep)
            value = loader.construct_object(value_node, deep=deep)
            mapping[key] = value
            try:
                keylines[key] = key_node.start_mark.line + 1
            except Exception:
                pass
        mapping["__line__"] = node.start_mark.line + 1
        mapping["__keylines__"] = keylines
        return mapping

    _LineLoader.add_constructor(
        yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _construct
    )
    return yaml.load(text, Loader=_LineLoader)


def _raw_checks(raw):
    """Return the raw (pre-normalize) list of check dicts from either the
    @architect `assertions: {phase, checks: [...]}` shape or a plain
    `assertions: [...]` list, whichever the file actually uses."""
    assertions_raw = (raw or {}).get("assertions")
    if isinstance(assertions_raw, dict):
        return assertions_raw.get("checks", []) or []
    if isinstance(assertions_raw, list):
        return assertions_raw
    return []


def load_contract(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        print(f"ERROR: contract file not found: {path}", file=sys.stderr)
        sys.exit(1)
    try:
        # Try YAML first, fall back to JSON
        try:
            import yaml
            try:
                with open(p) as f:
                    contract = yaml.safe_load(f)
            except yaml.YAMLError as e:
                from yaml_safe import diagnose_scalar_break
                msg = f"ERROR: failed to parse {path}: {e}"
                hint = diagnose_scalar_break(p.read_text(), e)
                if hint:
                    msg += f"\n  hint: {hint}"
                print(msg, file=sys.stderr)
                sys.exit(1)
        except ImportError:
            with open(p) as f:
                contract = json.load(f)
    except Exception as e:
        print(f"ERROR: failed to parse {path}: {e}", file=sys.stderr)
        sys.exit(1)
    try:
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


def _clamped_mtime(path: str) -> float | None:
    """Return path's mtime clamped to now() (guards against a future-dated
    file from clock skew, a bad `touch`, or a restored artifact that kept a
    future mtime), or None if the file can't be stat'd."""
    try:
        m = os.stat(path).st_mtime
    except OSError:
        return None
    now = datetime.now(timezone.utc).timestamp()
    return min(m, now)


def _candidate_paths_from_shell_cmd(cmd: str) -> list[str]:
    """Extract plausible file-path tokens from a shell command string: tokens
    containing '/' or ending in a file extension, excluding flag-like tokens
    (leading '-'). Only tokens that resolve to an existing file are kept by
    the caller."""
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        return []
    candidates = []
    for tok in tokens:
        if tok.startswith("-"):
            continue
        has_slash = "/" in tok
        has_ext = bool(re.search(r"\.[A-Za-z0-9]{1,8}$", tok))
        if has_slash or has_ext:
            candidates.append(tok)
    return candidates


def _assertion_dependency_mtime(assertion: dict, handoff: str | None = None) -> tuple[float | None, str | None]:
    """Return (mtime, path) of the newest file referenced by this
    assertion's verify block, scoped to only what the assertion actually
    depends on -- never a repo-wide scan (GH #1327 QA round-1 false-positive
    finding: this harness has 80+ concurrent agents writing to
    .agent/memory/scratch/, backlog.md, active.json, etc., none of which a
    given assertion's command references).

    Returns (None, None) when no candidate dependency path can be
    identified, in which case the caller trusts the cache exactly as before
    -- no regression for that assertion.
    """
    verify = assertion.get("verify", {})
    kind = verify.get("kind", "")

    candidates: list[str] = []
    dir_candidates: list[str] = []
    if kind == "shell":
        for p in _candidate_paths_from_shell_cmd(verify.get("cmd", "")):
            if os.path.isfile(p):
                candidates.append(p)
            elif os.path.isdir(p):
                dir_candidates.append(p)
    elif kind in ("file_exists", "file_contains", "json_path"):
        path = verify.get("path", "")
        if path and os.path.isfile(path):
            candidates = [path]
    elif kind == "codex_qa":
        target = verify.get("target", "")
        if target and "://" not in target and os.path.isfile(target):
            candidates = [target]
    elif kind == "handoff_field":
        if handoff and os.path.isfile(handoff):
            candidates = [handoff]

    best_mtime = None
    best_path = None
    for p in candidates:
        m = _clamped_mtime(p)
        if m is None:
            continue
        if best_mtime is None or m > best_mtime:
            best_mtime = m
            best_path = p

    # Directory-only path tokens (e.g. `pytest tests/ -q`, `grep -rlq ... dir/`)
    # are not dropped: walk the single referenced directory (scoped to that
    # one candidate, never a repo-wide scan) and fold its newest file's
    # clamped mtime into the comparison.
    for d in dir_candidates:
        for root, _dirs, files in os.walk(d):
            for fname in files:
                fpath = os.path.join(root, fname)
                m = _clamped_mtime(fpath)
                if m is None:
                    continue
                if best_mtime is None or m > best_mtime:
                    best_mtime = m
                    best_path = fpath
    return best_mtime, best_path


def _multiline_python3_c_violation(cmd: str) -> bool:
    """True iff cmd invokes python3/python with -c and the -c argument's own
    value contains an actual raw newline (chr(10)). Only the -c argument
    itself is checked -- not the whole command string -- so a literal
    backslash-n substring (e.g. inside a regex r'\\n' or string 'a\\nb') does
    not false-positive; that is normal single-line python source, not
    evidence of a multiline script."""
    if "python3" not in cmd and "python" not in cmd:
        return False
    try:
        tokens = shlex.split(cmd)
    except ValueError:
        return False
    for i, tok in enumerate(tokens):
        if tok == "-c" and i > 0 and i + 1 < len(tokens) and tokens[i - 1].split("/")[-1] in ("python3", "python"):
            return "\n" in tokens[i + 1]
    return False


def _attributed_and_chain_script(cmd: str) -> str:
    """Rewrite a top-level `A && B && C` command so that on failure, the
    captured evidence names exactly which conjunct failed (Omarchy failure
    6) -- without changing behaviour for a chain that fully succeeds, and
    without touching a command that has no top-level `&&` at all.

    Behaviourally equivalent to running `cmd` verbatim: the rewritten script
    still stops at the first conjunct whose exit code is non-zero and exits
    with that same code; if every conjunct succeeds it exits 0, exactly what
    a real `&&` chain that reaches its end does.
    """
    try:
        import assertion_lint
        parts = [t for t, _ in assertion_lint._split_top_level(cmd, {"&&"})]
    except Exception:
        return cmd
    if len(parts) <= 1:
        return cmd
    lines = []
    for part in parts:
        lines.append(part)
        lines.append("_ARLINT_RC=$?")
        lines.append(
            f'if [ "$_ARLINT_RC" -ne 0 ]; then printf "FAILED CONJUNCT: %s\\n" '
            f"{shlex.quote(part)} >&2; exit $_ARLINT_RC; fi"
        )
    lines.append("exit 0")
    return "\n".join(lines) + "\n"


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

    # Second, line-tracking parse of the same file purely for diagnostics --
    # never used for the actual schema decisions above, only to attach a
    # line number and to inspect fields normalize_contract already discarded
    # or coerced (e.g. a non-numeric phase, a `verify: {cmd: ...}` typo).
    raw_text = Path(args.contract).read_text()
    try:
        raw = _line_tracking_load(raw_text)
    except Exception:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    root_line = raw.get("__line__", 1)
    root_keylines = raw.get("__keylines__", {})

    def err(msg, line=None):
        errors.append(f"{msg} (line {line if line is not None else root_line})")

    # Unknown top-level keys -- Omarchy failure 1. An agent guessing a
    # plausible-but-wrong field name (`contract_slug` for `slug`) previously
    # got only "Missing required field", never told what it actually wrote.
    for key in raw:
        if key in ("__line__", "__keylines__") or key in KNOWN_TOP_LEVEL_KEYS:
            continue
        suggestion = difflib.get_close_matches(key, KNOWN_TOP_LEVEL_KEYS, n=1, cutoff=0.4)
        line = root_keylines.get(key, root_line)
        if suggestion:
            err(f"Unknown top-level key {key!r} -- did you mean {suggestion[0]!r}?", line)
        else:
            err(f"Unknown top-level key {key!r}", line)

    # Required fields
    for field in ["schema", "created_at", "assertions"]:
        if field not in contract:
            err(f"Missing required field: {field}")
    if "spec" not in contract and "slug" not in contract:
        err("Missing required field: spec or slug")

    if contract.get("schema") != "athanor.contract/v1":
        err(f"Unknown schema: {contract.get('schema')}")

    assertions = contract.get("assertions", [])
    if len(assertions) == 0:
        err("assertions list is empty -- a contract must declare at least one assertion")

    # Raw (pre-normalize) checks, for line numbers, duplicate-id locations
    # and the un-coerced `phase:`/`verify:` field values normalize_contract
    # already massaged away.
    raw_checks = _raw_checks(raw)
    lines_by_id = {}       # id -> list of every line it was declared on
    raw_check_by_line = {}  # line -> raw check dict, for phase/verify lookups
    for rc in raw_checks:
        if not isinstance(rc, dict):
            continue
        rc_id = rc.get("id", "")
        rc_line = rc.get("__line__", root_line)
        lines_by_id.setdefault(rc_id, []).append(rc_line)
        raw_check_by_line[rc_line] = rc

    for rc_id, locs in lines_by_id.items():
        if len(locs) > 1:
            where = ", ".join(f"line {ln}" for ln in locs)
            err(f"Duplicate assertion ID: {rc_id} ({where})", locs[0])

    ids = set()
    binary_kinds = {"shell", "file_exists", "file_contains", "json_path", "handoff_field", "codex_qa"}
    binary_count = 0
    assertion_lint = None
    try:
        import assertion_lint as _al
        assertion_lint = _al
    except Exception:
        pass

    for i, a in enumerate(assertions):
        aid = a.get("id", "")
        # Best-effort: match this normalized assertion back to its raw check
        # by id (falls back to positional index when ids repeat/are absent).
        occ = lines_by_id.get(aid, [])
        ln = occ[0] if occ else root_line
        raw_check = raw_check_by_line.get(ln, {})

        if not re.match(r"^[A-Za-z0-9][A-Za-z0-9_-]*$", aid):
            err(f"Invalid assertion ID: {aid}", ln)
        ids.add(aid)
        if not a.get("description", ""):
            err(f"Assertion {aid} missing description", ln)
        if "verify" not in a:
            err(f"Assertion {aid} missing verify block", ln)
        elif a["verify"].get("kind") in binary_kinds:
            binary_count += 1

        verify = a.get("verify", {})
        ts = verify.get("timeout_seconds")
        if ts is not None:
            ts_error = _timeout_seconds_error(ts)
            if ts_error:
                err(f"Assertion {aid}: timeout_seconds {ts_error}", ln)

        # Omarchy failure 2, and the sharpest of the six: `verify: {cmd: ...}`
        # under `checks:` normalizes to an EMPTY command. An empty command is
        # a bash script that exits 0 -- the gate would record a pass for an
        # assertion that runs nothing.
        cmd = verify.get("cmd", "")
        if verify.get("kind") == "shell" and not cmd.strip() and isinstance(raw_check.get("verify"), dict):
            err(f"Assertion {aid}: resolved command is empty -- this check used "
                f"`verify:` (with a nested `cmd:`) instead of the top-level "
                f"`command:` key checks: expects; an empty command always exits 0 "
                f"and would always record a pass", ln)

        # Omarchy failure 3. `phase: "4"` on an individual check survives
        # today only because normalize_contract happens to int() it; a
        # non-numeric value like `phase: four` silently produces a phase no
        # `--phase N` can ever select.
        if "phase" in raw_check:
            raw_phase = raw_check.get("phase")
            try:
                int(raw_phase)
            except (TypeError, ValueError):
                err(f"Assertion {aid}: phase must be an int, got "
                    f"{type(raw_phase).__name__} {raw_phase!r}", ln)

        # Detect prohibited multiline python3 -c pattern. This prohibition is
        # correct -- nesting python source inside a YAML scalar inside a
        # shell -c string is where quoting breaks -- but must name the
        # SUPPORTED alternative (a heredoc), not advise a single-line
        # grep/test the affected contracts cannot use.
        if _multiline_python3_c_violation(cmd):
            err(
                f"Assertion {aid}: multiline 'python3 -c' is prohibited -- "
                "use a heredoc instead, which validates and executes correctly: "
                "command: |\\n  python3 - <<'PY'\\n  ...python source...\\n  PY "
                "(see docs/harness/assertion-shape.md)",
                ln,
            )

        # Two lint rules, both about a verdict that does not actually depend
        # on what the assertion claims to test (delivery-integrity M2).
        if assertion_lint is not None and verify.get("kind") == "shell" and cmd.strip():
            for finding in assertion_lint.lint_command(cmd):
                err(f"Assertion {aid}: {finding['rule']} -- {finding['message']}", ln)

    strict = getattr(args, "strict", False)
    if strict and binary_count == 0 and len(assertions) > 0:
        err("No binary assertions (shell/file_exists/file_contains/json_path/handoff_field). "
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

        # Defence in depth on the F8 "empty command" defect: `verify:
        # {cmd: ...}` under `checks:` normalizes to an empty command, and an
        # empty bash script always exits 0. validate_cmd rejects this at
        # authoring time, but check_cmd must never record a pass for it
        # either, in case a contract reaches `check` without having been
        # validated first.
        if not cmd.strip():
            evidence = ("empty command -- this assertion runs nothing; an empty "
                        "bash script always exits 0, refusing to record a pass")
            write_result(contract, assertion_id, "fail", evidence)
            print(f"FAIL {assertion_id} ({kind}): FAIL")
            print(f"   {evidence[:200]}")
            sys.exit(1)

        # F5/F6: refuse to run (and never record a verdict for) an assertion
        # whose command shape cannot report a real failure -- validate alone
        # is not enough, because check/gate --run-checks never calls it.
        try:
            import assertion_lint
            lint_findings = assertion_lint.lint_command(cmd)
        except Exception:
            lint_findings = []
        if lint_findings:
            evidence = ("assertion_lint rejected this command: " + "; ".join(
                f"{f['rule']}: {f['message']}" for f in lint_findings))[:500]
            write_result(contract, assertion_id, "fail", evidence)
            print(f"FAIL {assertion_id} ({kind}): FAIL")
            print(f"   {evidence[:200]}")
            sys.exit(1)

        tf_name = None
        try:
            import tempfile
            # Always execute via a temp bash script (no shell=True, no branching on
            # command content). Writes cmd verbatim -- no mutation of any kind --
            # so literal "\n" sequences inside quoted arguments are never rewritten.
            # The one exception is a top-level `&&` chain, which is rewritten to
            # attribute a failure to its specific conjunct (see
            # _attributed_and_chain_script) while remaining behaviourally
            # identical to running cmd verbatim.
            with tempfile.NamedTemporaryFile(mode="w", suffix=".sh", delete=False) as tf:
                tf.write("#!/usr/bin/env bash\n" + _attributed_and_chain_script(cmd))
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


def _phase_sort_key(pid):
    """Sort key for phase ids that tolerates a mix of int and str types.

    Int-valued ids (or ints-in-string-form) sort first, in numeric order;
    any id that can't be parsed as an int sorts after, alphabetically. This
    lets `gate --phase all`/`max` order phases without ever raising
    TypeError on a contract that mixes int and str phase ids.
    """
    try:
        return (0, int(pid))
    except (TypeError, ValueError):
        return (1, str(pid))


def _phase_matches(phase_id, target_str: str) -> bool:
    if str(phase_id) == target_str:
        return True
    try:
        return int(phase_id) == int(target_str)
    except (ValueError, TypeError):
        return False


# --- structured gate report (athanor.gate-report/v1) -------------------------
# Opt-in via `gate --report-json PATH`. Nothing on stdout/stderr changes; when
# the flag is absent nothing here is written and every existing caller behaves
# byte-for-byte identically.
#
# Why this channel exists: `check_cmd` echoes up to 200 chars of every
# assertion's OWN stdout back as "evidence", both before the authoritative
# "Phase N summary:" line and (via _print_gate_errors) after it. Any tool that
# classifies a gate by searching that text is reading arbitrary, user-authored
# check output. This report is written by contract.py alone -- no check output
# can reach it -- which makes it collision-proof rather than merely harder to
# collide with. See the repo-wide-gate-sweep spec's goldens/DECISIONS.md.
GATE_REPORT_SCHEMA = "athanor.gate-report/v1"

# Worst-first, so a multi-phase run's `overall` is the most severe phase status.
_GATE_STATUS_SEVERITY = ("INVALID", "ERROR", "BLOCKED", "FAIL", "PASS")

# Populated by _record_phase_result(); drained by gate_cmd's report write.
_GATE_PHASE_RECORDS = []


def _record_phase_result(phase_n, *, status=None, reason=None, pass_count=0,
                         skip_count=0, fail_count=0, error_count=0,
                         failing=(), skipped=(), errors=(), allow_skips=False,
                         assertions_by_id=None):
    """Record one phase's verdict for the optional --report-json output.

    `status`, when not given explicitly, is derived from exactly the same
    locals _gate_single_phase's own print/return branches use, in the same
    order -- never re-derived from anything printed.
    """
    if status is None:
        if failing:
            codex_qa_failing = [
                aid for aid in failing
                if (assertions_by_id or {}).get(aid, {}).get("verify", {}).get("kind") == "codex_qa"
            ]
            status = "BLOCKED" if codex_qa_failing else "FAIL"
        elif errors:
            status = "ERROR"
        elif skipped and not allow_skips:
            status = "FAIL"
            reason = reason or "unresolved_skips"
        else:
            status = "PASS"
    _GATE_PHASE_RECORDS.append({
        "phase": str(phase_n),
        "status": status,
        "pass": pass_count,
        "skip": skip_count,
        "fail": fail_count,
        "error": error_count,
        "failing": list(failing),
        "errors": list(errors),
        "skipped": list(skipped),
        "allow_skips": bool(allow_skips),
        "reason": reason,
    })


def _write_gate_report(args):
    """Write the structured verdict when --report-json or --report-fd was given.

    Written with os.replace so a concurrent reader (e.g. gate_sweep.py under
    --jobs N) never observes a partial file. If no phase was ever recorded --
    the contract did not parse, `validate` refused it, or a check crashed the
    gate process outright -- NOTHING is written at all, so a consumer's
    fail-closed rule ("no report means the gate never ran") holds.

    `--report-fd N` (F5 round 5, additive) writes the same bytes to an already
    open descriptor the caller owns instead of to a path. A path is a name in a
    namespace, and when the caller confines this process together with the
    checks it runs, every grant that lets this function write the report also
    lets a check overwrite it -- so a caller that must not be lied to hands over
    a DESCRIPTOR, which the checks can neither name nor inherit. No tmp+replace
    on that branch: nothing else holds the descriptor, and the caller reads it
    only after this process has exited. `--report-json` is untouched.
    """
    fd = getattr(args, "report_fd", None)
    dest = getattr(args, "report_json", None)
    if not _GATE_PHASE_RECORDS or (fd is None and not dest):
        return
    overall = "PASS"
    for status in _GATE_STATUS_SEVERITY:
        if any(rec["status"] == status for rec in _GATE_PHASE_RECORDS):
            overall = status
            break
    payload = {
        "schema": GATE_REPORT_SCHEMA,
        "contract": str(args.contract),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "phases": list(_GATE_PHASE_RECORDS),
        "overall": overall,
    }
    blob = json.dumps(payload, indent=2) + "\n"
    if fd is not None:
        data = blob.encode("utf-8")
        while data:
            data = data[os.write(fd, data):]
        return
    dest = Path(dest)
    if dest.parent and str(dest.parent):
        dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + f".tmp.{os.getpid()}")
    tmp.write_text(blob)
    os.replace(tmp, dest)


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
        _record_phase_result(phase_n, status="INVALID", reason="phase_not_found")
        return False

    phase_assertions = phase.get("assertions", [])
    if not phase_assertions:
        print(f"ERROR: phase {phase_n} has zero assertions -- nothing to gate", file=sys.stderr)
        _record_phase_result(phase_n, status="INVALID", reason="zero_assertions")
        return False
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

    # Cache-staleness check (GH #1327): --run-checks already re-runs every
    # assertion live above, so this only applies to the default cache-read
    # path. Scoped per-assertion to the files that assertion's own verify
    # block actually references -- never a repo-wide scan, which false-
    # positived on unrelated concurrent harness activity (QA round-1
    # finding: backlog.md, active.json, scratch notes from other agents).
    for aid in phase_assertions:
        rf = result_file(contract, aid)
        if not rf.exists():
            print(f"  WARNING: {aid}: no result file — run check first")
            failing.append(aid)
            fail_count += 1
            continue
        result = json.loads(rf.read_text())

        if not run_checks:
            dep_mtime, dep_path = _assertion_dependency_mtime(
                assertions_by_id.get(aid, {}), handoff=getattr(args, "handoff", None)
            )
            try:
                cached_ts = datetime.fromisoformat(result.get("ts", "")).timestamp()
            except (ValueError, TypeError):
                cached_ts = None
            if dep_mtime is not None and cached_ts is not None and dep_mtime > cached_ts:
                print(f"\n!!! STALE CACHE -- repo changed since {aid} was last verified "
                      f"({dep_path} modified after the cached result) -- "
                      f"re-verifying live now (re-running check, not trusting the stale result) !!!")
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

    _record_phase_result(
        phase_n, pass_count=pass_count, skip_count=skip_count,
        fail_count=fail_count, error_count=error_count,
        failing=failing, skipped=skipped, errors=errors,
        allow_skips=allow_skips, assertions_by_id=assertions_by_id,
    )

    def _print_gate_errors():
        for aid in errors:
            print(f"\nGATE ERROR Phase {phase_n}: codex_qa wrapper did not produce a verdict for {aid}")
            print(f"   (QA inconclusive -- not a QA failure). {evidence_by_id.get(aid, '')}")
            print("   Fix: ensure the `codex` binary is on PATH and target/prompt is valid.")
            print("   See docs/codex_qa.md.")

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
            _print_gate_errors()
        return False
    elif errors:
        _print_gate_errors()
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
    # One report channel or the other, never both: a caller that asked for the
    # unforgeable descriptor channel must not silently also get the path one.
    if getattr(args, "report_fd", None) is not None and getattr(args, "report_json", None):
        print("ERROR: --report-fd and --report-json are mutually exclusive.",
              file=sys.stderr)
        sys.exit(2)

    contract = load_contract(args.contract)

    # F7: gate eligibility. A contract that fails `contract.py validate`
    # must never be able to gate green -- today neither `gate` nor `check`
    # calls validate at all, so an invalid contract (missing schema, a check
    # with no verify block, ...) can still produce a green gate.
    _validate_proc = subprocess.run(
        [sys.executable, str(Path(__file__).resolve()), "validate", args.contract],
        capture_output=True, text=True, timeout=120,
    )
    if _validate_proc.returncode != 0:
        print("ERROR: gate refuses to run -- this contract is not valid "
              "(contract.py validate failed):", file=sys.stderr)
        print((_validate_proc.stdout + _validate_proc.stderr).strip(), file=sys.stderr)
        sys.exit(1)

    # Pre-flight: reject prohibited multiline python3 -c assertions before running
    for _a in contract.get("assertions", []):
        _cmd = _a.get("verify", {}).get("cmd", "")
        if _multiline_python3_c_violation(_cmd):
            print(f"ERROR: Assertion {_a['id']}: multiline 'python3 -c' is prohibited -- "
                  f"use a heredoc instead: command: |\\n  python3 - <<'PY'\\n  ...\\n  PY "
                  f"(see docs/harness/assertion-shape.md)", file=sys.stderr)
            sys.exit(1)

    # --report-json (opt-in) is written here so it is produced on every exit
    # path below -- sys.exit raises SystemExit, which `finally` still runs.
    try:
        if args.phase == "all":
            phases_data = sorted(contract.get("phases", []), key=lambda p: _phase_sort_key(p.get("id", 0)))
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
            phase_n = sorted(phases, key=lambda p: _phase_sort_key(p["id"]))[-1]["id"] if phases else 1
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
    finally:
        # The --report-json write is OPTIONAL and must never be able to change
        # the gate's own verdict. Unguarded, any exception raised here (an
        # unwritable destination, a read-only or full TMPDIR, ENOSPC, a
        # serialisation error) propagates out of this `finally` and REPLACES the
        # in-flight SystemExit -- rewriting e.g. a real FAIL's exit 2 into exit
        # 1, which :1186-1198 reserves exclusively for a codex_qa adversarial
        # finding. A report that cannot be written degrades to the consumer's
        # fail-closed no-file case (see _write_gate_report's docstring); it does
        # not mutate the verdict. Exception, not BaseException: a genuine
        # KeyboardInterrupt/SystemExit here is the operator's, and must still
        # propagate. The inner guard covers a closed stderr (`2>&-`), where the
        # warning itself would otherwise raise and re-corrupt the exit path.
        try:
            _write_gate_report(args)
        except Exception as exc:
            try:
                print(f"WARNING: could not write --report-json to "
                      f"{getattr(args, 'report_json', None)!r}: "
                      f"{type(exc).__name__}: {exc}", file=sys.stderr)
            except Exception:
                pass




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
    _boot_check = Path(__file__).parent / "checks" / "verify_boot_ran.py"
    subprocess.run([sys.executable, str(_boot_check)], check=False)

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
    g.add_argument("--report-json", default=None, metavar="PATH",
                   help="Also write the structured athanor.gate-report/v1 verdict to PATH "
                        "(opt-in; stdout/stderr are unchanged). No file is written if the "
                        "gate never ran, so consumers can fail closed on its absence.")
    g.add_argument("--report-fd", type=int, default=None, metavar="N",
                   help="Write the structured athanor.gate-report/v1 verdict to already "
                        "open descriptor N instead of to a path (mutually exclusive with "
                        "--report-json). For a caller that confines this process alongside "
                        "the checks it runs: a descriptor is authority the checks can "
                        "neither name nor inherit, whereas any path this process may write "
                        "a check's descendant may overwrite. Nothing is written if the "
                        "gate never ran, so consumers can fail closed on an empty channel.")

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
