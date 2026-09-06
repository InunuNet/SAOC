#!/usr/bin/env python3
"""Fleet acceptance test — the executable definition of "Athanor is done".

Scaffolds a throwaway workspace under .tmp/sandbox/fleet-acceptance/ from the
LOCAL tree (never origin/main) and proves a downstream project can actually
boot on this harness: scaffold, onboard, boot to verdict ok, run a mission
through a green gate, wrap up and survive, and re-scaffold without eating
anything. One command, one final verdict line, exit 0 iff all six steps pass.

This instrument fixes nothing it measures. A RED run names the failing step
and the command that failed; it is not this script's job to repair either.
See .agent/memory/project/specs/fleet-acceptance/contract.yaml.

Usage:
    python3 execution/fleet_acceptance.py              # quiet, cleans up
    python3 execution/fleet_acceptance.py --verbose     # streams subprocess output
    python3 execution/fleet_acceptance.py --keep        # leaves the sandbox for inspection
"""
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HARNESS_ROOT = Path(__file__).resolve().parent.parent
SANDBOX_ROOT = HARNESS_ROOT / ".tmp" / "sandbox" / "fleet-acceptance"
WS_NAME = "FleetAcceptanceWS"
WS = SANDBOX_ROOT / WS_NAME

# Hard ceiling (fleet-acceptance contract R5: "Runtime under 5 minutes with an
# explicit timeout on every subprocess"). Checked between steps so a step that
# cannot start within budget SKIPs with a named reason rather than starting
# and then being killed mid-way.
TOTAL_TIMEOUT_SECONDS = 300

STEP_NAMES = {
    1: "scaffold",
    2: "onboard",
    3: "boot",
    4: "mission",
    5: "wrap",
    6: "idempotence",
}

TRIVIAL_CONTRACT_YAML = """\
schema: athanor.contract/v1
slug: fleet-acceptance-trivial
created_at: '2026-09-06T00:00:00+00:00'
goal: >-
  A deliberately trivial contract, attached only so the fleet acceptance
  mission gate has a real contract.py gate to run rather than a status-only
  verdict. It proves nothing about the harness by itself.
success_criteria:
  - id: R1
    text: The always-true sanity check passes.
    status: pending
assertions:
  phase: 4
  checks:
    - id: A1
      description: Always-true sanity check.
      command: "true"
"""


def _safe_rmtree(path: Path):
    """Delete `path`, refusing anything outside SANDBOX_ROOT (sandbox.md guard)."""
    resolved = path.resolve()
    root = SANDBOX_ROOT.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError(f"refusing to delete outside the sandbox root: {resolved}")
    if resolved.exists():
        shutil.rmtree(resolved)


class _TimedOut:
    """subprocess.run()-shaped stand-in for a step that hit its own timeout."""

    def __init__(self, cmd, timeout, exc):
        self.returncode = 124
        stdout = exc.stdout
        stderr = exc.stderr
        stdout = stdout.decode(errors="replace") if isinstance(stdout, bytes) else (stdout or "")
        stderr = stderr.decode(errors="replace") if isinstance(stderr, bytes) else (stderr or "")
        self.stdout = stdout
        self.stderr = stderr + f"\n[TIMEOUT after {timeout}s waiting for: {' '.join(cmd)}]"


def run(cmd, cwd, timeout, verbose):
    if verbose:
        print(f"    $ {' '.join(cmd)}  (cwd={cwd})", file=sys.stderr)
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        return _TimedOut(cmd, timeout, exc)
    if verbose:
        if proc.stdout:
            sys.stderr.write(proc.stdout)
        if proc.stderr:
            sys.stderr.write(proc.stderr)
    return proc


def trim(text, max_lines=40):
    lines = list((text or "").strip().splitlines())
    if len(lines) > max_lines:
        omitted = len(lines) - max_lines
        lines = lines[:max_lines] + [f"... [{omitted} more line(s) trimmed]"]
    return "\n".join(lines)


def fail_reason(cmd, proc):
    detail = trim((proc.stdout or "") + "\n" + (proc.stderr or ""))
    return f"`{' '.join(cmd)}` exit={proc.returncode}\n{detail}"


