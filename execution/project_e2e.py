#!/usr/bin/env python3
"""Project end-to-end test: deploy a named test project, take it through the real
onboarding interview, boot it, run every ghost project inside it, prove search and
fetch go through Alembic, run a mission gate, and write a findings report.

Scaffolds under .tmp/sandbox/project-e2e/<pid>-<ms>/<name>/ from the LOCAL tree.
Runs on macOS, Linux and Windows (Git Bash + native Python). Exit 0 iff every step
that ran PASSed. See .agent/memory/project/specs/project-e2e/contract-f1.yaml.

Usage:
    python3 execution/project_e2e.py                      # TestAthanor<OS>
    python3 execution/project_e2e.py --name TestAthanorWindows --keep --verbose
    python3 execution/project_e2e.py --only scaffold,onboard,alembic

Needs Alembic up (ALEMBIC_URL, default http://localhost:7077/).
"""
import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
_EXEC_DIR = os.path.dirname(os.path.abspath(__file__))
if _EXEC_DIR not in sys.path:
    sys.path.insert(0, _EXEC_DIR)
from bash_exe import bash_exe  # noqa: E402  Windows: Git Bash, never System32 WSL

HARNESS_ROOT = Path(__file__).resolve().parent.parent
SANDBOX_ROOT = HARNESS_ROOT / ".tmp" / "sandbox" / "project-e2e"
RUN_ID = "%d-%d" % (os.getpid(), int(time.time() * 1000))
RUN_ROOT = SANDBOX_ROOT / RUN_ID

IS_WINDOWS = sys.platform == "win32"
DEFAULT_NAMES = {"darwin": "TestAthanorMac", "win32": "TestAthanorWindows"}
STEP_NAMES = ("scaffold", "onboard", "boot", "ghosts", "alembic", "mission", "report")

SCAFFOLD_TIMEOUT_SECONDS = 240  # Windows init.sh alone takes ~90 s
ONBOARD_TIMEOUT_SECONDS = 120
BOOT_TIMEOUT_SECONDS = 60
GHOST_TIMEOUT_SECONDS = 300
MISSION_TIMEOUT_SECONDS = 60
GIT_TIMEOUT_SECONDS = 15
ALEMBIC_HEALTH_TIMEOUT_SECONDS = 15
ALEMBIC_SEARCH_TIMEOUT_SECONDS = 60
ALEMBIC_FETCH_TIMEOUT_SECONDS = 90
TRIM_LINES = 40
TIMEOUT_RC = 124
ALEMBIC_URL = os.environ.get("ALEMBIC_URL", "http://localhost:7077/").rstrip("/") + "/"

# Ghosts that need what Windows does not give an unprivileged user.
WINDOWS_GHOST_SKIPS = {
    "argus": "os.symlink needs SeCreateSymbolicLinkPrivilege (Developer Mode)",
    "escrow": "reads /proc/self/fd/0, which Windows has no equivalent of",
}
# Native Windows python writes CRLF to pipes; ghosts compare against LF fixtures.
WINDOWS_SHIM = (
    "import sys\n"
    "for _s in (sys.stdout, sys.stderr):\n"
    "    if hasattr(_s, 'reconfigure'):\n"
    "        _s.reconfigure(newline='\\n')\n"
)

ONBOARD_ANSWERS = {
    "role": "End-to-end Test Agent",
    "archetype": "",
    "user_profile": "CONFIRM",
    "comms_contract": "CONFIRM",
    "mission": "Prove Athanor deploys, onboards and runs a project end to end",
    "scale": "",
    "tech_stack": "Python",
    "git": "DECLINE",
}

