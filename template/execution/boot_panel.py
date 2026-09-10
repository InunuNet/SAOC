#!/usr/bin/env python3
"""boot_panel.py — the boot status panel (spec boot-status-panel, F1).

ONE collector produces an `athanor.bootpanel/v1` document; every renderer reads
that document and COMPUTES NOTHING. REQUIREMENTS.md 5.4 requires the compact
panel and `make boot-report` to read "the SAME source of truth so they cannot
disagree"; the only way to make that structurally true is to have exactly one
thing compute and everything else render.

    collect(root)          -> athanor.bootpanel/v1        (the ONLY computation)
    render_compact(doc)    -> the per-boot panel, <= 30 lines
    render_report(doc)     -> the full named listing (strict superset)
    render_agreement(doc)  -> the first-print-only block, one field per line
    render_stamp(marker)   -> the one-line subagent stamp, <= 120 chars

The collector NEVER exits non-zero on a workspace defect. It runs from
SessionStart, and a hook that fails takes the session with it; a workspace an
operator cannot clear is a lockout. The verdict travels in the document and in
the marker (`.agent/memory/scratch/.boot_panel.json`), and the mission driver
is what refuses to start.

Independent oracles (never regenerate these from this file):
  goldens/panel_fields.md      — the required 5.1 field set
  goldens/autonomy_levels.md   — the autonomy truth table
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import autonomy as autonomy_dialect  # noqa: E402  (path fixed up above)

try:  # copied-project-halt F14 — the ONE reader of the identity question.
    import identity_ambiguity  # noqa: E402  (path fixed up above)
except ImportError:  # a workspace that never received the reader; see below.
    identity_ambiguity = None

try:  # F19 — the hook FUNCTION probe, never a regex over its registration.
    import hook_probe  # noqa: E402  (path fixed up above)
except ImportError:  # a workspace that never received the probe; see below.
    hook_probe = None

SCHEMA = "athanor.bootpanel/v1"

MARKER_REL = ".agent/memory/scratch/.boot_panel.json"
QUOTA_MIRROR_REL = ".agent/memory/scratch/.quota_status.json"
CONTEXT_MIRROR_REL = ".agent/memory/scratch/.context_status.json"
STACK_CACHE_REL = ".agent/memory/scratch/.stack_probes.json"
LAST_BOOT_TS_REL = ".agent/memory/scratch/.last_full_boot_ts"
PROFILE_REL = ".agent/profile.json"
SOUL_REL = ".agent/identity/soul.md"
USER_REL = ".agent/identity/user.md"
GOALS_REL = ".agent/memory/project/goals.md"
VERSION_REL = ".agent/version"
MANIFEST_REL = ".agent/delivery-manifest.yaml"
STACK_REGISTRY_REL = ".agent/config/stack_probes.json"
ACTIVE_MISSION_REL = ".agent/memory/project/missions/active.json"
MISSIONS_DIR_REL = ".agent/memory/project/missions"
BACKLOG_REL = ".agent/memory/project/backlog.md"
HOOKS_DIR_REL = "execution/hooks"
CLAUDE_SETTINGS_REL = ".claude/settings.json"
PROBE_DECLARATIONS_REL = ".agent/config/hook_probes.json"
PROVIDERS_DIR_REL = ".agent/providers"

CLASSES = ("rules", "skills", "agents", "workflows")
CLASS_DIRS = {
    "rules": ".agent/rules/_core",
    "skills": ".agent/skills",
    "agents": ".agent/agents",
    "workflows": ".agent/workflows",
}
# NO PROVIDER_DIRS. The delivery denominator is the DECLARED surface — every
# `<class>_dir` in .agent/providers/*.json — exactly as execution/sync_rules.sh
# has always treated it. A hardcoded provider x class product counts directories
# no provider reads and no sync target writes, and each phantom cell halts the
# boot printing a remedy that can never clear it.

ALEMBIC_URL = "http://localhost:7077/"
RELEASE_REPO = "InunuNet/Athanor"
UNKNOWN = "unknown"

PROBE_TIMEOUT_SECONDS = 10
NETWORK_TIMEOUT_SECONDS = 6
DEFAULT_PROBE_TTL_SECONDS = 86400
CONTEXT_SESSION_STALE_SECONDS = 900
MARKER_FRESH_FALLBACK_SECONDS = 3600
STAMP_MAX_CHARS = 120
COMPACT_MAX_FAIL_LINES = 10
COMPACT_MAX_WARN_LINES = 3
BACKLOG_TOP_N = 3
# An estimate is only offered once the corpus can actually support one, and it
# is never a point estimate: measured over this repo's mission corpus the mean
# runs several times the median, so a single number is a lie (SPEC section 5).
ESTIMATE_MIN_SAMPLES = 5
ESTIMATE_SKEW_RATIO = 2.0

GLYPH = {"ok": "✅", "fail": "⛔", "warn": "⚠️", "unknown": "·"}

# The only verdicts a document or a marker may carry. Anything else is a
# defect, never a value to render around.
VERDICTS = ("ok", "halt")

# How a check knows what it reports. Closed vocabulary — a check cannot be
# added without saying how it knows, and a missing or invented basis makes the
# DOCUMENT inconsistent (F19, notes-f19.md §1):
#   executed  the check RAN the subject and read what came back
#   parsed    the check read the subject's content and interpreted it
#   present   the check established existence or a count, nothing more
BASES = ("executed", "parsed", "present")

# Quota states the oracle reports for a limitation NOBODY can clear. Halting on
# one prints a warning forever and teaches the operator to stop reading the
# panel (SPEC "halt on clearable drift, never on an inherent limitation"); every
# other unknown is a broken oracle and blocks.
# Reasons the panel reports without HALTING: nobody in the workspace can clear
# them, so blocking boot on one only produces an unbootable workspace.
#
# missing_mirror belongs here. The mirror is written by the UserPromptSubmit
# hook (execution/hooks/inject_pressure.sh), which by definition has not fired
# yet the first time a fresh workspace boots -- there has been no user prompt.
# Halting on it made every first boot fail a check that first boot cannot
# satisfy, and the remedy the panel printed ("that hook is not running") was
# wrong: the hook is fine, it simply has not had a turn. Measured by
# execution/fleet_acceptance.py step 3. A quota nobody has measured yet is
# unknown, and unknown is reported, not fatal.
QUOTA_INHERENT_REASONS = ("non_claude_code_session", "missing_mirror")

# G-5: a mission in one of these states is not starting work, so it needs no
# autonomy decision. Halting them would leave a blocked mission unclearable.
DECISION_EXEMPT_STATUSES = ("close_out", "blocked", "done", "complete")

BACKLOG_ITEM_RE = re.compile(r"^\s*-\s*\[[ xX]\]\s*(P[01])\b\s*(.*)$")
HOOK_SCRIPT_RE = re.compile(r"execution/hooks/([\w.-]+\.sh)")


# ---------------------------------------------------------------- utilities --
def _now():
    return datetime.datetime.now(datetime.timezone.utc)


def _iso(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_iso(value):
    """Parse an ISO8601 stamp (with or without Z / offset). None on failure."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        moment = datetime.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=datetime.timezone.utc)
    return moment


def _load_json(path):
    """Return (data, error). Never raises — a broken file is a reportable fact."""
    try:
        return json.loads(Path(path).read_text()), None
    except FileNotFoundError:
        return None, "missing"
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        return None, f"unreadable: {exc.__class__.__name__}"


def _read_text(path):
    try:
        return Path(path).read_text().strip()
    except (OSError, UnicodeDecodeError):
        return None


# The AGREEMENT block's three remaining fields are NOT in profile.json —
# onboarding writes each one to a document, and reading them anywhere else is
# how the block came to confirm values nothing had written. One reader per
# field, each pointed at the file `onboard_headless.py` actually writes.

# Returned when soul.md gives no answer at all, and never when it answers
# "unset". A plain None cannot carry that distinction, and a (bool, value)
# tuple would be indistinguishable from the panel's blocking-remedy return
# shape `(status, detail, True, fix, note)` that
# specs/delivery-sync-completeness enumerates.
NO_SOUL_ANSWER = object()


def _read_archetype(root):
    """soul.md `**Archetype**: ...`, or NO_SOUL_ANSWER if soul.md is silent.

    The two absences are NOT the same, and collapsing them is how a stale value
    comes back: soul.md SAYING unset is an answer and ends the lookup, while
    soul.md being absent is no answer and admits the profile fallback.
    `patch_profile()` writes agent_name and project_role but never touches
    `identity.archetype` (onboard_headless.py:346-348), so a profile inherited
    from another workspace keeps its archetype across onboarding — and a plain
    `or` fallback would print that stale value as a confirmed one, which is the
    exact defect class this block exists to remove.
    """
    text = _read_text(root / SOUL_REL)
    if text is None:
        return NO_SOUL_ANSWER
    match = re.search(r"^\*\*Archetype\*\*:\s*(.+?)\s*$", text, re.MULTILINE)
    if not match:
        return NO_SOUL_ANSWER
    value = match.group(1).strip()
    # `(not yet set — run /onboard to set it)` is the writer stating absence.
    if not value or value.startswith("("):
        return None
    return value


def _read_address_as(root):
    """user.md `Address him as **Boss** or **Sir**.` — the bolded names, joined."""
    text = _read_text(root / USER_REL)
    if not text:
        return None
    match = re.search(r"^Address\s+\S+\s+as\s+(.+?)\.?\s*$", text, re.MULTILINE)
    if not match:
        return None
    names = re.findall(r"\*\*(.+?)\*\*", match.group(1))
    return " or ".join(n.strip() for n in names) if names else None


def _read_mission(root):
    """goals.md `## Mission` — the first non-empty line of the section."""
    text = _read_text(root / GOALS_REL)
    if not text:
        return None
    match = re.search(r"^##\s+Mission\s*$(.*?)(?=^##\s|\Z)", text,
                      re.MULTILINE | re.DOTALL)
    if not match:
        return None
    for line in match.group(1).splitlines():
        line = line.strip()
        if line:
            return line
    return None