# ── Step 1: scaffold ─────────────────────────────────────────────────────────

def step_scaffold(verbose):
    SANDBOX_ROOT.mkdir(parents=True, exist_ok=True)
    cmd = [
        "bash", str(HARNESS_ROOT / "init.sh"),
        "--path", str(WS), "--name", WS_NAME, "--no-pulse",
    ]
    proc = run(cmd, HARNESS_ROOT, 90, verbose)
    if proc.returncode != 0:
        return "FAIL", fail_reason(cmd, proc)
    profile_path = WS / ".agent" / "profile.json"
    if not profile_path.exists():
        return "FAIL", f"init.sh exited 0 but {profile_path} was never delivered"
    return "PASS", ""


# ── Step 2: onboard ──────────────────────────────────────────────────────────

def step_onboard(verbose, ctx):
    cmd = [
        sys.executable, "execution/onboard_headless.py",
        "--project-name", WS_NAME,
        "--role", "Fleet Acceptance Test Agent",
        "--mission", "Prove Athanor boots a downstream project end to end",
    ]
    proc = run(cmd, WS, 30, verbose)
    if proc.returncode != 0:
        return "FAIL", fail_reason(cmd, proc)
    profile_path = WS / ".agent" / "profile.json"
    try:
        profile = json.loads(profile_path.read_text())
    except Exception as exc:
        return "FAIL", f"profile.json unreadable after onboarding ({exc!r})"
    if profile.get("onboarding_complete") is not True:
        return "FAIL", (
            f"onboard_headless.py exited 0 but onboarding_complete reads "
            f"{profile.get('onboarding_complete')!r}, not true"
        )
    return "PASS", ""


# ── Step 3: boot ─────────────────────────────────────────────────────────────

def step_boot(verbose, ctx):
    cmd = [sys.executable, "execution/boot_panel.py", "--format", "compact", "--exit-code"]
    proc = run(cmd, WS, 30, verbose)
    if proc.returncode == 0:
        return "PASS", ""
    detail = trim((proc.stdout or "") + "\n" + (proc.stderr or ""))
    return "FAIL", f"boot_panel verdict is not ok (exit={proc.returncode})\n{detail}"


# ── Step 4: mission ───────────────────────────────────────────────────────────

def _split_frontmatter(text):
    """Same boundary rule as mission.py's parse_mission_file: exact, column-0
    '---' lines, never a raw substring split (a quoted scalar could contain
    '---')."""
    offsets = []
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.rstrip("\n").rstrip("\r") == "---":
            offsets.append(offset)
            if len(offsets) == 2:
                break
        offset += len(line)
    if len(offsets) < 2:
        raise ValueError("mission file frontmatter is not closed with ---")
    start, end = offsets
    return text[start + 3:end].strip(), text[end + 3:]


def _write_mission_frontmatter(path: Path, fm: dict, body: str):
    import yaml
    content = (
        "---\n" + yaml.dump(fm, default_flow_style=False, sort_keys=False, allow_unicode=True)
        + "---\n" + "\n" + body.lstrip("\n")
    )
    path.write_text(content)