TRIVIAL_CONTRACT_YAML = """\
schema: athanor.contract/v1
slug: project-e2e-trivial
created_at: '2026-11-07T00:00:00+00:00'
goal: >-
  A deliberately trivial contract so the project e2e mission gate runs a real
  contract.py gate. It proves nothing about the harness by itself.
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


def child_env(extra=None):
    """Every child gets UTF-8 and a silent voice dir; ghosts add the Windows shim."""
    env = dict(os.environ)
    env["PYTHONUTF8"] = "1"
    env["VOICE_HOME"] = str(RUN_ROOT / "voice-off")
    env.update(extra or {})
    return env


def safe_rmtree(path: Path):
    """Delete `path`, refusing anything outside SANDBOX_ROOT (sandbox.md guard)."""
    resolved = path.resolve()
    root = SANDBOX_ROOT.resolve()
    if resolved != root and root not in resolved.parents:
        raise RuntimeError("refusing to delete outside the sandbox root: %s" % resolved)
    if resolved.exists():
        shutil.rmtree(resolved)


class Result:
    """subprocess.CompletedProcess-shaped result, also for a child that timed out."""

    def __init__(self, returncode, stdout, stderr):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value or ""


def run(cmd, cwd, timeout, verbose, extra_env=None):
    if verbose:
        print("    $ %s  (cwd=%s)" % (" ".join(cmd), cwd), file=sys.stderr)
    try:
        proc = subprocess.run(
            cmd, cwd=str(cwd), capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=timeout, env=child_env(extra_env),
        )
    except subprocess.TimeoutExpired as exc:
        return Result(TIMEOUT_RC, _text(exc.stdout),
                      _text(exc.stderr) + "\n[TIMEOUT after %ss: %s]" % (timeout, " ".join(cmd)))
    except OSError as exc:
        return Result(127, "", "cannot run %s: %s" % (cmd[0], exc))
    if verbose:
        sys.stderr.write((proc.stdout or "") + (proc.stderr or ""))
    return Result(proc.returncode, proc.stdout or "", proc.stderr or "")


def trim(text, max_lines=TRIM_LINES):
    lines = (text or "").strip().splitlines()
    if len(lines) > max_lines:
        omitted = len(lines) - max_lines
        lines = lines[:max_lines] + ["... [%d more line(s) trimmed]" % omitted]
    return "\n".join(lines)


def fail_reason(cmd, proc):
    return "`%s` exit=%s\n%s" % (" ".join(cmd), proc.returncode,
                                 trim((proc.stdout or "") + "\n" + (proc.stderr or "")))


def read_profile(ws):
    return json.loads((ws / ".agent" / "profile.json").read_text(encoding="utf-8"))


# ── Step 1: scaffold ─────────────────────────────────────────────────────────

def step_scaffold(ctx):
    ctx["ws"].parent.mkdir(parents=True, exist_ok=True)
    cmd = [bash_exe(), str(HARNESS_ROOT / "init.sh"), "--path", str(ctx["ws"]),
           "--name", ctx["name"], "--no-pulse"]
    proc = run(cmd, HARNESS_ROOT, SCAFFOLD_TIMEOUT_SECONDS, ctx["verbose"])
    if proc.returncode != 0:
        return "FAIL", fail_reason(cmd, proc)
    if not (ctx["ws"] / ".agent" / "profile.json").exists():
        return "FAIL", "init.sh exited 0 but profile.json was never delivered"
    return "PASS", "workspace scaffolded"


# ── Step 2: onboard ──────────────────────────────────────────────────────────

def step_onboard(ctx):
    answers = ctx["run_root"] / "onboard-answers.json"
    answers.write_text(json.dumps(ONBOARD_ANSWERS), encoding="utf-8")
    cmd = [sys.executable, "execution/onboard_flow.py", "run", "--answers", str(answers)]
    proc = run(cmd, ctx["ws"], ONBOARD_TIMEOUT_SECONDS, ctx["verbose"])
    if proc.returncode != 0:
        return "FAIL", fail_reason(cmd, proc)
    try:
        profile = read_profile(ctx["ws"])
    except (OSError, ValueError) as exc:
        return "FAIL", "profile.json unreadable after onboarding (%r)" % exc
    if profile.get("onboarding_complete") is not True:
        return "FAIL", "onboarding_complete reads %r, not true" % profile.get("onboarding_complete")
    if profile.get("project_name") != ctx["name"]:
        return "FAIL", "project_name reads %r, expected %r" % (
            profile.get("project_name"), ctx["name"])
    return "PASS", "interview completed, project_name=%s" % ctx["name"]


# ── Step 3: boot ─────────────────────────────────────────────────────────────

def step_boot(ctx):
    cmd = [sys.executable, "execution/boot_panel.py", "--format", "compact", "--exit-code"]
    proc = run(cmd, ctx["ws"], BOOT_TIMEOUT_SECONDS, ctx["verbose"])
    if proc.returncode == 0:
        return "PASS", "boot panel verdict ok"
    return "FAIL", "boot_panel verdict is not ok\n" + fail_reason(cmd, proc)


# ── Step 4: ghosts ───────────────────────────────────────────────────────────

def prepare_ghost_env(run_root):
    """Windows needs the LF shim and UTF-8 stdio; elsewhere ghosts run as they are."""
    if not IS_WINDOWS:
        return {}
    shim_dir = run_root / "ghost-win-shim"
    shim_dir.mkdir(parents=True, exist_ok=True)
    (shim_dir / "sitecustomize.py").write_text(WINDOWS_SHIM, encoding="utf-8", newline="\n")
    existing = os.environ.get("PYTHONPATH", "")
    return {"PYTHONPATH": str(shim_dir) + (os.pathsep + existing if existing else "")}


def run_one_ghost(script, name, log_dir, ghost_env, verbose):
    """Run one ghost's run_tests.sh from the test project's tree; log it. Returns the verdict."""
    proc = run([bash_exe(), str(script)], script.parent.parent, GHOST_TIMEOUT_SECONDS, verbose,
               ghost_env)
    log = log_dir / ("%s.log" % name)
    log.write_text((proc.stdout or "") + (proc.stderr or ""), encoding="utf-8", errors="replace")
    return ("PASS" if proc.returncode == 0 else "FAIL"), proc, log


def step_ghosts(ctx):
    src = HARNESS_ROOT / "execution" / "tests" / "ghost-project"
    dest = ctx["ws"] / ".tmp" / "sandbox" / "ghosts"
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(src, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    log_dir = ctx["run_root"] / "ghost-logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    ghost_env = prepare_ghost_env(ctx["run_root"])
    ctx["ghosts"] = []
    fails = []
    for script in sorted(dest.glob("*/tests/run_tests.sh")):
        name = script.parent.parent.name
        if IS_WINDOWS and name in WINDOWS_GHOST_SKIPS:
            verdict, detail = "SKIP", "SKIP on Windows: %s" % WINDOWS_GHOST_SKIPS[name]
        else:
            verdict, proc, log = run_one_ghost(script, name, log_dir, ghost_env, ctx["verbose"])
            detail = verdict
            if verdict == "FAIL":
                detail = "FAIL (log: %s)" % log
                fails.append(name)
                ctx["ghost_tails"][name] = trim((proc.stdout or "") + (proc.stderr or ""), 10)
        print("  [ghost/%s] %s" % (name, detail if verdict != "FAIL" else "FAIL"), flush=True)
        ctx["ghosts"].append((name, verdict, detail))
    counts = {v: sum(1 for _, x, _ in ctx["ghosts"] if x == v) for v in ("PASS", "FAIL", "SKIP")}
    summary = "%d passed, %d failed, %d skipped" % (counts["PASS"], counts["FAIL"], counts["SKIP"])
    if not ctx["ghosts"]:
        return "FAIL", "no ghost run_tests.sh found under %s" % src
    if fails:
        return "FAIL", "%s; failed: %s" % (summary, ", ".join(fails))
    return "PASS", summary


# ── Step 5: alembic ──────────────────────────────────────────────────────────

def alembic_get(path, timeout, accept="*/*"):
    req = urllib.request.Request(ALEMBIC_URL + path, headers={"Accept": accept})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def check_alembic_health(ctx):
    body = alembic_get("", ALEMBIC_HEALTH_TIMEOUT_SECONDS, "application/json")
    status = json.loads(body)
    if status.get("status") != "ok":
        raise ValueError("health status is %r, not 'ok'" % status.get("status"))
    ctx["alembic_version"] = str(status.get("version", "unknown"))


def check_alembic_search():
    body = alembic_get("?q=" + urllib.parse.quote("athanor harness"),
                       ALEMBIC_SEARCH_TIMEOUT_SECONDS)
    if not body.lstrip().startswith("# Search:"):
        raise ValueError("search body does not start with '# Search:' (got %r)" % body[:80])
    if "](http" not in body:
        raise ValueError("search returned no result links")


def check_alembic_fetch():
    body = alembic_get("https://example.com", ALEMBIC_FETCH_TIMEOUT_SECONDS)
    if "Example Domain" not in body:
        raise ValueError("fetch of https://example.com lacks 'Example Domain'")


def step_alembic(ctx):
    checks = (("health", lambda: check_alembic_health(ctx)),
              ("search", check_alembic_search), ("fetch", check_alembic_fetch))
    for label, check in checks:
        try:
            check()
        except (urllib.error.URLError, OSError, ValueError) as exc:
            return "FAIL", "%s check against %s failed: %s: %s" % (
                label, ALEMBIC_URL, type(exc).__name__, exc)
    return "PASS", "Alembic %s at %s: health, search, fetch ok" % (
        ctx["alembic_version"], ALEMBIC_URL)


# ── Step 6: mission ──────────────────────────────────────────────────────────

def split_frontmatter(text):
    """Exact column-0 '---' boundaries, as mission.py's parse_mission_file does."""
    offsets, offset = [], 0
    for line in text.splitlines(keepends=True):
        if line.rstrip("\r\n") == "---":
            offsets.append(offset)
            if len(offsets) == 2:
                break
        offset += len(line)
    if len(offsets) < 2:
        raise ValueError("mission file frontmatter is not closed with ---")
    return text[offsets[0] + 3:offsets[1]].strip(), text[offsets[1] + 3:]


