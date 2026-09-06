#!/usr/bin/env python3
"""hook_probe.py — proves what a registered hook DOES, not what its name says.

THE DEFECT THIS EXISTS TO SEE (F19/F18, notes-f19.md §0)

Every hook in .claude/settings.json is registered as

    [ -f execution/hooks/X.sh ] && bash "execution/hooks/X.sh" || exit 0

In `A && B || C`, C runs whenever B fails — and a PreToolUse guard signals
DENY by exiting 2, which IS a failure. So `|| exit 0` fires and the whole
composite command exits 0: ALLOW. boot_panel counted a hook as delivered by
regexing its filename out of that very registration string — present in the
live form and in this dead form alike, so no presence check of any
sophistication could ever have caught it. Only EXECUTING THE REGISTRATION
STRING can, which is what this module does.

WHAT IT PROVES
    For every registration this workspace declares, run the REGISTRATION
    COMMAND VERBATIM (never the script path) once with a payload declared
    to be denied and once with a payload declared to be allowed, and
    compare the two outcomes against the declaration:

        ok               ran, and behaved as its declaration says it must
        dead             could not run, or did not terminate within the bound
        undiscriminating ran, but the deny-shaped and allow-shaped payloads
                         produced the SAME decision — the 26/26 lie, by name
        unprobed         registered, but no declaration says what correct means
        unvouched        declared, but wired in a shape this module refuses to
                         execute (see VOUCHING); never run
        inert            declared as having no decision to make (a context
                         injector); never counted toward the enforcement total

Declarations live in .agent/config/hook_probes.json, independent of the
script — a probe that read the script's own source to decide what "correct"
means would agree with every mutation of that script, the same disease this
module exists to cure one layer up.

ISOLATION (round 2, finding 2)
    A probed hook runs in a THROWAWAY WORKSPACE under .tmp/sandbox/, one per
    invocation, never in the live tree. The hooks' own state variables
    (ATHANOR_SCRATCH and its siblings), HOME and TMPDIR are pointed into that
    box, so a hook cannot leave a cache, a marker or a gate file behind in the
    workspace merely by having been measured. The box is removed afterwards.

VOUCHING (round 2, finding 2)
    A registration string is executed ONLY if it matches one of the two
    sanctioned shapes (a bare invocation, or the guarded `[ -f X ] && … ||
    exit 0` form) naming exactly one script. Anything else — a chained
    command, an injected `touch`, a substitution — classifies `unvouched` and
    is NEVER executed. Running arbitrary strings out of a config file during
    boot collection is not acceptable, however the string got there.

STATE INDEPENDENCE (round 2, finding 3)
    The verdict must be a function of the HOOK, not of the workspace's mood.
    A declaration therefore states the world its payloads assume: `level`
    pins the box's autonomy tier, and `files` / `deny_files` / `allow_files`
    seed the box before the corresponding run. Payload strings may contain
    `{probe_root}`, which expands to the box's absolute path, so a payload can
    name an absolute in-box target without knowing where the box will be.

THE DECISION, NOT THE EXIT CODE
    A hook decides in two sanctioned ways: a process exit code, or a JSON
    decision on stdout. Both are read, and both are normalised to one
    EFFECTIVE code that `deny_rc` / `allow_rc` are matched against:

        2   deny     — exit 2, or `decision: block`, or permissionDecision
                       `deny` on stdout
        10  allow    — an explicit permissionDecision `allow` on stdout (a
                       pre-emptive auto-approval; distinct from silence)
        rc  anything else, verbatim — 0 for silent pass-through, 127 for a
            script that is not there
"""
import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SCHEMA = "athanor.hookprobes/v1"
DECLARATIONS_REL = ".agent/config/hook_probes.json"
SETTINGS_REL = ".claude/settings.json"
HOOKS_DIR_REL = "execution/hooks"
HANDOFFS_REL = ".agent/handoffs.yaml"
SANDBOX_REL = ".tmp/sandbox/hook-probe"