def _run(argv, cwd=None, timeout=PROBE_TIMEOUT_SECONDS, shell=False):
    """Run a command; return (rc, first_line_of_output). Never raises."""
    try:
        proc = subprocess.run(
            argv, cwd=str(cwd) if cwd else None, shell=shell, timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
    except (OSError, subprocess.SubprocessError):
        return 127, "command could not be executed"
    out = (proc.stdout or "").strip().splitlines()
    return proc.returncode, (out[0] if out else "")


def _git(root, *args):
    rc, out = _run(["git", "-C", str(root)] + list(args), timeout=NETWORK_TIMEOUT_SECONDS)
    return out if rc == 0 else None


def _check(check_id, cls, status, detail, blocking, fix=None, basis=None):
    return {
        "id": check_id, "class": cls, "status": status,
        "detail": detail, "blocking": blocking, "fix": fix, "basis": basis,
    }


def _md_names(directory):
    return sorted(p.name for p in directory.glob("*.md")) if directory.is_dir() else []


def _age_words(seconds):
    """Compact human age: 45s / 12m / 9h / 3d."""
    if seconds is None or not isinstance(seconds, (int, float)):
        return UNKNOWN
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    if seconds < 3600:
        return f"{seconds // 60}m"
    if seconds < 86400:
        return f"{seconds // 3600}h"
    return f"{seconds // 86400}d"


def _s(value):
    return UNKNOWN if value is None else str(value)


def _version_label(version):
    """Never render a bare 'vunknown' — an unreadable version says so."""
    return f"v{version}" if version and version != UNKNOWN else "version unknown"


def _id(value):
    """Identity fields render as an explicit blank, never as a fabricated value.

    An unparseable profile must not produce an agent name out of the folder
    name or anywhere else — "(unset)" is the honest rendering.
    """
    return "(unset)" if value in (None, "") else str(value)


# --------------------------------------------------------------- collectors --
def _collect_workspace(root, profile, profile_error, checks):
    folder = root.name
    project_name = profile.get("project_name") if profile else None
    if project_name == folder:
        name_source = "folder"
    elif project_name:
        name_source = "profile"
    else:
        name_source = UNKNOWN
    identity = profile.get("identity") or {} if profile else {}
    soul_archetype = _read_archetype(root)
    workspace = {
        "folder": folder,
        "project_name": project_name,
        "name_source": name_source,
        "harness_name": profile.get("harness_name") if profile else None,
        "agent_name": identity.get("agent_name"),
        # NEVER fall back to project_role: a role rendered in the archetype
        # slot confirms as readily as a true value. Unset states unset.
        "archetype": (identity.get("archetype")
                      if soul_archetype is NO_SOUL_ANSWER else soul_archetype),
        "project_role": identity.get("project_role"),
        # REQUIREMENTS 0: ESTABLISHED iff the key is boolean true. `bool()` made
        # the string "false" — and every other truthy non-true value — read as a
        # fully onboarded workspace, which is the exact defect ("a new project
        # thinks it is Athanor") this mission exists to remove.
        "onboarding_complete": (profile or {}).get("onboarding_complete") is True,
        "version": _read_text(root / VERSION_REL) or UNKNOWN,
    }
    if profile_error:
        checks.append(_check(
            "identity.profile", "identity", "fail",
            f"{PROFILE_REL} is {profile_error} — identity cannot be verified",
            True, f"repair {PROFILE_REL} (it must be valid JSON)", basis="parsed"))
    else:
        _check_folder_mismatch(root, project_name, folder, checks)
    return workspace


def _check_folder_mismatch(root, project_name, folder, checks):
    """The identity question, consulted through its ONE reader (F14, D-8).

    THIS REPLACED A CHECK THAT INSTRUCTED A FORBIDDEN ACTION. `identity.project_name`
    fired on any project_name/folder disagreement and its fix read "set project_name
    to '<folder>' in .agent/profile.json" — the silent rename clean-scaffold F2/A3
    exists to forbid, and unclearable after a legitimate directory rename, which
    trains the operator to stop reading the panel. The replacement is strictly
    stronger: it still halts on the unaffirmed case, and it stops halting on the
    case a human has already answered.

    An UNKNOWN still fails (SPEC: the panel never renders a state it could not
    determine as fine) — but only where there is a disagreement to adjudicate. A
    workspace whose folder already matches its project name has no question to
    answer, so a missing reader there is not this check's business.
    """
    if identity_ambiguity is not None:
        verdict, reason = identity_ambiguity.inspect(str(root))
        if verdict != identity_ambiguity.AMBIGUOUS:
            return
        answers = identity_ambiguity.answer_lines(str(root))
        checks.append(_check(
            "identity.folder_mismatch", "identity", "fail",
            f"project_name is '{_s(project_name)}' but the folder is '{folder}', and no "
            f"one has confirmed this folder as that project's home here ({reason}) — "
            "a copied project and a renamed one are identical on disk, so this is not "
            "guessed",
            True,
            f"if this folder was RENAMED: {answers[0]} — "
            f"if it is a COPY of another project: {answers[1]}",
            basis="executed"))
        return
    if project_name != folder:
        checks.append(_check(
            "identity.folder_mismatch", "identity", "fail",
            f"project_name is '{_s(project_name)}' but the folder is '{folder}', and "
            "execution/identity_ambiguity.py is missing — whether this workspace is a "
            "copy of another project cannot be determined here",
            True,
            "restore the reader: python3 execution/update_template.py --apply",
            basis="executed"))


def _expected_email(project_name, folder):
    """The git identity this workspace expects, or None when it has no opinion.

    This used to hardcode `brad+<Project>@inunu.net` and BLOCK BOOT on any other
    value. That is one operator's plus-addressing convention asserted as a law of
    the harness, and it made every fresh workspace unbootable for anyone else:
    the panel demanded an address the operator had never chosen and could not be
    talked out of. Measured by execution/fleet_acceptance.py step 3, which halted
    on 'expected brad+FleetAcceptanceWS@inunu.net'.

    The convention is now OPT-IN, read from .agent/profile.json's
    `git_email_pattern` (a format string taking {stem}). No pattern declared
    means no expectation, which means no halt -- a workspace that has a real,
    non-empty git identity is identified well enough to boot.
    """
    stem = re.sub(r"[^0-9A-Za-z]", "", project_name or folder)
    pattern = None
    try:
        with open(PROFILE_REL) as f:
            pattern = (json.load(f) or {}).get("git_email_pattern")
    except Exception:
        pattern = None
    if not pattern or not isinstance(pattern, str):
        return None
    try:
        return pattern.format(stem=stem)
    except Exception:
        # A malformed pattern is a workspace that cannot state its own rule.
        # Do not invent one on its behalf, and do not halt over it.
        return None


def _collect_git(root, workspace, checks):
    porcelain = _git(root, "status", "--porcelain")
    email = _git(root, "config", "user.email")
    expected = _expected_email(workspace["project_name"], workspace["folder"])
    git = {
        "remote": _git(root, "config", "--get", "remote.origin.url") or "none",
        "branch": _git(root, "rev-parse", "--abbrev-ref", "HEAD") or UNKNOWN,
        "email": email or None,
        "expected_email": expected,
        "clean": porcelain == "" if porcelain is not None else None,
        "dirty_files": len(porcelain.splitlines()) if porcelain else 0,
    }
    if not email:
        # No git identity at all is a real problem: commits would be
        # unattributable. This halts regardless of any naming convention.
        checks.append(_check(
            "identity.git_email", "identity", "fail",
            "git user.email is unset — commits from this workspace would be "
            "unattributable — run: git config user.email <you@example.com>",
            True, "git config user.email <you@example.com>", basis="executed"))
    elif expected and email != expected:
        # Only reachable when the workspace itself declared a pattern, so this
        # is the workspace's own rule being enforced, not the harness's.
        checks.append(_check(
            "identity.git_email", "identity", "fail",
            f"git user.email is '{_s(email)}', but this workspace's declared "
            f"git_email_pattern expects '{expected}' — "
            f"run: git config user.email {expected}",
            True, f"git config user.email {expected}", basis="executed"))
    return git


def _collect_quota(root, checks):
    """Read the quota oracle. The workspace's own copy is preferred so a fixture
    exercises the code it ships rather than the harness's.

    A quota reading the panel could not determine is NOT a reading it may
    present as fine. An oracle that is missing, unexecutable, times out or emits
    something other than a JSON object is a broken oracle and blocks; an oracle
    that RAN and honestly answered "unknown" blocks too, unless the reason is a
    limitation nobody can clear (see QUOTA_INHERENT_REASONS), which is reported
    as the third verdict and does not halt.
    """
    script = root / "execution" / "quota.py"
    if not script.is_file():
        script = Path(__file__).resolve().parent / "quota.py"
    quota = {"state": UNKNOWN, "used_pct": UNKNOWN, "available_pct": UNKNOWN,
             "resets_in": UNKNOWN, "band": UNKNOWN, "reason": "oracle_unavailable"}
    if not script.is_file():
        _check_quota_oracle(checks, "execution/quota.py is missing")
        return quota
    try:
        proc = subprocess.run(
            [sys.executable, str(script), "status", "--json",
             "--mirror-path", str(root / QUOTA_MIRROR_REL)],
            cwd=str(root), timeout=NETWORK_TIMEOUT_SECONDS,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
        status = json.loads(proc.stdout)
    except subprocess.TimeoutExpired:
        _check_quota_oracle(
            checks, f"execution/quota.py did not answer within "
                    f"{NETWORK_TIMEOUT_SECONDS}s")
        return quota
    except (OSError, subprocess.SubprocessError):
        _check_quota_oracle(checks, "execution/quota.py could not be executed")
        return quota
    except (json.JSONDecodeError, ValueError):
        _check_quota_oracle(checks, "execution/quota.py did not emit valid JSON")
        return quota
    if not isinstance(status, dict):
        _check_quota_oracle(checks, "execution/quota.py emitted JSON that is not an object")
        return quota
    used = status.get("used_pct")
    secs = status.get("seconds_to_reset")
    quota.update({
        "state": status.get("state", UNKNOWN),
        "used_pct": used if used is not None else UNKNOWN,
        "available_pct": (100 - used) if isinstance(used, int) else UNKNOWN,
        "resets_in": f"{secs / 3600.0:.1f}h" if isinstance(secs, (int, float)) else UNKNOWN,
        "band": status.get("band", UNKNOWN),
        "reason": status.get("reason"),
    })
    _check_quota_reading(checks, quota)
    return quota


def _check_quota_oracle(checks, detail):
    """The oracle itself is broken — a quota nobody can read is not a healthy one."""
    checks.append(_check(
        "quota.oracle", "quota", "fail",
        f"{detail} — the quota reading cannot be verified", True,
        "restore execution/quota.py (python3 execution/quota.py status --json)",
        basis="parsed"))


def _check_quota_reading(checks, quota):
    """The oracle answered. Grade the ANSWER, not the fact that it replied."""
    state, reason = quota.get("state"), quota.get("reason")
    if state == "ok" and quota.get("band") != UNKNOWN:
        return
    if state == UNKNOWN and reason in QUOTA_INHERENT_REASONS:
        checks.append(_check(
            "quota.state", "quota", UNKNOWN,
            f"quota is unreadable in this session ({reason}) — an inherent "
            "limitation, not workspace drift", False, basis="parsed"))
        return
    if state == "partial":
        checks.append(_check(
            "quota.state", "quota", "warn",
            f"quota mirror is partial — used {_s(quota.get('used_pct'))}% is known "
            "but the reset time and band are not", False,
            "the mirror is rewritten in full on the next statusline refresh",
            basis="parsed"))
        return
    checks.append(_check(
        "quota.state", "quota", "fail",
        f"quota state is '{_s(state)}' (reason {_s(reason)}) and band is "
        f"'{_s(quota.get('band'))}' — an undetermined quota is not a healthy quota",
        True,
        f"the mirror at {QUOTA_MIRROR_REL} is rewritten by the UserPromptSubmit "
        "hook (execution/hooks/inject_pressure.sh) — a stale or missing one "
        "means that hook is not running", basis="parsed"))


def _collect_context(root):
    """The mirror is written by UserPromptSubmit, so at SessionStart it holds the
    PREVIOUS session's reading. It is never presented as this session's."""
    data, _err = _load_json(root / CONTEXT_MIRROR_REL)
    if not isinstance(data, dict):
        return {"pct": UNKNOWN, "tokens": None, "window": None, "captured_at": None,
                "age_seconds": UNKNOWN, "fresh_session": True}
    captured = _parse_iso(data.get("captured_at"))
    age = (_now() - captured).total_seconds() if captured else None
    return {
        "pct": data.get("pct", UNKNOWN),
        "tokens": data.get("tokens"),
        "window": data.get("window"),
        "captured_at": data.get("captured_at"),
        "age_seconds": int(age) if age is not None else UNKNOWN,
        "fresh_session": age is None or age > CONTEXT_SESSION_STALE_SECONDS,
    }


def _parse_manifest(path):
    """Parse `.agent/delivery-manifest.yaml` without a YAML dependency.

    The manifest is DECLARED, never derived from the tree it measures: an
    expectation regenerated from the artifact under test inherits that
    artifact's mutations, so a deleted rule would delete its own expectation.
    """
    text = _read_text(path)
    if text is None:
        return None
    manifest, key = {}, None
    for line in text.splitlines():
        head = re.match(r"^(\w[\w-]*):\s*$", line)
        if head:
            key = head.group(1)
            manifest[key] = []
            continue
        item = re.match(r"^\s+-\s*(\S+)\s*$", line)
        if item and key:
            manifest[key].append(item.group(1))
    return manifest or None


def _collect_classes(root, manifest, checks):
    classes = {}
    for cls in CLASSES:
        present = _md_names(root / CLASS_DIRS[cls])
        declared = manifest.get(cls) if manifest else None
        source = "manifest" if declared is not None else "canonical"
        expected = declared if declared is not None else present
        missing = [n for n in expected if n not in present]
        classes[cls] = {
            "canonical": len(present), "expected": len(expected), "source": source,
            "present": present, "missing": missing,
            "extra": [n for n in present if n not in expected],
        }
        if missing:
            checks.append(_check(
                f"delivery.canonical.{cls}", "delivery", "fail",
                f"canonical {cls} short {len(present)}/{len(expected)} — missing: "
                + ", ".join(missing),
                True, f"restore {CLASS_DIRS[cls]}/ or run: make delivery-manifest ACCEPT=1",
                basis="present"))
    return classes


def _declared_surfaces(root):
    """Every delivery surface each provider DECLARES, read from its manifest.

    Yields (provider, {class: dir}, agents_manifest_or_None) sorted by provider
    id. A provider that declares no `<class>_dir` reads AGENTS.md natively, so
    it is not a delivery target — the same rule execution/sync_rules.sh states
    in its own comment and has always enumerated by. `agents_manifest` is the
    second shape a declaration can take: antigravity is served by a JSON
    manifest it registers subagents from, not by a markdown tree it has no
    loader for.
    """
    surfaces = []
    providers_dir = root / PROVIDERS_DIR_REL
    if not providers_dir.is_dir():
        return surfaces
    for path in sorted(providers_dir.glob("*.json")):
        doc, _err = _load_json(path)
        if not isinstance(doc, dict):
            continue
        dirs = {}
        for cls in CLASSES:
            declared = doc.get(f"{cls}_dir")
            if isinstance(declared, str) and declared:
                dirs[cls] = declared
        manifest_rel = doc.get("agents_manifest")
        manifest_rel = manifest_rel if isinstance(manifest_rel, str) and manifest_rel else None
        if dirs or manifest_rel:
            surfaces.append((doc.get("provider") or path.stem, dirs, manifest_rel))
    return surfaces


def _collect_agents_manifest(root, pname, rel, manifest, checks):
    """A provider's agents MANIFEST — the surface a JSON-fed provider really has.

    The expected set is the DECLARED one (.agent/delivery-manifest.yaml). Read
    back out of the artifact under test it would agree with every mutation of
    it, so a dropped agent would delete its own expectation.
    """
    declared = [n[:-3] if n.endswith(".md") else n
                for n in ((manifest or {}).get("agents") or [])]
    data, error = _load_json(root / rel)
    entries = data if isinstance(data, list) else []
    names = sorted(str(e.get("name")) for e in entries if isinstance(e, dict) and e.get("name"))
    missing = [n for n in declared if n not in names]
    result = {"path": rel, "present": len(names), "expected": len(declared),
              "names": names, "missing": missing, "error": error,
              "aligned": bool(declared) and not missing and isinstance(data, list)}
    if not declared:
        # Nothing declared to measure against; reporting a count nobody chose
        # would be a denominator invented by the panel.
        result["aligned"] = True
        return result
    if not isinstance(data, list):
        checks.append(_check(
            f"delivery.{pname}.agents_manifest", "delivery", "fail",
            f"{pname} agents manifest {rel} is not readable as a list ({error or 'wrong shape'})",
            True, "make sync-agents", basis="parsed"))
    elif missing:
        checks.append(_check(
            f"delivery.{pname}.agents_manifest", "delivery", "fail",
            f"{pname} agents manifest {len(names)}/{len(declared)} — missing: "
            + ", ".join(missing),
            True, "make sync-agents", basis="parsed"))
    return result


def _collect_providers(root, classes, manifest, checks):
    """Count exactly the surfaces the providers DECLARE — never a fixed product.

    A phantom cell (a provider x class pair nobody reads) emits a blocking check
    whose printed remedy cannot clear it, because no sync target writes there.
    Enumerating the declaration instead keeps the counter and the writer on the
    same list: a provider added to .agent/providers/ becomes visible here with
    no edit to this file.
    """
    providers, worst = [], None
    for pname, dirs, manifest_rel in _declared_surfaces(root):
        declared_paths = list(dirs.values()) + ([manifest_rel] if manifest_rel else [])
        pdir = declared_paths[0].split("/")[0]
        if not (root / pdir).is_dir():
            continue
        entry = {"provider": pname, "dir": pdir, "classes": {}, "aligned": True}
        for cls in CLASSES:
            dest = dirs.get(cls)
            if not dest:
                continue
            canonical = classes[cls]["present"]
            present = _md_names(root / dest)
            missing = [n for n in canonical if n not in present]
            entry["classes"][cls] = {
                "present": len(present), "expected": len(canonical), "dir": dest,
                "files": present, "missing": missing,
            }
            if missing:
                entry["aligned"] = False
                short = f"{pname} {cls} {len(present)}/{len(canonical)}"
                if worst is None or len(missing) > worst["missing_count"]:
                    worst = {"provider": pname, "class": cls, "summary": short,
                             "missing": missing, "missing_count": len(missing)}
                checks.append(_check(
                    f"delivery.{pname}.{cls}", "delivery", "fail",
                    f"{short} — missing: " + ", ".join(missing),
                    True, "make sync", basis="present"))
        if manifest_rel:
            found = _collect_agents_manifest(root, pname, manifest_rel, manifest, checks)
            entry["manifest"] = found
            if not found["aligned"]:
                entry["aligned"] = False
                short = f"{pname} agents manifest {found['present']}/{found['expected']}"
                count = len(found["missing"]) or 1
                if worst is None or count > worst["missing_count"]:
                    worst = {"provider": pname, "class": "agents_manifest",
                             "summary": short, "missing": found["missing"],
                             "missing_count": count}
        providers.append(entry)
    summary = {
        "installed": len(providers),
        "aligned": all(p["aligned"] for p in providers),
        "worst": worst,
    }
    return providers, summary


def _registered_hooks(root):
    """Hooks are counted by REGISTRATION — a hook nobody registers never runs."""
    data, _err = _load_json(root / CLAUDE_SETTINGS_REL)
    names = set()
    if not isinstance(data, dict):
        return names
    for entries in (data.get("hooks") or {}).values():
        for matcher in entries if isinstance(entries, list) else []:
            for hook in (matcher or {}).get("hooks") or []:
                names.update(HOOK_SCRIPT_RE.findall(str(hook.get("command", ""))))
    return names


def _collect_hooks(root, manifest, checks):
    registered = _registered_hooks(root)
    hooks_dir = root / HOOKS_DIR_REL
    on_disk = sorted(p.name for p in hooks_dir.glob("*.sh")) if hooks_dir.is_dir() else []
    declared = manifest.get("hooks") if manifest else None
    source = "manifest" if declared is not None else "canonical"
    expected = declared if declared is not None else sorted(registered)
    missing = [n for n in expected if n not in registered]
    hooks = {
        "registered": len(registered), "expected": len(expected), "on_disk": len(on_disk),
        "source": source, "registered_names": sorted(registered), "on_disk_names": on_disk,
        "missing": missing,
        "unregistered": [n for n in on_disk if n not in registered],
    }
    if missing:
        checks.append(_check(
            "delivery.hooks", "delivery", "fail",
            f"registered hooks {len(registered)}/{len(expected)} — not registered: "
            + ", ".join(missing),
            True, f"register the hook in {CLAUDE_SETTINGS_REL}", basis="present"))
    hooks.update(_probe_hooks_function(root, checks))
    return hooks


def _probe_hooks_function(root, checks):
    """Registration is a COUNT; this is the question the count cannot answer:
    does the wired command actually decide anything (F19/F18, notes-f19.md
    §0)? Every registered hook's function bucket is reported here, and a hook
    the probe found DEAD or UNDISCRIMINATING is a blocking finding — a dead
    enforcement layer is not a warning.
    """
    buckets = {name: [] for name in hook_probe.RESULTS} if hook_probe else {}
    if hook_probe is None:
        # The probe was never delivered to this workspace; nothing here can
        # be proven to function, so every registration is honestly unprobed
        # rather than assumed ok.
        checks.append(_check(
            "delivery.hooks_coverage", "delivery", "warn",
            "execution/hook_probe.py is not delivered here — no registration "
            "in this workspace has been executed, so none of them is known to "
            "decide anything", False,
            "deliver execution/hook_probe.py (make update-template)",
            basis="present"))
        return {"function_verified": 0, "dead": 0, "undiscriminating": 0,
                "unprobed": 0, "unvouched": 0, "inert": 0,
                "enforcement_registered": 0, "enforcement_declared": 0,
                "enforcement_undeclared": [], "probe_missing": True}
    doc = hook_probe.probe_workspace(root)
    for entry in doc.get("probes") or []:
        result = entry.get("result")
        buckets.setdefault(result, []).append(entry.get("script"))
    coverage = doc.get("coverage") or {}
    registered = coverage.get("enforcement_registered", 0)
    declared = coverage.get("enforcement_declared", 0)
    undeclared = coverage.get("undeclared") or []
    measured = f"enforcement registrations declared {declared}/{registered}"

    broken = buckets.get("dead", []) + buckets.get("undiscriminating", [])
    if broken:
        # One script can carry several registrations (check_autonomy is wired
        # on Write, Edit and Bash). Naming it once and counting the wirings
        # reads; naming it three times buries the other twelve scripts.
        named = sorted({f"{n} ({r})" for r in ("dead", "undiscriminating")
                        for n in buckets.get(r, [])})
        checks.append(_check(
            "delivery.hooks_function", "delivery", "fail",
            f"{len(broken)} registration(s) do not function as registered: "
            + ", ".join(named)
            + f" [{measured}]",
            True,
            "execute the registration string (python3 execution/hook_probe.py "
            "--root . --json) and repair the wrapper it names",
            basis="executed"))
    if undeclared:
        # `unprobed` reads as healthy — the halt above fires on dead and
        # undiscriminating only. So an enforcement registration nobody declared
        # is a hole in exactly the instrument built to end holes, and it warns
        # rather than passing in silence. It does NOT halt: every workspace
        # that has not yet written declarations would be unbootable, which is
        # the lockout this module exists to avoid.
        checks.append(_check(
            "delivery.hooks_coverage", "delivery", "warn",
            f"{measured} — never executed, so never proven to decide anything: "
            + ", ".join(undeclared), False,
            f"declare them in {PROBE_DECLARATIONS_REL}", basis="parsed"))
    unvouched = buckets.get("unvouched", [])
    if unvouched:
        # A declared script wired in a shape the probe will not execute. It is
        # not measured, and the registration is not what the harness ships.
        checks.append(_check(
            "delivery.hooks_unvouched", "delivery", "warn",
            "registrations wired in a shape the probe refuses to execute, so "
            "they were NOT measured: " + ", ".join(str(n) for n in unvouched),
            False, f"restore the registration to `[ -f X ] && bash X || exit 0` "
                   f"in {CLAUDE_SETTINGS_REL}", basis="parsed"))
    return {
        "function_verified": len(buckets.get("ok", [])),
        "dead": len(buckets.get("dead", [])),
        "undiscriminating": len(buckets.get("undiscriminating", [])),
        "unprobed": len(buckets.get("unprobed", [])),
        "unvouched": len(unvouched),
        "inert": len(buckets.get("inert", [])),
        "enforcement_registered": registered,
        "enforcement_declared": declared,
        "enforcement_undeclared": undeclared,
        "probe_missing": False,
    }


def _athanor_update(root, version):
    """The single NON-BLOCKING essential (REQUIREMENTS 5.2/5.3).

    Stable is asserted by the publisher: `/releases/latest` excludes drafts and
    prereleases by definition, so nothing is inferred from a version substring.
    """
    local = _version_label(version)
    if os.environ.get("ATHANOR_PANEL_NO_NET") == "1":
        return "unknown", f"update check skipped (offline), local {local}"
    rc, out = _run(
        ["gh", "api", f"repos/{RELEASE_REPO}/releases/latest", "--jq", ".tag_name"],
        cwd=root, timeout=NETWORK_TIMEOUT_SECONDS)
    if rc != 0 or not out:
        return "unknown", f"no stable channel published yet, local {local}"
    latest = out.strip().lstrip("v")
    if latest == str(version):
        return "ok", f"up to date ({local})"
    return "unknown", f"local {local}, latest stable v{latest}"


def _collect_essential(root, version, checks):
    essential = []
    status, detail = _athanor_update(root, version)
    essential.append({"name": "Athanor", "kind": "update", "status": status,
                      "detail": detail, "blocking": False, "fix": "make update-template"})

    rc, _out = _run(["curl", "-s", "--max-time", "2", "-o", "/dev/null", ALEMBIC_URL],
                    cwd=root, timeout=NETWORK_TIMEOUT_SECONDS)
    essential.append({
        "name": "Alembic", "kind": "service", "status": "ok" if rc == 0 else "fail",
        "detail": f"{ALEMBIC_URL} responds" if rc == 0 else f"{ALEMBIC_URL} unreachable",
        "blocking": True, "fix": "start Alembic (it must answer on localhost:7077)"})

    rc, _out = _run(["gh", "auth", "status"], cwd=root, timeout=NETWORK_TIMEOUT_SECONDS)
    essential.append({
        "name": "gh", "kind": "auth", "status": "ok" if rc == 0 else "fail",
        "detail": "authenticated" if rc == 0 else "not authenticated",
        "blocking": True, "fix": "gh auth login"})

    for item in essential:
        if item["status"] == "fail":
            checks.append(_check(
                f"essential.{item['name'].lower()}", "essential", "fail",
                f"{item['name']}: {item['detail']}", item["blocking"], item["fix"],
                basis="executed"))
    return essential


def _write_stack_cache(root, cache):
    """Persist the probe cache ATOMICALLY. Returns an error string, or None.

    Nothing wrote this file before, which is why `make boot-report REFRESH=1`
    was inert: it ran at rc=0 and left the paid probe exactly as unreadable as
    it found it. A half-written cache reads as no cache at all, so it is
    renamed into place rather than written in situ.
    """
    path = root / STACK_CACHE_REL
    handle, temp_name = None, None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temp_name = tempfile.mkstemp(
            prefix=".stack_probes.", suffix=".tmp", dir=str(path.parent))
        handle = os.fdopen(descriptor, "w")
        handle.write(json.dumps(cache, indent=2) + "\n")
        handle.close()
        handle = None
        os.replace(temp_name, str(path))
    except OSError as exc:
        if handle is not None:
            handle.close()
        if temp_name and os.path.exists(temp_name):
            try:
                os.unlink(temp_name)
            except OSError:
                pass
        return f"{exc.__class__.__name__}: {exc}"
    return None


def _refresh_paid_probe(name, probe, root, cache):
    """Run a cost:network-paid probe DELIBERATELY and record the reading.

    Boot never takes this path — `--refresh` is the operator asking for it by
    name, which is the entire content of the remedy the panel prints. The
    reading is cached so the next boot reads it instead of spending again.
    """
    command = probe.get("command")
    if not command:
        return {"status": "fail", "rc": None, "detail": "probe has no command",
                "ts": _now().timestamp()}
    rc, out = _run(command, cwd=root, shell=True,
                   timeout=probe.get("timeout", PROBE_TIMEOUT_SECONDS))
    entry = {"status": "ok" if rc == probe.get("expect_rc", 0) else "fail",
             "rc": rc, "detail": out, "ts": _now().timestamp()}
    cache[name] = entry
    _write_stack_cache(root, cache)
    return entry


def _probe_entry(name, probe, root, cache, refresh=False):
    """Resolve one tech-stack entry to (status, detail, blocking, fix, note).

    Unverifiable is indistinguishable from missing, so an entry with no probe
    HALTS; `verify: manual` is the committed, reviewable escape hatch. A
    cost:network-paid probe is NEVER executed here — boot must not spend money,
    and a cached reading is never presented as a live one.

    `note` is the provenance the COMPACT rendering must carry. The compact line
    shows a glyph per entry, so without it a reading recovered from a day-old
    cache renders exactly like one probed a second ago — which is the same
    class of lie as the stale context mirror. The renderer prints the note; it
    does not decide what the note says.
    """
    if probe is None:
        return ("fail", f"{name}: no probe defined — unverifiable is not verified", True,
                f"add a probe to {STACK_REGISTRY_REL} or declare verify: manual", None)
    if probe.get("verify") == "manual":
        return ("warn", f"{name}: operator-declared manual verification", False, None,
                "manual")
    if probe.get("cost") == "network-paid":
        entry = cache.get(name) if isinstance(cache, dict) else None
        ttl = probe.get("ttl_seconds", DEFAULT_PROBE_TTL_SECONDS)
        ts = entry.get("ts") if isinstance(entry, dict) else None
        age = (_now().timestamp() - ts) if isinstance(ts, (int, float)) else None
        stale = (age is None or age > ttl or not isinstance(entry, dict)
                 or entry.get("status") != "ok")
        if stale and refresh:
            entry = _refresh_paid_probe(name, probe, root, cache)
            if entry.get("status") != "ok":
                return ("fail",
                        f"{name}: paid probe failed on refresh (rc={entry.get('rc')}) "
                        f"{entry.get('detail') or ''}".strip(), True,
                        f"fix the {probe.get('kind', 'dependency')} '{name}' "
                        "or update its probe", None)
            return ("ok", f"{name}: ok (refreshed just now)", False, None, "refreshed")
        if stale:
            return ("fail", f"{name}: no fresh cached reading (paid probe, never run at boot)",
                    True, "make boot-report REFRESH=1", "no fresh cache")
        cached = f"cached {_age_words(age)} ago"
        return ("ok", f"{name}: ok ({cached})", False, None, cached)
    command = probe.get("command")
    if not command:
        return ("fail", f"{name}: probe has no command", True,
                f"give '{name}' a command in {STACK_REGISTRY_REL}", None)
    rc, out = _run(command, cwd=root, shell=True,
                   timeout=probe.get("timeout", PROBE_TIMEOUT_SECONDS))
    if rc == probe.get("expect_rc", 0):
        return ("ok", f"{name}: ok", False, None, None)
    return ("fail", f"{name}: probe failed (rc={rc}) {out}".strip(), True,
            f"fix the {probe.get('kind', 'dependency')} '{name}' or update its probe", None)


def _collect_tech_stack(root, profile, checks, refresh=False):
    registry, _err = _load_json(root / STACK_REGISTRY_REL)
    cache, _err2 = _load_json(root / STACK_CACHE_REL)
    registry = registry if isinstance(registry, dict) else {}
    cache = cache if isinstance(cache, dict) else {}
    stack = []
    for raw in (profile or {}).get("tech_stack") or []:
        if isinstance(raw, dict):
            name, probe = raw.get("id") or UNKNOWN, raw
        else:
            name, probe = str(raw), registry.get(str(raw))
        status, detail, blocking, fix, note = _probe_entry(
            name, probe, root, cache, refresh)
        stack.append({"name": name, "kind": (probe or {}).get("kind", UNKNOWN),
                      "cost": (probe or {}).get("cost", "local"), "status": status,
                      "detail": detail, "note": note})
        if status in ("fail", "warn"):
            checks.append(_check(f"stack.{name}", "stack", status, detail, blocking, fix,
                                 basis="executed"))
    return stack


def _collect_mission(root):
    active, _err = _load_json(root / ACTIVE_MISSION_REL)
    active = active if isinstance(active, dict) else {}
    path = active.get("mission")
    checkpoint = active.get("checkpoint")
    if isinstance(checkpoint, dict):
        label = "/".join(str(checkpoint.get(k)) for k in ("milestone", "feature")
                         if checkpoint.get(k))
    else:
        label = checkpoint if isinstance(checkpoint, str) else None
    # active.json may carry a status, but the mission FILE's frontmatter is the
    # thing `mission.py` maintains — and G-5's close_out/blocked exemption is
    # decided on that status, so reading only the pointer would exempt nothing.
    status = active.get("status")
    if status is None and path:
        frontmatter = mission_frontmatter(root / path) or {}
        status = frontmatter.get("status")
    return active, {
        "slug": Path(path).stem if path else None,
        "path": path,
        "checkpoint": label or None,
        "status": status,
    }


def _collect_backlog(root):
    text = _read_text(root / BACKLOG_REL) or ""
    top = []
    for line in text.splitlines():
        match = BACKLOG_ITEM_RE.match(line)
        if match and len(top) < BACKLOG_TOP_N:
            top.append(f"{match.group(1)} {match.group(2)}".strip())
    return {"top": top}


def mission_frontmatter(path):
    """The YAML frontmatter of one athanor.mission/v1 file, or None.

    Public because the mission corpus has a second reader: the SessionEnd
    telemetry hook counts features completed in the session window from these
    same files, and two parsers of one file format is one too many.

    Never raises: a mission file that will not parse is one the corpus does not
    contribute to, not a reason for the panel to fall over at SessionStart.
    """
    text = _read_text(path)
    if not text or not text.startswith("---"):
        return None
    match = re.match(r"^---\s*\n(.*?)\n---\s*(?:\n|$)", text, re.S)
    if not match:
        return None
    try:
        import yaml
    except ImportError:
        return None
    try:
        data = yaml.safe_load(match.group(1))
    except Exception:  # noqa: BLE001 — any parse failure is "not a data point"
        return None
    return data if isinstance(data, dict) else None


def _percentile(values, fraction):
    """Linear-interpolated percentile over an ascending list. None when empty."""
    if not values:
        return None
    position = (len(values) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(values) - 1)
    weight = position - low
    return values[low] * (1 - weight) + values[high] * weight


def _feature_durations(root):
    """Minutes per completed feature, over the whole mission corpus.

    REQUIREMENTS 5.4 names `session_usage.jsonl` as the telemetry source, but
    that row has no features-completed field, so no per-feature rate can be
    derived from it (DECISIONS G-1). The corpus does carry `started_at` and
    `completed_at` on each feature, so it is what the estimate is measured
    from — and the corpus is read, never the panel's own guesses.
    """
    directory = root / MISSIONS_DIR_REL
    if not directory.is_dir():
        return []
    durations = []
    for path in sorted(directory.glob("*.md")):
        text = _read_text(path)
        # Cheap reject before paying for a YAML parse of 150+ mission files.
        if not text or "completed_at" not in text:
            continue
        frontmatter = mission_frontmatter(path)
        for feature in (frontmatter or {}).get("features") or []:
            if not isinstance(feature, dict):
                continue
            started = _parse_iso(str(feature.get("started_at") or ""))
            completed = _parse_iso(str(feature.get("completed_at") or ""))
            if started is None or completed is None:
                continue
            minutes = (completed - started).total_seconds() / 60.0
            if minutes >= 0:
                durations.append(minutes)
    durations.sort()
    return durations


def _collect_estimate(root, mission):
    """A p25-p75 RANGE with n, or nothing at all.

    Absent until the active mission has a feature list to size, and absent
    while the corpus is too small to support a range — an estimate nobody
    measured is worse than no estimate. Never a point estimate: measured over
    this corpus the mean runs several times the median, so a single number
    misrepresents the distribution it came from (DECISIONS G-3).
    """
    path = mission.get("path")
    frontmatter = mission_frontmatter(root / path) if path else None
    features = (frontmatter or {}).get("features") or []
    remaining = sum(1 for f in features if isinstance(f, dict)
                    and f.get("status") not in ("done", "skipped"))
    if not remaining:
        return None
    durations = _feature_durations(root)
    if len(durations) < ESTIMATE_MIN_SAMPLES:
        return None
    p25, p75 = _percentile(durations, 0.25), _percentile(durations, 0.75)
    median = _percentile(durations, 0.5)
    mean = sum(durations) / len(durations)
    skewed = bool(median) and mean > ESTIMATE_SKEW_RATIO * median
    low, high = int(round(remaining * p25)), int(round(remaining * p75))
    tail = ", skewed" if skewed else ""
    return {
        "remaining_features": remaining,
        "low_minutes": low,
        "high_minutes": high,
        "p25_minutes": round(p25, 1),
        "median_minutes": round(median, 1),
        "p75_minutes": round(p75, 1),
        "mean_minutes": round(mean, 1),
        "n": len(durations),
        "skewed": skewed,
        "source": "mission corpus (features carrying started_at and completed_at)",
        "text": (f"{remaining} feature(s) remaining → {low}–{high} min "
                 f"(p25–p75, n={len(durations)}{tail})"),
    }


def _running_provider():
    provider = os.environ.get("ATHANOR_PROVIDER")
    if provider:
        return provider
    return "claude-code" if os.environ.get("CLAUDECODE") == "1" else UNKNOWN


def _collect_autonomy(root, profile, active, mission, checks):
    """Per-mission first, workspace default only as a recommendation source.

    Three things this has to get right, each of which was a measured defect:

    1. A stored level the dialect does not recognise is a defect, not a value.
       autonomy.normalize() returns None precisely so the caller reports it. An
       unrecognised level rendered as "unknown" with no failing check lets a
       workspace run with nobody able to say what it is allowed to do.
    2. The mission's OWN record is the authority, and its absence is not an
       invitation to inherit the last mission's level. The workspace default is
       offered as a RECOMMENDATION and nothing more (REQUIREMENTS 6).
    3. Only the RUNNING provider's cap is evaluated. A provider that is not
       running cannot be made to honour anything by any action the operator can
       take, so naming it is unclearable noise (D7) — and a warning that can
       never be cleared teaches the operator to stop reading the panel.
    """
    record = active.get("autonomy") if isinstance(active.get("autonomy"), dict) else None
    default_raw = ((profile or {}).get("autonomy") or {}).get("level")
    # `"level" in record`, not `record.get("level")`: a record carrying an empty
    # or null level is a mission that HAS a (broken) decision, and falling back
    # to the profile there is how an unreadable value disappears silently.
    if record is not None and "level" in record:
        raw, source = record.get("level"), "mission"
        decided = bool(record.get("decided_at"))
    else:
        record = record or {}
        raw = default_raw
        source, decided = ("profile-default" if raw is not None else "none"), False
    level = autonomy_dialect.normalize(raw)
    if raw is not None and level is None:
        checks.append(_check(
            "autonomy.level", "autonomy", "fail",
            f"autonomy level '{_s(raw)}' (source {source}) is not a recognised "
            f"level — expected one of {', '.join(autonomy_dialect.LEVELS)}", True,
            "set a recognised level with: python3 execution/set_autonomy.py "
            "--level <interactive|autonomous|loop> --mission", basis="parsed"))

    _check_autonomy_decision(mission, level, raw, source, decided, checks)
    provider, cap_raw, cap = _check_provider_cap(root, level, checks)

    return {
        "level": level or UNKNOWN,
        "raw_level": raw,
        "source": source,
        "decided": decided,
        "decided_at": record.get("decided_at"),
        "decided_by": record.get("decided_by"),
        "mission": mission.get("slug"),
        "running_provider": provider,
        "provider_cap": cap or (UNKNOWN if cap_raw is not None else None),
        "provider_cap_raw": cap_raw,
    }


def _check_autonomy_decision(mission, level, raw, source, decided, checks):
    """THE DECISION GATE — REQUIREMENTS 6: an undecided mission does not start.

    A level without a `decided_at` stamp is a level nobody chose for THIS
    mission: either it was inherited from the workspace default or it was
    written by hand. The panel recommends CONTINUE at that level and names it;
    the operator confirms. It is never resolved by proceeding.

    G-5: `close_out` and `blocked` missions are exempt. No work is starting, so
    no autonomy decision is required, and halting them would make the one
    command that clears a blocked mission unreachable.
    """
    if decided or not mission.get("path"):
        return
    if (mission.get("status") or "") in DECISION_EXEMPT_STATUSES:
        return
    previous = level or (raw if isinstance(raw, str) and raw else None)
    if previous:
        recommendation = (f"RECOMMEND continuing at '{previous}' (from "
                          f"{source}) — confirm it before the mission starts")
        fix = ("confirm with: python3 execution/set_autonomy.py --level "
               f"{previous} --mission")
    else:
        recommendation = ("RECOMMEND choosing a level — confirm one before the "
                          "mission starts")
        fix = ("choose one with: python3 execution/set_autonomy.py --level "
               "<interactive|autonomous|loop> --mission")
    checks.append(_check(
        "autonomy.undecided", "autonomy", "fail",
        f"mission '{_s(mission.get('slug'))}' has no autonomy decision "
        f"(active.json carries no decided_at) — REQUIREMENTS 6: a mission is "
        f"never silently resumed. {recommendation}.", True, fix, basis="parsed"))


def _check_provider_cap(root, level, checks):
    """The RUNNING provider's cap, and only that one. Returns (name, raw, cap).

    An unrecognised cap fails rather than degrading to "unknown": a cap nobody
    can read is not a cap that permits anything, which is the same rule the
    level itself follows. A provider with no manifest (including the `unknown`
    running provider) caps nothing — there is no declaration to enforce.
    """
    provider = _running_provider()
    provider_doc, _err = _load_json(root / ".agent" / "providers" / f"{provider}.json")
    cap_raw = autonomy_dialect.provider_cap(provider_doc)
    cap = autonomy_dialect.normalize(cap_raw)
    if cap_raw is not None and cap is None:
        checks.append(_check(
            "autonomy.provider_cap", "autonomy", "fail",
            f"running provider '{provider}' declares "
            f"{autonomy_dialect.CAP_KEY}='{_s(cap_raw)}', which is not a "
            f"recognised level — the cap cannot be enforced and must not be "
            f"assumed permissive", True,
            f"fix {autonomy_dialect.CAP_KEY} in .agent/providers/{provider}.json",
            basis="parsed"))
    elif cap is not None and level is not None and autonomy_dialect.exceeds_cap(level, cap):
        checks.append(_check(
            "autonomy.provider_cap", "autonomy", "fail",
            f"running provider '{provider}' honours at most '{cap}' "
            f"({autonomy_dialect.CAP_KEY}={_s(cap_raw)}) but this mission's "
            f"autonomy level is '{level}' — the level cannot be honoured here",
            True,
            f"lower the level (python3 execution/set_autonomy.py --level {cap} "
            f"--mission) or run the mission under a provider that honours it",
            basis="parsed"))
    return provider, cap_raw, cap


def collect(root, refresh=False):
    """Build the athanor.bootpanel/v1 document. The ONLY computation.

    `refresh` is the operator asking, by name, for the cost:network-paid probes
    to be run and cached. Boot never sets it — a panel that spends money to
    render itself is not a status panel.
    """
    root = Path(root).resolve()
    checks = []
    profile, profile_error = _load_json(root / PROFILE_REL)
    profile = profile if isinstance(profile, dict) else None
    workspace = _collect_workspace(root, profile, profile_error, checks)
    manifest = _parse_manifest(root / MANIFEST_REL)
    classes = _collect_classes(root, manifest, checks)
    providers, provider_summary = _collect_providers(root, classes, manifest, checks)
    hooks = _collect_hooks(root, manifest, checks)
    active, mission = _collect_mission(root)
    scope_name = workspace["project_name"] or workspace["folder"]
    doc = {
        "schema": SCHEMA,
        "collected_at": _iso(_now()),
        "counts_scope": f"{scope_name} workspace ({root})",
        "workspace": workspace,
        "agreement": {
            "agent_name": workspace["agent_name"],
            "archetype": workspace["archetype"],
            "address_user_as": _read_address_as(root),
            "mission": _read_mission(root),
        },
        "git": _collect_git(root, workspace, checks),
        "quota": _collect_quota(root, checks),
        "context": _collect_context(root),
        "delivery": {
            "manifest_present": manifest is not None,
            "classes": classes,
            "providers": providers,
            "provider_summary": provider_summary,
            "hooks": hooks,
        },
        "essential": _collect_essential(root, workspace["version"], checks),
        "tech_stack": _collect_tech_stack(root, profile, checks, refresh),
        "mission": mission,
        "backlog": _collect_backlog(root),
        "estimate": _collect_estimate(root, mission),
        "autonomy": _collect_autonomy(root, profile, active, mission, checks),
    }
    doc["checks"] = checks
    return _finalize(doc)


# A BLOCKING check in either of these states halts the boot. `fail` is a
# determined defect; `unknown` is a state the panel could not determine — and
# the panel must never render a state it could not determine as fine (F19).
HALT_STATUSES = ("fail", "unknown")


def document_inconsistencies(doc):
    """Every way an athanor.bootpanel/v1 document contradicts ITSELF.

    The verdict is a FACT OF THE DOCUMENT, computed once here. Renderers read
    it; they never re-derive it, because two things deciding what is wrong are
    two sources of truth and F1's whole claim is that they cannot disagree. So
    the disagreement has to be caught where the document is produced or loaded,
    and surfaced — a renderer that quietly resolves it in either direction is
    the failure this function exists to prevent.

    F19 adds one more way to contradict: a check that does not say HOW it
    knows (`basis`, closed vocabulary BASES) is evidence nobody can audit, and
    that is as much a defect in the document as a mismatched halt_reasons.
    """
    if not isinstance(doc, dict):
        return ["document is not a JSON object"]
    problems = []
    if doc.get("schema") != SCHEMA:
        problems.append(f"schema is '{_s(doc.get('schema'))}', expected '{SCHEMA}'")
    checks = doc.get("checks")
    if not isinstance(checks, list):
        problems.append("checks[] is missing or is not a list")
        checks = []
    derived = sorted(str(c.get("id")) for c in checks if isinstance(c, dict)
                     and c.get("status") in HALT_STATUSES and c.get("blocking"))
    stated = doc.get("halt_reasons")
    if not isinstance(stated, list):
        problems.append("halt_reasons is missing or is not a list")
        stated = []
    if sorted(str(r) for r in stated) != derived:
        problems.append(f"halt_reasons {sorted(str(r) for r in stated)} does not match "
                        f"the blocking failures in checks[] {derived}")
    verdict = doc.get("verdict")
    if verdict not in VERDICTS:
        problems.append(f"verdict '{_s(verdict)}' is not one of {'/'.join(VERDICTS)}")
    elif verdict != ("halt" if stated else "ok"):
        problems.append(f"verdict is '{verdict}' but halt_reasons has "
                        f"{len(stated)} entr{'y' if len(stated) == 1 else 'ies'}")
    no_basis = sorted(str(c.get("id")) for c in checks
                      if isinstance(c, dict) and c.get("basis") not in BASES)
    if no_basis:
        problems.append("checks with no legal basis (expected one of "
                        + "/".join(BASES) + "): " + ", ".join(no_basis))
    return problems


def _finalize(doc):
    """Derive halt_reasons and the verdict — the ONLY place either is computed."""
    checks = doc["checks"]
    doc["halt_reasons"] = [c["id"] for c in checks
                           if c["status"] in HALT_STATUSES and c["blocking"]]
    doc["verdict"] = "halt" if doc["halt_reasons"] else "ok"
    problems = document_inconsistencies(doc)
    if problems:
        # Unreachable unless this module is broken: the collector must never
        # emit a self-contradictory document. It is a blocking check rather
        # than an exception because the panel may not take the session down.
        checks.append(_check(
            "panel.document", "panel", "fail",
            "the collector emitted a self-contradictory document: "
            + "; ".join(problems), True,
            "this is a defect in execution/boot_panel.py", basis="parsed"))
        doc["halt_reasons"] = [c["id"] for c in checks
                               if c["status"] in HALT_STATUSES and c["blocking"]]
        doc["verdict"] = "halt"
    return doc


# ----------------------------------------------------------------- renderers --
def render_agreement(doc):
    """First print only. One field per line so it is confirmed by EQUALITY —
    a containment test accepts 'Probe-workspace' for 'Probe'."""
    agreement = doc.get("agreement") or {}
    lines = ["── AGREEMENT — confirm these four, they drive everything ──"]
    for field in ("agent_name", "archetype", "address_user_as", "mission"):
        lines.append(f"agreement.{field} = {_s(agreement.get(field))}")
    return lines


def _line_git(git):
    tree = "clean" if git.get("clean") else f"dirty({git.get('dirty_files')})"
    mark = GLYPH["ok"] if git.get("email") == git.get("expected_email") else GLYPH["fail"]
    return (f"git: {_s(git.get('remote'))} · branch {_s(git.get('branch'))} · tree {tree}"
            f" · email {_s(git.get('email'))} {mark}")


def _line_context(ctx):
    reading = f"{_s(ctx.get('pct'))}% of {_s(ctx.get('window'))}"
    if ctx.get("captured_at") is None:
        return "context: fresh session (no previous reading)"
    age = _age_words(ctx.get("age_seconds") if isinstance(ctx.get("age_seconds"), int) else None)
    if ctx.get("fresh_session"):
        return f"context: fresh session (previous reading {reading}, {age} old)"
    return f"context: {reading} ({_s(ctx.get('tokens'))} tokens, {age} old)"


def _line_delivery(delivery):
    classes = delivery.get("classes") or {}
    parts = [f"{cls} {classes[cls]['canonical']}/{classes[cls]['expected']}"
             for cls in CLASSES if cls in classes]
    hooks = delivery.get("hooks") or {}
    parts.append(f"hooks registered {hooks.get('registered')}/{hooks.get('expected')} "
                 f"· function {hooks.get('function_verified')} ok / "
                 f"{hooks.get('dead', 0) + hooks.get('undiscriminating', 0)} broken / "
                 f"{hooks.get('unprobed', 0)} unprobed "
                 f"· enforcement coverage {hooks.get('enforcement_declared', 0)}"
                 f"/{hooks.get('enforcement_registered', 0)} declared")
    summary = delivery.get("provider_summary") or {}
    if not summary.get("installed"):
        parts.append("providers none installed")
    elif summary.get("aligned"):
        parts.append(f"providers {summary.get('installed')} aligned")
    else:
        worst = summary.get("worst") or {}
        parts.append(f"providers {worst.get('summary')} "
                     f"(worst of {summary.get('installed')}) — run make sync")
    source = classes.get("rules", {}).get("source", "canonical")
    return "delivery: " + " · ".join(parts) + f" [{source}]"


def _line_services(label, entries):
    """One line per service class. Counts and glyphs, plus the provenance NOTE
    the collector attached — a cached reading must not render as a live one."""
    if not entries:
        return f"{label}: (none declared)"
    rendered = []
    for entry in entries:
        if entry.get("status") in ("ok", "fail", "warn"):
            text = f"{entry.get('name')} {GLYPH.get(entry.get('status'), '·')}"
        else:
            text = f"{entry.get('name')} {entry.get('detail')}"
        if entry.get("note"):
            text += f" ({entry['note']})"
        rendered.append(text)
    return f"{label}: " + " · ".join(rendered)


def _line_mission(doc):
    mission, aut = doc.get("mission") or {}, doc.get("autonomy") or {}
    decided = "decided" if aut.get("decided") else "UNDECIDED"
    slug = mission.get("slug") or "none"
    checkpoint = mission.get("checkpoint") or "-"
    return (f"mission: {slug} · checkpoint {checkpoint} · autonomy "
            f"{_s(aut.get('level'))} ({decided}, {_s(aut.get('source'))})")


def render_compact(doc):
    """The per-boot panel: counts, never names. <= 30 lines."""
    workspace = doc.get("workspace") or {}
    quota = doc.get("quota") or {}
    project = workspace.get("project_name") or workspace.get("folder")
    lines = [
        f"━━ boot ━━ project {_s(project)} (name_source {_s(workspace.get('name_source'))})"
        f" · harness {_s(workspace.get('harness_name'))} "
        f"{_version_label(workspace.get('version'))}",
        f"agent: {_id(workspace.get('agent_name'))} · role "
        f"{_id(workspace.get('project_role'))} · archetype "
        f"{_id(workspace.get('archetype'))} · onboarding "
        f"{'complete' if workspace.get('onboarding_complete') else 'INCOMPLETE'}",
        f"counts_scope: {_s(doc.get('counts_scope'))}",
        _line_git(doc.get("git") or {}),
        f"quota: used {_s(quota.get('used_pct'))}% · available "
        f"{_s(quota.get('available_pct'))}% · resets_in {_s(quota.get('resets_in'))} · band "
        f"{_s(quota.get('band'))}",
        _line_context(doc.get("context") or {}),
        _line_delivery(doc.get("delivery") or {}),
        _line_services("ESSENTIAL", doc.get("essential") or []),
        _line_services("TECH STACK", doc.get("tech_stack") or []),
        _line_mission(doc),
        "backlog: " + (" · ".join((doc.get("backlog") or {}).get("top") or []) or "(empty)"),
    ]
    estimate = doc.get("estimate") or {}
    if estimate.get("text"):
        lines.append(f"estimate: {estimate['text']}")
    lines.extend(_render_verdict(doc))
    return lines


def _render_verdict(doc):
    """Render the verdict the DOCUMENT states. Nothing here computes one.

    Halting checks are looked up BY ID from halt_reasons instead of being
    re-filtered out of checks[], so this renderer cannot reach a different
    conclusion from the report or from the marker. A document whose checks and
    verdict disagree is announced as inconsistent — never silently resolved.
    """
    checks = doc.get("checks") or []
    by_id = {c.get("id"): c for c in checks if isinstance(c, dict)}
    warns = [c for c in checks if isinstance(c, dict) and c.get("status") == "warn"]
    reasons = list(doc.get("halt_reasons") or [])
    verdict = doc.get("verdict")
    problems = document_inconsistencies(doc)
    lines = []
    if verdict == "halt":
        lines.append(f"{GLYPH['fail']} BOOT HALTED — {len(reasons)} blocking check(s): "
                     + ", ".join(str(r) for r in reasons))
        for reason in reasons[:COMPACT_MAX_FAIL_LINES]:
            check = by_id.get(reason) or {}
            detail = check.get("detail") or "named in halt_reasons but absent from checks[]"
            fix = f" — fix: {check['fix']}" if check.get("fix") else ""
            lines.append(f"  {GLYPH['fail']} {reason}: {detail}{fix}")
        if len(reasons) > COMPACT_MAX_FAIL_LINES:
            lines.append(f"  … and {len(reasons) - COMPACT_MAX_FAIL_LINES} more "
                         "blocking check(s)")
    for check in warns[:COMPACT_MAX_WARN_LINES]:
        lines.append(f"  {GLYPH['warn']} {check.get('id')}: {check.get('detail')}")
    if len(warns) > COMPACT_MAX_WARN_LINES:
        lines.append(f"  … and {len(warns) - COMPACT_MAX_WARN_LINES} more warning(s)")
    if problems:
        lines.append(f"{GLYPH['fail']} DOCUMENT INCONSISTENT — this panel cannot be "
                     "trusted: " + "; ".join(problems))
        lines.append(f"verdict: {_s(verdict)} (as stated by an inconsistent document)")
    elif verdict == "ok" and not warns:
        lines.append(f"verdict: ok — {GLYPH['ok']} all checks aligned — no drift detected")
    else:
        lines.append(f"verdict: {_s(verdict)}")
    return lines


def _report_delivery(delivery):
    lines = ["", "── DELIVERY (named) ──"]
    classes = delivery.get("classes") or {}
    for cls in CLASSES:
        entry = classes.get(cls)
        if not entry:
            continue
        lines.append(f"{cls} {entry['canonical']}/{entry['expected']} ({entry['source']}): "
                     + (", ".join(entry["present"]) or "(none)"))
        if entry["missing"]:
            lines.append("  missing: " + ", ".join(entry["missing"]))
        if entry["extra"]:
            lines.append("  undeclared: " + ", ".join(entry["extra"]))
    for provider in delivery.get("providers") or []:
        pclasses = provider.get("classes") or {}
        for cls in CLASSES:
            pcls = pclasses.get(cls)
            if not pcls:
                continue
            lines.append(f"{provider['provider']} {cls} {pcls.get('present')}/"
                         f"{pcls.get('expected')} ({pcls.get('dir')}): "
                         + (", ".join(pcls.get("files") or []) or "(none)"))
            if pcls.get("missing"):
                lines.append("  missing: " + ", ".join(pcls["missing"]))
        pmanifest = provider.get("manifest")
        if pmanifest:
            lines.append(f"{provider['provider']} agents manifest "
                         f"{pmanifest.get('present')}/{pmanifest.get('expected')} "
                         f"({pmanifest.get('path')}): "
                         + (", ".join(pmanifest.get("names") or []) or "(none)"))
            if pmanifest.get("missing"):
                lines.append("  missing: " + ", ".join(pmanifest["missing"]))
    hooks = delivery.get("hooks") or {}
    lines.append(f"hooks registered {hooks.get('registered')}/{hooks.get('expected')} "
                 f"({hooks.get('source')}): " + (", ".join(hooks.get("registered_names") or [])
                                                 or "(none)"))
    lines.append(f"hooks on disk {hooks.get('on_disk')}: "
                 + (", ".join(hooks.get("on_disk_names") or []) or "(none)"))
    lines.append("hooks on disk but NOT registered: "
                 + (", ".join(hooks.get("unregistered") or []) or "(none)"))
    lines.append(f"hooks function (executed, not counted): "
                 f"{hooks.get('function_verified', 0)} ok, "
                 f"{hooks.get('dead', 0)} dead, "
                 f"{hooks.get('undiscriminating', 0)} undiscriminating, "
                 f"{hooks.get('unprobed', 0)} unprobed, "
                 f"{hooks.get('unvouched', 0)} unvouched, "
                 f"{hooks.get('inert', 0)} inert")
    lines.append(f"enforcement coverage: "
                 f"{hooks.get('enforcement_declared', 0)}/"
                 f"{hooks.get('enforcement_registered', 0)} registrations declared")
    lines.append("enforcement registrations NOT declared (never executed): "
                 + (", ".join(hooks.get("enforcement_undeclared") or []) or "(none)"))
    return lines


def render_report(doc):
    """A strict superset of the compact panel: it NAMES what compact counts."""
    lines = list(render_compact(doc))
    lines.extend(_report_delivery(doc.get("delivery") or {}))
    lines.extend(["", "── ESSENTIAL SERVICES ──"])
    for entry in doc.get("essential") or []:
        lines.append(f"{entry.get('name')} [{entry.get('kind')}] {entry.get('status')}: "
                     f"{entry.get('detail')}")
    lines.extend(["", "── TECH STACK ──"])
    for entry in doc.get("tech_stack") or []:
        lines.append(f"{entry.get('name')} [{entry.get('kind')}/{entry.get('cost')}] "
                     f"{entry.get('status')}: {entry.get('detail')}")
    if not doc.get("tech_stack"):
        lines.append("(none declared)")
    aut = doc.get("autonomy") or {}
    lines.extend(["", "── AUTONOMY ──",
                  f"level {_s(aut.get('level'))} (stored '{_s(aut.get('raw_level'))}', "
                  f"source {_s(aut.get('source'))}, decided {aut.get('decided')})",
                  f"running provider {_s(aut.get('running_provider'))} cap "
                  f"{_s(aut.get('provider_cap'))}"])
    lines.extend(["", "── BACKLOG (top P0/P1) ──"])
    lines.extend((doc.get("backlog") or {}).get("top") or ["(empty)"])
    lines.extend(["", "── CHECKS ──"])
    for check in doc.get("checks") or []:
        mark = GLYPH.get(check.get("status"), "·")
        block = "blocking" if check.get("blocking") else "non-blocking"
        lines.append(f"{mark} {check.get('id')} [{block}]: {check.get('detail')}")
    if not doc.get("checks"):
        lines.append(f"{GLYPH['ok']} no findings")
    return lines


def _stamp_stale_threshold(root):
    """A marker older than this session's boot is inherited, not verified."""
    raw = _read_text(root / LAST_BOOT_TS_REL)
    try:
        return max(0.0, _now().timestamp() - float(raw))
    except (TypeError, ValueError):
        return MARKER_FRESH_FALLBACK_SECONDS


def marker_problems(marker):
    """Every way a marker fails to be an athanor.bootpanel/v1 verdict.

    The stamp is the ONLY boot evidence ~44 subagents get, so "not halt" is not
    a licence to report ok: a marker with an unknown schema or a verdict word
    the panel never writes describes something else entirely.
    """
    if not isinstance(marker, dict):
        return ["marker is not a JSON object"]
    problems = []
    if marker.get("schema") != SCHEMA:
        problems.append(f"schema '{_s(marker.get('schema'))}'")
    if marker.get("verdict") not in VERDICTS:
        problems.append(f"verdict '{_s(marker.get('verdict'))}'")
    if not isinstance(marker.get("halt_reasons"), list):
        problems.append("halt_reasons not a list")
    if _parse_iso(marker.get("collected_at")) is None:
        problems.append("unparseable collected_at")
    return problems


def render_stamp(marker, stale_after_seconds=MARKER_FRESH_FALLBACK_SECONDS):
    """One line, <= 120 chars — a subagent inherits a verified verdict rather
    than re-deriving it ~44 times a session. A stale marker says stale."""
    if not isinstance(marker, dict):
        return f"{GLYPH['fail']} boot: NO MARKER — run: python3 execution/boot_panel.py"
    problems = marker_problems(marker)
    if problems:
        line = (f"{GLYPH['fail']} boot: UNUSABLE MARKER ({', '.join(problems)}) — "
                "run: python3 execution/boot_panel.py")
        return line[:STAMP_MAX_CHARS]
    collected = _parse_iso(marker.get("collected_at"))
    age = (_now() - collected).total_seconds() if collected else None
    if marker.get("verdict") == "halt":
        reasons = marker.get("halt_reasons") or []
        body = f"{GLYPH['fail']} HALT — {len(reasons)} blocking: " + ", ".join(reasons)
    else:
        body = f"ok ({_version_label(marker.get('version'))})"
    if age is None or age > stale_after_seconds:
        line = f"{GLYPH['warn']} boot: STALE marker ({_age_words(age)} old) — {body}"
    else:
        line = f"boot: {body} · {_age_words(age)} ago"
    return line[:STAMP_MAX_CHARS]


# --------------------------------------------------------------- marker I/O --
def _workspace_identity(root, doc=None):
    """Which workspace a marker describes: absolute root and project name.

    Taken from the DOCUMENT when one is being written and from the workspace
    itself when a marker is being read, and both fall back to the folder name
    the same way, so the two sides compare like for like.
    """
    root = Path(root).resolve()
    if isinstance(doc, dict):
        workspace = doc.get("workspace") or {}
        project = workspace.get("project_name") or workspace.get("folder")
    else:
        profile, _err = _load_json(root / PROFILE_REL)
        project = (profile or {}).get("project_name") if isinstance(profile, dict) else None
        project = project or root.name
    return {"workspace_root": str(root), "project_name": project}


def write_marker(root, doc):
    """Write the verdict marker ATOMICALLY. Returns (marker, error).

    Two properties the previous direct write_text() did not have. It is written
    to a temp file in the same directory and renamed into place, because every
    subagent stamp in the session reads this file and a half-written one is
    read as no marker at all. And a failed write is RETURNED rather than
    swallowed: a marker nobody could write means every subagent and the mission
    driver inherit the previous session's verdict while believing it is this
    one's.
    """
    root = Path(root).resolve()
    marker = dict(_workspace_identity(root, doc))
    marker.update({
        "schema": SCHEMA,
        "verdict": doc.get("verdict"),
        "halt_reasons": doc.get("halt_reasons") or [],
        "collected_at": doc.get("collected_at"),
        "version": (doc.get("workspace") or {}).get("version"),
    })
    path = root / MARKER_REL
    handle, temp_name = None, None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temp_name = tempfile.mkstemp(
            prefix=".boot_panel.", suffix=".tmp", dir=str(path.parent))
        handle = os.fdopen(descriptor, "w")
        handle.write(json.dumps(marker, indent=2) + "\n")
        handle.close()
        handle = None
        os.replace(temp_name, str(path))
    except OSError as exc:
        if handle is not None:
            handle.close()
        if temp_name and os.path.exists(temp_name):
            try:
                os.unlink(temp_name)
            except OSError:
                pass
        return None, f"{exc.__class__.__name__}: {exc}"
    return marker, None


def read_marker(root):
    """Return the cached verdict for THIS workspace, or None.

    A marker carries the identity of the workspace it was collected in, and one
    whose identity does not match is treated as ABSENT rather than as evidence
    of health — a fresh ok marker copied in from another checkout describes a
    different tree, and inheriting it is how a broken workspace reports ok ~44
    times in a row.
    """
    root = Path(root).resolve()
    marker, _err = _load_json(root / MARKER_REL)
    if not isinstance(marker, dict):
        return None
    for field, expected in _workspace_identity(root).items():
        if marker.get(field) != expected:
            return None
    return marker


# ---------------------------------------------------------------------- CLI --
def _parse_args(argv):
    parser = argparse.ArgumentParser(
        prog="boot_panel.py",
        description="Boot status panel — one collector, four renderers.")
    parser.add_argument("--format", default="compact",
                        choices=("compact", "report", "json", "stamp"))
    parser.add_argument("--agreement", action="store_true",
                        help="Print the first-print agreement block above the panel")
    parser.add_argument("--from-json", dest="from_json",
                        help="Render from an already-collected document (never re-collects)")
    parser.add_argument("--no-collect", action="store_true",
                        help="Never collect; render only from the cached marker/document")
    parser.add_argument("--root", default=".", help="Workspace root (default: cwd)")
    parser.add_argument("--refresh", action="store_true",
                        help="Run and cache the cost:network-paid probes "
                             "(what `make boot-report REFRESH=1` invokes)")
    parser.add_argument("--exit-code", dest="exit_code", action="store_true",
                        help="Map the verdict to the process exit status "
                             "(0 ok / 1 halt / 2 document inconsistent or "
                             "unreadable), for EVERY format including stamp. "
                             "OPT-IN ONLY — without this flag the process "
                             "always exits 0, because boot_panel runs from "
                             "SessionStart and a hook that fails takes the "
                             "session with it.")
    return parser.parse_args(argv)


def _emit(lines):
    print("\n".join(lines))


def _exit_code(doc):
    """Map a document's verdict to a process status. Called ONLY when the
    operator opted in with --exit-code; the default path never calls this.

    A self-contradictory document is neither a clean ok nor a plain halt —
    it is untrustworthy, and it gets its own status (2) so a caller does not
    read "not halt" as "fine".
    """
    if document_inconsistencies(doc):
        return 2
    return 1 if doc.get("verdict") == "halt" else 0


def _stamp_exit_code(marker):
    """The stamp's verdict as a process status, on the same scale as
    _exit_code(). A missing or unusable marker is the stamp's own form of a
    document that cannot be trusted, so it takes the same status (2) rather
    than reading as "not halt".
    """
    if not isinstance(marker, dict) or marker_problems(marker):
        return 2
    return 1 if marker.get("verdict") == "halt" else 0


def main(argv=None):
    args = _parse_args(argv)
    root = Path(args.root).resolve()

    if args.format == "stamp":
        marker = read_marker(root)
        if marker is None and not args.no_collect:
            marker, _error = write_marker(root, collect(root))
        print(render_stamp(marker, _stamp_stale_threshold(root)))
        return _stamp_exit_code(marker) if args.exit_code else 0

    if args.from_json:
        doc, error = _load_json(args.from_json)
        if not isinstance(doc, dict):
            print(f"boot panel: cannot read document {args.from_json} ({error})")
            return 2 if args.exit_code else 0
    elif args.no_collect:
        print("boot panel: no document — --no-collect requires --from-json")
        return 2 if args.exit_code else 0
    else:
        doc = collect(root, refresh=args.refresh)
        _marker, marker_error = write_marker(root, doc)
        if marker_error:
            doc["checks"].append(_check(
                "panel.marker", "panel", "fail",
                f"could not write {MARKER_REL} ({marker_error}) — subagent stamps "
                "and the mission driver would inherit an older verdict", True,
                f"make {MARKER_REL} writable", basis="executed"))
            _finalize(doc)

    if args.format == "json":
        print(json.dumps(doc, indent=2))
        return _exit_code(doc) if args.exit_code else 0

    lines = render_agreement(doc) + [""] if args.agreement else []
    lines += render_compact(doc) if args.format == "compact" else render_report(doc)
    _emit(lines)
    return _exit_code(doc) if args.exit_code else 0


if __name__ == "__main__":
    sys.exit(main())