def mission_cmd(ws, verbose, args, timeout=MISSION_TIMEOUT_SECONDS):
    cmd = [sys.executable, "execution/mission.py"] + args
    return cmd, run(cmd, ws, timeout, verbose)


def add_trivial_feature(mission_path):
    import yaml
    fm_text, body = split_frontmatter(mission_path.read_text(encoding="utf-8"))
    fm = yaml.safe_load(fm_text)
    fm["features"] = [{"id": "F1", "title": "Trivial e2e feature", "status": "pending",
                       "inline_brief": "Always-true sanity check for the e2e gate."}]
    fm["milestones"] = [{"id": "M1", "name": "M1", "features": ["F1"]}]
    dumped = yaml.dump(fm, default_flow_style=False, sort_keys=False, allow_unicode=True)
    mission_path.write_text("---\n" + dumped + "---\n\n" + body.lstrip("\n"), encoding="utf-8")


def step_mission(ctx):
    ws, verbose = ctx["ws"], ctx["verbose"]
    cmd, proc = mission_cmd(ws, verbose, ["new", "Project e2e trivial mission",
                                          "--slug", "e2e-trivial"])
    if proc.returncode != 0:
        return "FAIL", "mission new failed\n" + fail_reason(cmd, proc)
    created = next((l.split("Created:", 1)[1].strip() for l in proc.stdout.splitlines()
                    if l.startswith("Created:")), "")
    mission_path = Path(created) if created else None
    if mission_path and not mission_path.is_absolute():
        mission_path = ws / created
    if not mission_path or not mission_path.exists():
        return "FAIL", "mission new printed no usable 'Created:' path\n" + trim(proc.stdout)
    try:
        add_trivial_feature(mission_path)
    except Exception as exc:  # any parse/write failure is a FAIL with its type
        return "FAIL", "could not edit mission frontmatter: %r" % exc
    contract_dir = ws / ".agent" / "memory" / "project" / "specs" / "project-e2e-trivial"
    contract_dir.mkdir(parents=True, exist_ok=True)
    contract = contract_dir / "contract.yaml"
    contract.write_text(TRIVIAL_CONTRACT_YAML, encoding="utf-8")
    steps = (
        ("validate", ["validate", created]),
        ("activate", ["activate", created]),
        ("attach-spec", ["attach-spec", created, "--feature", "F1",
                         "--spec", "inline://project-e2e-trivial",
                         "--contract", contract.relative_to(ws).as_posix()]),
        ("checkpoint", ["checkpoint", created, "--feature", "F1", "--status", "done"]),
        ("gate", ["gate", created, "--milestone", "M1"]),
    )
    for label, args in steps:
        cmd, proc = mission_cmd(ws, verbose, args)
        if proc.returncode != 0:
            return "FAIL", "mission %s failed\n%s" % (label, fail_reason(cmd, proc))
    return "PASS", "new, validate, activate, attach-spec, checkpoint, gate green"