# Bound on ONE probed invocation. Two invocations (deny + allow) per script,
# so a hanging hook returns control well inside a boot's patience.
RUN_TIMEOUT_SECONDS = 10
# After the bound expires the process GROUP is killed, not just the direct
# child: `bash -c 'bash X'` puts the hook in a grandchild, and killing only
# the wrapper leaves the hook running against a box that is about to vanish.
KILL_GRACE_SECONDS = 5
# Probes are independent by construction — each gets its own box — so they run
# concurrently. Serial, eleven declared guards cost several seconds of every
# SessionStart.
MAX_PARALLEL_PROBES = 8

RESULTS = ("ok", "dead", "undiscriminating", "unprobed", "unvouched", "inert")

# The event whose hooks exist to return a verdict. Every other event is a
# notification surface on which `inert` is an honest declaration, so only these
# registrations form the enforcement coverage denominator.
ENFORCEMENT_EVENTS = ("PreToolUse",)

# Effective codes. 2 and 0 are the hook protocol's own; 10 is this module's
# name for "the hook emitted an explicit allow", which is a different event
# from exiting 0 in silence and must not be conflated with it.
CODE_DENY = 2
CODE_EXPLICIT_ALLOW = 10

# The three sanctioned registration shapes, and nothing else. A path may
# carry `$VAR`/`${VAR}` (the CLAUDE_PROJECT_DIR spelling) but no
# substitution, separator or redirect — those characters are simply not in
# the class.
#
# Shape A (bare, or the pre-F8 guarded form): `bash X`, optionally preceded
# by `[ -f X ] &&` and/or followed by `|| exit 0`. F8 (blocking-hooks-
# actually-block) proved the trailing `|| exit 0` swallows the script's own
# exit 2 into allow, so this shape is no longer written for a blocking hook
# — it is still matched here only so a legacy or third-party registration in
# this dead shape is inspected, not silently skipped.
# Shape B (post-F8): `[ -f X ] || exit 0; bash X` — absent still exits 0,
# present propagates the script's real exit code including 2 = deny.
_PATH = r'"?[A-Za-z0-9_./${}-]+"?'
VOUCHED_RE = re.compile(
    r"^\s*(?:\[\s+-f\s+(?P<guardA>" + _PATH + r")\s+\]\s*&&\s*)?"
    r"bash\s+(?P<scriptA>" + _PATH + r")"
    r"(?:\s*\|\|\s*exit\s+0)?\s*$"
    r"|"
    r"^\s*\[\s+-f\s+(?P<guardB>" + _PATH + r")\s+\]\s*\|\|\s*exit\s+0\s*;\s*"
    r"bash\s+(?P<scriptB>" + _PATH + r")\s*$")

# Marker every probed hook can test for, so a hook that genuinely must not run
# under measurement has one honest way to say so.
PROBE_ENV_FLAG = "ATHANOR_HOOK_PROBE"

# Where a payload asks for the box's absolute path.
ROOT_PLACEHOLDER = "{probe_root}"


def _load_json(path):
    try:
        return json.loads(Path(path).read_text()), None
    except FileNotFoundError:
        return None, "missing"
    except (OSError, json.JSONDecodeError) as exc:
        return None, f"{exc.__class__.__name__}: {exc}"


def _load_declarations(root):
    doc, _err = _load_json(root / DECLARATIONS_REL)
    if not isinstance(doc, dict):
        return {}
    scripts = doc.get("scripts")
    return scripts if isinstance(scripts, dict) else {}


def _registrations(root):
    """Every hook registration this workspace declares: (event, command)."""
    doc, _err = _load_json(root / SETTINGS_REL)
    out = []
    if not isinstance(doc, dict):
        return out
    for event, entries in (doc.get("hooks") or {}).items():
        for matcher in entries if isinstance(entries, list) else []:
            for hook in (matcher or {}).get("hooks") or []:
                command = hook.get("command")
                if isinstance(command, str) and command:
                    out.append((event, command))
    return out