def step_mission(verbose, ctx):
    import yaml

    goal = "Fleet acceptance trivial mission"
    slug = "fleet-trivial"
    cmd = [sys.executable, "execution/mission.py", "new", goal, "--slug", slug]
    proc = run(cmd, WS, 20, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission new failed\n{fail_reason(cmd, proc)}"

    created = None
    for line in proc.stdout.splitlines():
        if line.startswith("Created:"):
            created = line.split("Created:", 1)[1].strip()
            break
    if not created:
        return "FAIL", f"mission new exited 0 but printed no 'Created:' line\n{trim(proc.stdout)}"

    mission_path = Path(created)
    if not mission_path.is_absolute():
        mission_path = WS / created
    if not mission_path.exists():
        return "FAIL", f"mission new reported {created!r} but that file does not exist"

    # mission.py new leaves features/milestones empty by design ("Edit <path>
    # to add features and milestones") — add one trivial feature + milestone
    # directly to the frontmatter, the same edit an operator would make.
    try:
        fm_text, body = _split_frontmatter(mission_path.read_text())
        fm = yaml.safe_load(fm_text)
    except Exception as exc:
        return "FAIL", f"could not parse mission frontmatter: {exc!r}"
    fm["features"] = [{
        "id": "F1",
        "title": "Trivial acceptance feature",
        "status": "pending",
        "inline_brief": "Always-true sanity check for the fleet acceptance gate.",
    }]
    fm["milestones"] = [{"id": "M1", "name": "M1", "features": ["F1"]}]
    try:
        _write_mission_frontmatter(mission_path, fm, body)
    except Exception as exc:
        return "FAIL", f"could not write edited mission frontmatter: {exc!r}"

    cmd = [sys.executable, "execution/mission.py", "validate", created]
    proc = run(cmd, WS, 20, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission validate failed after adding F1/M1\n{fail_reason(cmd, proc)}"

    cmd = [sys.executable, "execution/mission.py", "activate", created]
    proc = run(cmd, WS, 20, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission activate failed\n{fail_reason(cmd, proc)}"

    contract_dir = WS / ".agent" / "memory" / "project" / "specs" / "fleet-acceptance-trivial"
    contract_dir.mkdir(parents=True, exist_ok=True)
    contract_path = contract_dir / "contract.yaml"
    contract_path.write_text(TRIVIAL_CONTRACT_YAML)
    rel_contract = str(contract_path.relative_to(WS))

    cmd = [
        sys.executable, "execution/mission.py", "attach-spec", created,
        "--feature", "F1",
        "--spec", "inline://fleet-acceptance-trivial",
        "--contract", rel_contract,
    ]
    proc = run(cmd, WS, 20, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission attach-spec failed\n{fail_reason(cmd, proc)}"

    cmd = [
        sys.executable, "execution/mission.py", "checkpoint", created,
        "--feature", "F1", "--status", "done",
    ]
    proc = run(cmd, WS, 20, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission checkpoint failed\n{fail_reason(cmd, proc)}"

    cmd = [sys.executable, "execution/mission.py", "gate", created, "--milestone", "M1"]
    proc = run(cmd, WS, 60, verbose)
    if proc.returncode != 0:
        return "FAIL", f"mission gate did not go green\n{fail_reason(cmd, proc)}"
    ctx["mission_rel"] = created
    return "PASS", ""


# ── Step 5: wrap ──────────────────────────────────────────────────────────────

def step_wrap(verbose, ctx):
    summary = "Fleet acceptance instrument: automated wrap-up smoke check."
    cmd = [
        sys.executable, "execution/brain.py", "wrap-up",
        "--summary", summary, "--tags", "fleet-acceptance,smoke",
    ]
    proc = run(cmd, WS, 30, verbose)
    if proc.returncode != 0:
        return "FAIL", f"brain.py wrap-up failed\n{fail_reason(cmd, proc)}"

    cmd2 = [sys.executable, "execution/brain.py", "last-session", "--quiet"]
    proc2 = run(cmd2, WS, 20, verbose)
    if proc2.returncode != 0:
        return "FAIL", f"brain.py last-session failed after wrap-up\n{fail_reason(cmd2, proc2)}"
    if not proc2.stdout.strip():
        return "FAIL", "brain.py last-session --quiet produced no output — session state did not survive wrap-up"
    ctx["brain_summary"] = proc2.stdout.strip()
    return "PASS", ""


# ── Step 6: idempotence ───────────────────────────────────────────────────────

def _file_digest(path: Path):
    if not path.exists() or not path.is_file():
        return None
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _tree_digest(path: Path):
    if not path.exists():
        return None
    h = hashlib.sha256()
    for f in sorted((p for p in path.rglob("*") if p.is_file()), key=lambda p: str(p)):
        rel = str(f.relative_to(path)).encode()
        h.update(rel)
        h.update(b"\0")
        h.update(f.read_bytes())
        h.update(b"\0")
    return h.hexdigest()


SENTINEL_TOKEN = "7f3a91"
SENTINEL_LINE = f"<!-- fleet-acceptance sentinel {SENTINEL_TOKEN} do not remove -->"


def step_idempotence(verbose, ctx):
    # The digest-only version of this step passed vacuously: nothing between
    # scaffold and this step ever edits AGENTS.md/CLAUDE.md, so re-copying
    # identical bytes always matches and the step never exercises the
    # documented defect (2026-09-04 first-boot e2e: init.sh silently ate
    # operator edits to AGENTS.md/CLAUDE.md on a re-run). Plant a distinctive,
    # unmistakably-operator-authored sentinel in each target FIRST, digest
    # AFTER that, then assert the sentinel survives byte-for-byte — never let
    # a defect this step exists to catch pass as an "expected" no-op.
    sentinel_targets = {
        "AGENTS.md": WS / "AGENTS.md",
        "CLAUDE.md": WS / "CLAUDE.md",
    }
    missing_before = [name for name, p in sentinel_targets.items() if not p.exists()]
    if missing_before:
        return "FAIL", f"cannot plant sentinels — missing before this step even starts: {missing_before}"
    for p in sentinel_targets.values():
        with p.open("a") as f:
            f.write("\n" + SENTINEL_LINE + "\n")

    identity_target = None
    for candidate in ("soul.md", "user.md"):
        cand_path = WS / ".agent" / "identity" / candidate
        if cand_path.exists():
            identity_target = cand_path
            break
    identity_note = ""
    if identity_target is not None:
        with identity_target.open("a") as f:
            f.write("\n" + SENTINEL_LINE + "\n")
    else:
        identity_note = ".agent/identity/ has neither soul.md nor user.md — identity sentinel skipped"

    sentinel_memory_file = WS / ".agent" / "memory" / "project" / "sentinel-fleet-acceptance.md"
    sentinel_memory_file.write_text(SENTINEL_LINE + "\n")

    mission_rel = ctx.get("mission_rel")
    mission_path = (WS / mission_rel) if mission_rel else None
    mission_before = mission_path.read_bytes() if mission_path and mission_path.exists() else None

    brain_before = ctx.get("brain_summary")

    targets = {
        "AGENTS.md": lambda: _file_digest(WS / "AGENTS.md"),
        "CLAUDE.md": lambda: _file_digest(WS / "CLAUDE.md"),
        ".agent/memory/": lambda: _tree_digest(WS / ".agent" / "memory"),
        ".agent/identity/": lambda: _tree_digest(WS / ".agent" / "identity"),
    }
    before = {name: fn() for name, fn in targets.items()}

    cmd = ["bash", str(HARNESS_ROOT / "init.sh"), "--path", str(WS), "--no-pulse"]
    proc = run(cmd, HARNESS_ROOT, 90, verbose)

    after = {name: fn() for name, fn in targets.items()}
    changed = [name for name in targets if before[name] != after[name]]

    failures = []
    if identity_note:
        failures.append(identity_note)

    for name, p in sentinel_targets.items():
        text = p.read_text() if p.exists() else ""
        if SENTINEL_LINE not in text:
            failures.append(f"{name} sentinel removed by init.sh re-run — operator edits are not preserved")

    if identity_target is not None:
        text = identity_target.read_text() if identity_target.exists() else ""
        if SENTINEL_LINE not in text:
            rel = identity_target.relative_to(WS)
            failures.append(f"{rel} sentinel removed by init.sh re-run — operator edits are not preserved")

    if not sentinel_memory_file.exists():
        failures.append(f"{sentinel_memory_file.relative_to(WS)} was deleted by init.sh re-run")
    elif sentinel_memory_file.read_text() != SENTINEL_LINE + "\n":
        failures.append(f"{sentinel_memory_file.relative_to(WS)} was altered by init.sh re-run")

    if mission_path is not None:
        if not mission_path.exists():
            failures.append(f"{mission_rel} (mission file written in step 4) was deleted by init.sh re-run")
        elif mission_before is not None and mission_path.read_bytes() != mission_before:
            failures.append(f"{mission_rel} (mission file written in step 4) was altered by init.sh re-run")

    if brain_before:
        cmd_ls = [sys.executable, "execution/brain.py", "last-session", "--quiet"]
        proc_ls = run(cmd_ls, WS, 20, verbose)
        brain_after = proc_ls.stdout.strip() if proc_ls.returncode == 0 else None
        if proc_ls.returncode != 0:
            failures.append(f"brain.py last-session failed after init.sh re-run (exit={proc_ls.returncode})")
        elif brain_after != brain_before:
            failures.append("brain.py last-session output changed after init.sh re-run — step 5's wrap-up memory did not survive")

    if changed:
        detail = "; ".join(f"{name} (before={before[name]!r} after={after[name]!r})" for name in changed)
        failures.append(f"byte-for-byte digest changed for: {detail}")

    if failures:
        rerun_note = f" [init.sh re-run itself also exited {proc.returncode}]" if proc.returncode != 0 else ""
        return "FAIL", "; ".join(failures) + rerun_note
    if proc.returncode != 0:
        return "FAIL", f"init.sh re-run exited {proc.returncode} (all bytes and sentinels were unaffected)\n{fail_reason(cmd, proc)}"
    return "PASS", ""


STEPS = {
    2: step_onboard,
    3: step_boot,
    4: step_mission,
    5: step_wrap,
    6: step_idempotence,
}


def main():
    parser = argparse.ArgumentParser(
        description="Fleet acceptance test — six steps in a throwaway scaffold; "
                    "exit 0 iff all six pass.",
    )
    parser.add_argument("--verbose", action="store_true", help="stream subprocess output")
    parser.add_argument("--keep", action="store_true", help="leave the sandbox workspace for inspection")
    args = parser.parse_args()

    start = time.monotonic()

    def remaining():
        return TOTAL_TIMEOUT_SECONDS - (time.monotonic() - start)

    results = []
    ctx = {}

    def record(num, status, reason=""):
        results.append((num, status))
        tag = f"[{status}] {num} {STEP_NAMES[num]}"
        if reason:
            lines = reason.splitlines()
            print(f"{tag} — {lines[0]}")
            for line in lines[1:]:
                print(f"    {line}")
        else:
            print(tag)

    try:
        _safe_rmtree(WS)
    except Exception as exc:
        print(f"[FAIL] 1 scaffold — could not clear the sandbox before scaffolding: {exc!r}")
        results.append((1, "FAIL"))
        for n in (2, 3, 4, 5, 6):
            record(n, "SKIP", "sandbox could not be cleared before step 1")
        print("FLEET ACCEPTANCE: FAIL (0/6)")
        sys.exit(1)

    try:
        status, reason = step_scaffold(args.verbose)
    except Exception as exc:
        status, reason = "FAIL", f"unhandled exception: {exc!r}"
    record(1, status, reason)

    if status != "PASS":
        for n in (2, 3, 4, 5, 6):
            record(n, "SKIP", "step 1 scaffold did not produce a usable workspace")
    else:
        for n in (2, 3, 4, 5, 6):
            if remaining() <= 0:
                record(n, "SKIP", "global 5-minute runtime ceiling reached before this step could start")
                continue
            try:
                status, reason = STEPS[n](args.verbose, ctx)
            except Exception as exc:
                status, reason = "FAIL", f"unhandled exception: {exc!r}"
            record(n, status, reason)

    if args.keep:
        print(f"--keep: sandbox left at {WS}", file=sys.stderr)
    else:
        try:
            _safe_rmtree(WS)
        except Exception as exc:
            print(f"WARNING: failed to clean up sandbox at {WS}: {exc!r}", file=sys.stderr)

    passed = sum(1 for _, s in results if s == "PASS")
    if passed == 6:
        print("FLEET ACCEPTANCE: PASS")
        sys.exit(0)
    else:
        print(f"FLEET ACCEPTANCE: FAIL ({passed}/6)")
        sys.exit(1)


if __name__ == "__main__":
    main()