# ── Step 7: report ───────────────────────────────────────────────────────────

def harness_head():
    proc = run(["git", "rev-parse", "HEAD"], HARNESS_ROOT, GIT_TIMEOUT_SECONDS, False)
    return proc.stdout.strip() if proc.returncode == 0 else "unknown"


def build_report(ctx, results, report_status):
    lines = [
        "# Project E2E report: %s" % ctx["name"],
        "",
        "- Project: %s" % ctx["name"],
        "- OS: %s (%s)" % (platform.platform(), platform.machine()),
        "- Python: %s (%s)" % (platform.python_version(), sys.executable),
        "- Harness git HEAD: %s" % harness_head(),
        "- Alembic: %s (version %s)" % (ALEMBIC_URL, ctx.get("alembic_version", "not reached")),
        "- Run dir: %s" % ctx["run_root"],
        "",
        "## Steps",
        "",
    ]
    for name, status, reason in results + [("report", report_status, "report written")]:
        first, _, rest = (reason or "").partition("\n")
        lines.append("- [%s] %s: %s" % (status, name, first))
        lines.extend("    " + l for l in rest.splitlines())
    lines += ["", "## Ghosts", ""]
    for name, verdict, detail in ctx.get("ghosts", []):
        lines.append("- [%s] ghost/%s%s" % (verdict, name, "" if verdict == "PASS"
                                              else ": " + detail))
        lines.extend("    " + l for l in ctx["ghost_tails"].get(name, "").splitlines())
    if not ctx.get("ghosts"):
        lines.append("- ghosts step did not run")
    return "\n".join(lines) + "\n"