def _match_script(command, declarations, root):
    """Which declared or on-disk script this registration string names.

    Matching is by NAME, never by re-deriving the invocation from a fixed
    path — the defect under test lives in the registration string, so the
    string is what gets executed, and the name is only used to look up what
    "correct" means for it. Ties (a name that is a substring of a longer
    declared name) resolve to the LONGEST match.
    """
    candidates = set(declarations)
    hooks_dir = root / HOOKS_DIR_REL
    if hooks_dir.is_dir():
        candidates.update(p.name for p in hooks_dir.glob("*.sh"))
    hits = [name for name in candidates if name in command]
    if not hits:
        return None
    return max(hits, key=len)


def _unquote(word):
    return word[1:-1] if len(word) > 1 and word[0] == word[-1] == '"' else word


def is_vouched(command, script):
    """Is this registration in a shape the probe is willing to EXECUTE?

    The probe runs strings that arrive from a configuration file. A string
    such as `touch .agent/pwned; bash "execution/hooks/check_autonomy.sh"`
    names a declared script and would, under a name-match alone, run the
    injected command during boot collection. So the whole string — not the
    part that matched — has to be one of the sanctioned shapes, and the
    guarded form's `-f` test has to name the same file it then runs.
    """
    if not script:
        return False
    match = VOUCHED_RE.match(command)
    if not match:
        return False
    groups = match.groupdict()
    target_raw = groups["scriptA"] if groups["scriptA"] is not None else groups["scriptB"]
    guard_raw = groups["guardA"] if groups["scriptA"] is not None else groups["guardB"]
    target = _unquote(target_raw)
    if guard_raw is not None and _unquote(guard_raw) != target:
        return False
    return target.endswith("/" + script) or target == script


# ------------------------------------------------------------- the sandbox --
def _expand(value, box):
    """Substitute the box's absolute path into a declared payload or file."""
    if isinstance(value, str):
        return value.replace(ROOT_PLACEHOLDER, str(box))
    if isinstance(value, dict):
        return {k: _expand(v, box) for k, v in value.items()}
    if isinstance(value, list):
        return [_expand(v, box) for v in value]
    return value


def _write_seed(box, files):
    """Write declared fixture files into the box, creating parents.

    A path is confined to the box: a declaration is configuration, and
    configuration does not get to name a target outside the throwaway
    workspace it is seeding.
    """
    for rel, content in (files or {}).items():
        target = (box / str(rel)).resolve()
        if box not in target.parents:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(_expand(str(content), box))


def _make_box(root, decl, files):
    """Build one throwaway workspace and return its path.

    `execution/` is a symlink to the real tree — the hook under test must be
    the REAL hook, not a copy that could drift from it. Everything a hook
    writes through a relative path, and every state directory the hooks
    consult by environment variable, lands inside the box instead.
    """
    parent = root / SANDBOX_REL
    parent.mkdir(parents=True, exist_ok=True)
    box = Path(tempfile.mkdtemp(prefix="probe.", dir=str(parent))).resolve()
    for rel in (".agent/memory/scratch", ".agent/memory/project/specs",
                ".agent/memory/project/missions", ".agent/config", "docs", ".tmp"):
        (box / rel).mkdir(parents=True, exist_ok=True)
    os.symlink(str(root / "execution"), str(box / "execution"))
    handoffs = root / HANDOFFS_REL
    if handoffs.is_file():
        shutil.copyfile(str(handoffs), str(box / HANDOFFS_REL))
    level = decl.get("level")
    if isinstance(level, str) and level:
        # Pinned, so the verdict cannot swing with the live workspace's tier.
        # This is the whole of finding 3: an allow payload that is permitted at
        # high and denied at low measures the workspace, not the hook.
        (box / ".claude" / "policies").mkdir(parents=True, exist_ok=True)
        (box / ".claude" / "policies" / "autonomy.json").write_text(json.dumps(
            {"schema": "athanor.autonomy-policy/v1", "permission_tier": level}))
    _write_seed(box, decl.get("files"))
    _write_seed(box, files)
    return box


def _box_env(box):
    env = dict(os.environ)
    env[PROBE_ENV_FLAG] = "1"
    env["HOME"] = str(box)
    env["TMPDIR"] = str(box / ".tmp")
    env["ATHANOR_SCRATCH"] = str(box / ".agent" / "memory" / "scratch")
    env["ATHANOR_SPECS"] = str(box / ".agent" / "memory" / "project" / "specs")
    env["ATHANOR_PROJECT_MEM"] = str(box / ".agent" / "memory" / "project")
    env["ATHANOR_DOCS"] = str(box / "docs")
    env["ATHANOR_HANDOFFS"] = str(box / HANDOFFS_REL)
    env["ATHANOR_ACTIVE_MISSION_PATH"] = str(
        box / ".agent" / "memory" / "project" / "missions" / "active.json")
    # The box has to live inside the project (sandbox.md), which puts it inside
    # the project's git repository — and a hook that asks git where it is then
    # answers about the LIVE workspace instead of the box. The ceiling stops
    # that walk at the sandbox, so the box is what it actually is: a directory
    # that is not a checkout of anything.
    env["GIT_CEILING_DIRECTORIES"] = str(box.parent)
    for inherited in ("GIT_DIR", "GIT_WORK_TREE"):
        env.pop(inherited, None)
    return env


def _scrub(box):
    if box is not None:
        shutil.rmtree(str(box), ignore_errors=True)


def _kill_group(proc):
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (OSError, ProcessLookupError):
        try:
            proc.kill()
        except OSError:
            pass


def _stdout_decision(text):
    """The decision a hook printed, if it printed one.

    A hook may block by exiting 2 OR by emitting JSON on stdout; a guard read
    only through its exit code is half-measured. Only an object carrying one
    of the two sanctioned decision fields counts — arbitrary JSON output is
    not a verdict.
    """
    for line in [text.strip()] + [ln.strip() for ln in text.splitlines()]:
        if not line.startswith("{"):
            continue
        try:
            doc = json.loads(line)
        except ValueError:
            continue
        if not isinstance(doc, dict):
            continue
        if doc.get("decision") == "block":
            return "deny"
        specific = doc.get("hookSpecificOutput")
        if isinstance(specific, dict):
            verdict = specific.get("permissionDecision")
            if verdict == "deny":
                return "deny"
            if verdict == "allow":
                return "allow"
    return None