def write_report(ctx, results):
    path = ctx["run_root"] / "report.md"
    path.write_text(build_report(ctx, results, "PASS"), encoding="utf-8")
    return path


# ── Driver ───────────────────────────────────────────────────────────────────

STEP_FUNCS = {
    "scaffold": step_scaffold, "onboard": step_onboard, "boot": step_boot,
    "ghosts": step_ghosts, "alembic": step_alembic, "mission": step_mission,
}
NEEDS_WORKSPACE = {"onboard", "boot", "ghosts", "mission"}


def default_name():
    return DEFAULT_NAMES.get(sys.platform, "TestAthanorLinux")


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Deploy, onboard, boot and exercise a test project.")
    parser.add_argument("--name", default=default_name(), help="test project name")
    parser.add_argument("--only", default="", help="comma list of steps: " + ",".join(STEP_NAMES))
    parser.add_argument("--keep", action="store_true", help="keep the workspace")
    parser.add_argument("--verbose", action="store_true", help="stream child output")
    args = parser.parse_args(argv)
    only = [s.strip() for s in args.only.split(",") if s.strip()]
    unknown = [s for s in only if s not in STEP_NAMES]
    if unknown:
        parser.error("unknown step(s): %s" % ", ".join(unknown))
    args.only = only
    return args


def utf8_streams():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def print_step(num, name, status, reason):
    lines = (reason or "").splitlines() or [""]
    print("[%s] %d %s \u2014 %s" % (status, num, name, lines[0]))
    for line in lines[1:]:
        print("    " + line)


def run_steps(ctx, selected):
    results = []
    for num, name in enumerate(STEP_NAMES[:-1], start=1):
        if name not in selected:
            continue
        if name in NEEDS_WORKSPACE and not (ctx["ws"] / ".agent" / "profile.json").exists():
            status, reason = "SKIP", "no scaffolded workspace (scaffold did not run or failed)"
        else:
            try:
                status, reason = STEP_FUNCS[name](ctx)
            except Exception as exc:  # a crashing step is a FAIL, never a traceback exit
                status, reason = "FAIL", "unhandled exception: %r" % exc
        results.append((name, status, reason))
        print_step(num, name, status, reason)
    return results


def main():
    utf8_streams()
    args = parse_args(sys.argv[1:])
    selected = set(args.only or STEP_NAMES)
    ctx = {"name": args.name, "verbose": args.verbose, "run_root": RUN_ROOT,
           "ws": RUN_ROOT / args.name, "ghost_tails": {}}
    RUN_ROOT.mkdir(parents=True, exist_ok=True)
    results = run_steps(ctx, selected)
    report = write_report(ctx, results)
    if "report" in selected:
        print_step(7, "report", "PASS", "report written")
    print("REPORT: %s" % report.resolve())
    failed = [n for n, s, _ in results if s != "PASS"]
    if failed and not args.keep:
        print("workspace kept for inspection at %s" % ctx["ws"], file=sys.stderr)
    elif not args.keep:
        try:
            safe_rmtree(ctx["ws"])
        except (OSError, RuntimeError) as exc:
            print("WARNING: could not clean %s: %r" % (ctx["ws"], exc), file=sys.stderr)
    ran = len(results)
    ok = ran - len(failed)
    print("PROJECT E2E %s: %s (%d/%d)" % (args.name, "PASS" if not failed else "FAIL", ok, ran))
    sys.exit(0 if not failed and ran else 1)


if __name__ == "__main__":
    main()