def _run_once(command, box, payload):
    """Execute the REGISTRATION STRING verbatim via `bash -c`, inside the box.

    Returns the EFFECTIVE code (see module docstring), or None if the process
    had to be killed for exceeding the bound or could not be started at all.
    """
    try:
        proc = subprocess.Popen(
            ["bash", "-c", command], cwd=str(box),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, env=_box_env(box), text=True,
            start_new_session=True)
    except OSError:
        return None
    try:
        out, _err = proc.communicate(input=payload, timeout=RUN_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        try:
            proc.communicate(timeout=KILL_GRACE_SECONDS)
        except subprocess.TimeoutExpired:
            pass
        return None
    decision = _stdout_decision(out or "")
    if decision == "deny":
        return CODE_DENY
    if decision == "allow":
        return CODE_EXPLICIT_ALLOW
    return proc.returncode


def _run_phase(root, command, decl, phase):
    """One half of a probe: a fresh box, seeded for this phase, then the run."""
    box = None
    try:
        box = _make_box(root, decl, decl.get(f"{phase}_files"))
        payload = json.dumps(_expand(decl.get(phase) or {}, box))
        return _run_once(command, box, payload)
    except OSError:
        return None
    finally:
        _scrub(box)


def _classify(command, root, decl):
    """Run the deny and allow payloads and classify the pair. See module
    docstring for the vocabulary and the reasoning behind each branch."""
    deny_rcs = decl.get("deny_rc") or []
    allow_rcs = decl.get("allow_rc") or []

    with ThreadPoolExecutor(max_workers=2) as pool:
        deny_future = pool.submit(_run_phase, root, command, decl, "deny")
        allow_future = pool.submit(_run_phase, root, command, decl, "allow")
        deny_rc = deny_future.result()
        allow_rc = allow_future.result()

    if deny_rc is None or allow_rc is None:
        return "dead"

    deny_ok = deny_rc in deny_rcs
    allow_ok = allow_rc in allow_rcs

    if deny_rc == allow_rc:
        # The SAME code came back regardless of what was fed in. If that code
        # is one either side declared as a real decision, the hook is making
        # a decision — always the same one. If it is neither, the invocation
        # itself never produced a decision at all (missing script, crash).
        return "undiscriminating" if (deny_ok or allow_ok) else "dead"
    if deny_ok and allow_ok:
        return "ok"
    return "undiscriminating"


def _result_for(root, command, script, decl):
    """The bucket one registration falls in, and whether it was declared."""
    if decl is None:
        return "unprobed", False
    mode = decl.get("mode")
    if mode == "inert":
        return "inert", True
    if mode != "discriminate":
        return "unprobed", False
    if not is_vouched(command, script):
        return "unvouched", True
    return _classify(command, root, decl), True


def _coverage(probes, root):
    """How much of the enforcement layer this instrument actually measured.

    `unprobed` reads as healthy — the panel halts on dead/undiscriminating
    only — so an undeclared guard is a silent hole in exactly the instrument
    built to end silent holes. Counted against the REGISTRATION SET, because a
    config counted against its own contents agrees with every mutation of
    itself. `inert` registrations are excluded from the denominator: they were
    declared as having no decision to make.
    """
    enforcement = [p for p in probes
                   if p["event"] in ENFORCEMENT_EVENTS and p["result"] != "inert"]
    undeclared = sorted({p["script"] or "(inline command)"
                         for p in enforcement if not p["declared"]})
    declared_scripts = _load_declarations(root)
    registered_scripts = {p["script"] for p in enforcement if p["script"]}
    phantom = sorted(name for name, decl in declared_scripts.items()
                     if isinstance(decl, dict)
                     and decl.get("mode") == "discriminate"
                     and name not in registered_scripts)
    return {
        "enforcement_registered": len(enforcement),
        "enforcement_declared": len(enforcement) - len(undeclared),
        "undeclared": undeclared,
        "phantom": phantom,
    }


def probe_workspace(root):
    """Probe every declared registration. Returns the athanor.hookprobes/v1
    result document: {"schema": ..., "probes": [{"script", "event", "result",
    "declared"}, ...], "coverage": {...}}.

    Registrations that share a command string are probed ONCE — the string is
    the subject, and running check_autonomy's three identical registrations
    three times measures nothing new and costs three times as much.
    """
    root = Path(root).resolve()
    declarations = _load_declarations(root)
    registrations = _registrations(root)

    work = {}
    for _event, command in registrations:
        if command in work:
            continue
        script = _match_script(command, declarations, root)
        work[command] = (script, declarations.get(script) if script else None)

    def measure(command):
        script, decl = work[command]
        return _result_for(root, command, script, decl)

    outcomes = {}
    if work:
        commands = list(work)
        with ThreadPoolExecutor(max_workers=MAX_PARALLEL_PROBES) as pool:
            outcomes = dict(zip(commands, pool.map(measure, commands)))

    probes = []
    for event, command in registrations:
        script, _decl = work[command]
        result, declared = outcomes[command]
        probes.append({"script": script, "event": event,
                       "result": result, "declared": declared})
    return {"schema": SCHEMA, "probes": probes, "coverage": _coverage(probes, root)}


def _parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="hook_probe.py",
        description="Execute each registered hook's REGISTRATION STRING "
                    "against its declared deny/allow payloads, in an isolated "
                    "throwaway workspace, and report whether it can actually "
                    "discriminate.")
    parser.add_argument("--root", default=".", help="Workspace root (default: cwd)")
    parser.add_argument("--json", action="store_true", help="Emit the result document as JSON")
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv)
    root = Path(args.root).resolve()
    doc = probe_workspace(root)
    if args.json:
        print(json.dumps(doc, indent=2))
        return 0
    for entry in doc["probes"]:
        print(f"{entry['result']:16s} {entry['event']:16s} {entry['script']}")
    coverage = doc["coverage"]
    print(f"\nenforcement declared {coverage['enforcement_declared']}"
          f"/{coverage['enforcement_registered']}"
          + (" — undeclared: " + ", ".join(coverage["undeclared"])
             if coverage["undeclared"] else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
