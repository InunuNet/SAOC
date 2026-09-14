#!/usr/bin/env python3
"""
verify_mirror_sync.py — F7: template/execution/ must never silently ship
stale harness code.

CONFIRMED LIVE DEFECT (2026-08-15): execution/update_template.py's main()
falls back to `source = Path("template")` — the DOWNSTREAM workspace's own
local template/ mirror — whenever `fetch_latest_from_github()` fails (gh
missing, no auth, network down). The manifest (.agent/update-manifest.yaml)
ships `execution/` under HARNESS, so on that fallback path template/execution/
is copied OVER execution/, silently DOWNGRADING the very updater plus every
guard it carries. Right now in this repo:
  execution/update_template.py           = 1863 lines (has _refuse_symlinked_write,
                                            _create_guarded_backup_dir,
                                            BackupDirRefused, cmd_reconcile_from_history)
  template/execution/update_template.py  =  469 lines (has NONE of them; last
                                            touched 241ac24e, 2026-07-09)
...while .agent/version and template/.agent/version BOTH read 3.7.109 — the
version stamp claims currency while the mirrored code is a month stale. That
is what made this invisible: nothing compared the two copies' actual bytes.

This check is broader than update_template.py alone: it walks every .py and
.sh file that exists in BOTH execution/ (repo root) and template/execution/
(the harness's own self-mirror, delivered to every downstream workspace on
the update_template.py fallback path above) and fails if any pair's bytes
differ. It intentionally does NOT check files that exist in only one side —
new root-only scripts not yet mirrored are a related but distinct defect
(see the contract's notes) — this check is scoped to DIVERGENCE of files
that are supposed to be identical copies, which is the exact failure mode
that shipped a broken updater as "current".

SCOPE (see contract-f7.yaml notes for the full inclusion/exclusion
rationale): executable harness code only —
  - execution/**/*.py  vs  template/execution/**/*.py
  - execution/**/*.sh  vs  template/execution/**/*.sh
This deliberately excludes .agent/agents/*.md, Makefile, README.md, and
other manifest HARNESS/MERGE entries that are legitimately edited on
different cadences or use a MERGE strategy rather than a straight mirror —
see contract notes for why those are out of scope for THIS check.
"""
import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LIVE_DIR = REPO_ROOT / "execution"
MIRROR_DIR = REPO_ROOT / "template" / "execution"
CONFIG_LIVE_DIR = REPO_ROOT / ".agent" / "config"
CONFIG_MIRROR_DIR = REPO_ROOT / "template" / ".agent" / "config"
CONFIG_MUST_SHIP = [
    "free_models.json",
    # boot-status-panel F2: the tech-stack probe registry. A bare tech_stack
    # name in profile.json is resolved through this file, and an entry with no
    # probe HALTS the boot panel — so a downstream workspace that never
    # receives the registry halts on its own declared stack.
    "stack_probes.json",
]

# MUST_SHIP: load-bearing execution/ files that every downstream workspace
# must receive via template/execution/. Unlike find_shared_files() below
# (which only ever sees files that already exist in BOTH trees), this list
# is hardcoded so a file that is missing from the mirror ENTIRELY — not just
# byte-diverged — is still caught. This is the gap that let quota.py (the
# admission-control oracle behind mission.py's gates) ship live but never
# reach template/execution/ at all.
#
# overlay_all.sh, overlay_fleet.sh, and fleet_update.sh are deliberately NOT
# in this list. They are this-machine-only fleet tooling: overlay_all.sh's
# IGNORE array is the operator's personal project roster and PROJECTS_ROOT
# defaults to $HOME/ai, and overlay_fleet.sh/fleet_update.sh assume the same
# local sibling-project layout. None of that exists in a downstream
# workspace, so shipping them via the mirror would mislead a fresh project
# into running fleet commands against a fleet it doesn't have. This mirrors
# the F7 backlog ruling (.agent/memory/project/backlog.md) — they were
# excluded on purpose, not forgotten.
MUST_SHIP = [
    "quota.py",
    # boot-status-panel: the boot panel itself, the autonomy dialect it imports
    # at module scope, and the deliberate regenerator for the declared delivery
    # denominator. find_shared_files() only ever compares files present in BOTH
    # trees, so a panel absent from the mirror is invisible to it: a downstream
    # workspace would get `make boot-report` and a mission driver that reads a
    # marker nothing ever writes.
    "boot_panel.py",
    "autonomy.py",
    "delivery_manifest.py",
    # platform-scoped-delivery F2: the boot siren and the clone generator. The
    # siren exists FOR downstream workspaces (the population still holding
    # symlinks), and full_boot.sh guards its call with `[ -f ]` — so a mirror
    # that does not carry these files turns the siren into a silent no-op
    # exactly where it is needed.
    "paired_copies.py",
    "boot_integrity.py",
    "checks/verify_no_symlink_stubs.py",
    "codex_qa.sh",
    "failure_router.sh",
    # session_token_log.sh, harness_heartbeat.sh and compaction_backstop.sh
    # stood here until CEO Directive v2 (2026-09-06, L1) deleted them from
    # both trees. A MUST_SHIP entry for a file that no longer exists anywhere
    # reports the mirror as broken forever, which is the opposite of what this
    # check is for. lib/context_window.py stays: it survives the cut.
    "hooks/lib/context_window.py",
    "skills/lib/mission_complete.py",
    "skills/lib/scoped_stage.py",
    "skills/lib/secret_guard.py",
    "skills/wrap_mission.sh",
    "skills/quick_gate.sh",
    "dispatch_free_model.py",
    "dispatch_name.py",
    "sync_autonomy.py",
    "retro.py",
    "capture_pain.py",
    "verify_agents.sh",
    "validate_manifest.sh",
    "audit_gates.py",
    "token_report.py",
    "onboard_headless.py",
    "gh_closure_scan.py",
    "repo_info.sh",
    # platform-scoped-delivery D10 item 4: this feature's own shipped files.
    # full_boot.sh step 9.5 is gated on `[ -f execution/git_guard.py ]`, so
    # until the mirror carries it that branch is permanently dead downstream —
    # the same shape as the quota.py gap this list's comment already cites.
    "prune_foreign.py",
    "git_guard.py",
    "checks/verify_platform_attestation.py",
    "checks/verify_mirror_sync.py",
    # clean-scaffold D-2: the ONE reader of the NEW/ESTABLISHED rule.
    # full_boot.sh guards its call with `[ -f ]` and fails toward NEW, so a
    # mirror that does not carry it sends every downstream workspace to the
    # onboarding gate forever.
    # boot-status-panel F3: the conclusive autonomy write. `make set-autonomy`
    # is now a thin wrapper around it, so a mirror without this file gives a
    # downstream workspace a Makefile target that exits 127 — and the
    # per-mission decision gate no command can clear.
    "set_autonomy.py",
    "workspace_state.py",
    # copied-project-halt F14: the ONE reader of the identity question, and
    # full_boot.sh guards its call with `[ -f ]`. A mirror that does not carry
    # it hands a downstream workspace the gate's enforcement without its
    # reader — so a copy of that workspace boots silently into the identity of
    # the project it was copied from, which is the defect F14 exists to end.
    "identity_ambiguity.py",
    # onboarding-rework F1: the ONE name dialect and the git provisioning tool
    # that init.sh's proposal and every `apply --confirmed` run from. A
    # downstream workspace re-running its own init.sh reads name_sanitize.py
    # before it can derive a project name at all, so a mirror without it
    # scaffolds nothing.
    "name_sanitize.py",
    "git_provision.py",
    # rules-canonical F1: the ONE fan-out from .agent/rules/_core/ to every
    # provider rules_dir. init.sh delivers the canonical subtree and then leans
    # entirely on this script to reach .claude/rules/, .gemini/rules/ and
    # .grok/rules/, so a mirror without it scaffolds a workspace whose
    # `make sync-rules` cannot run and whose providers are served nothing.
    "sync_rules.sh",
    # first-boot-law / clean-scaffold: the onboarding interview and the
    # inherited-state disposal it imports at module scope. The delivered
    # `/onboard` skill runs `python3 execution/onboard_flow.py run` verbatim,
    # and onboard_flow.py does `import memory_quarantine` at line 55 — so a
    # mirror carrying neither hands every scaffolded workspace an onboarding
    # command that exits 127, and one carrying only the flow gives it an
    # ImportError instead. find_shared_files() cannot see either gap: it only
    # ever compares files already present in BOTH trees.
    "onboard_flow.py",
    "memory_quarantine.py",
]

# ---------------------------------------------------------------- rules pair
# The canonical rule set is DECLARED, at .agent/rules/manifest.json (spec
# rules-canonical, D1). Every rule it names must reach
# template/.agent/rules/_core/ byte-identical, or a downstream workspace is
# scaffolded with a rule the harness believes it delivered.
#
# THE LIST IS NOT WRITTEN HERE, AND THAT IS THE POINT. MUST_SHIP above is
# hand-maintained because execution/ has no declaration to read; the rules do
# have one, so a second hand-maintained copy would be a list that can drift
# from the very thing it protects (spec rules-canonical, D6). manifest.json is
# the ONE hardcoded anchor; every name comes out of it.
RULES_MANIFEST_REL = Path(".agent/rules/manifest.json")
RULES_LIVE_REL = Path(".agent/rules/_core")
RULES_SCHEMA = "athanor.rules-manifest/v1"


class RulesUnknown(Exception):
    """The declared expected set could not be read.

    A missing, unparseable or wrong-schema manifest is a THIRD verdict, not a
    clean pass (spec rules-canonical, D2): "0 rules diverged", computed from an
    expectation nobody could read, is indistinguishable in output from a
    healthy tree — which is the exact failure mode this file exists to end. It
    fails."""


def load_declared_rules(repo_root: Path = None) -> list:
    """Return the sorted rule names declared by .agent/rules/manifest.json.

    Raises RulesUnknown rather than returning [] — an empty list would sail
    through every loop below and be reported as a pass."""
    root = REPO_ROOT if repo_root is None else Path(repo_root)
    path = root / RULES_MANIFEST_REL
    try:
        data = json.loads(path.read_text())
    except FileNotFoundError:
        raise RulesUnknown(f"{RULES_MANIFEST_REL} MISSING under {root}")
    except (OSError, ValueError) as exc:
        raise RulesUnknown(f"{RULES_MANIFEST_REL} unreadable or unparseable: {exc}")
    if not isinstance(data, dict) or data.get("schema") != RULES_SCHEMA:
        raise RulesUnknown(f"{RULES_MANIFEST_REL} does not carry schema {RULES_SCHEMA}")
    rules = data.get("rules")
    if (not isinstance(rules, list) or not rules
            or not all(isinstance(r, str) and r for r in rules)):
        raise RulesUnknown(f"{RULES_MANIFEST_REL} declares no usable 'rules' list")
    return sorted(rules)


def find_rules_findings(repo_root: Path = None) -> list:
    """Return [(only-key, message)] for the declared rule set's mirror pair.

    Keys are `rules/<name>.md` and `rules/manifest.json` so --only scoping
    reaches rules the same way it reaches execution/ paths."""
    root = REPO_ROOT if repo_root is None else Path(repo_root)
    live_dir = root / RULES_LIVE_REL
    mirror_dir = root / "template" / RULES_LIVE_REL
    live_manifest = root / RULES_MANIFEST_REL
    mirror_manifest = root / "template" / RULES_MANIFEST_REL
    try:
        rules = load_declared_rules(root)
    except RulesUnknown as exc:
        return [("rules/manifest.json", f"EXPECTED-SET UNKNOWN: {exc}")]

    findings = []
    if not mirror_manifest.is_file():
        findings.append(("rules/manifest.json",
                         f"MISSING: template/{RULES_MANIFEST_REL} — the fallback "
                         f"source would ship rules with no declaration of the set"))
    elif mirror_manifest.read_bytes() != live_manifest.read_bytes():
        findings.append(("rules/manifest.json",
                         f"DIVERGED: template/{RULES_MANIFEST_REL} vs "
                         f"{RULES_MANIFEST_REL}"))

    for name in rules:
        rel = f"{name}.md"
        live = live_dir / rel
        mirror = mirror_dir / rel
        if not live.is_file():
            findings.append((f"rules/{rel}",
                             f"MISSING AT SOURCE: {RULES_LIVE_REL}/{rel} is declared "
                             f"in {RULES_MANIFEST_REL} but does not exist"))
            continue
        if not mirror.is_file():
            findings.append((f"rules/{rel}",
                             f"MISSING: template/{RULES_LIVE_REL}/{rel}"))
        elif mirror.read_bytes() != live.read_bytes():
            findings.append((f"rules/{rel}",
                             f"DIVERGED: template/{RULES_LIVE_REL}/{rel} vs "
                             f"{RULES_LIVE_REL}/{rel}"))
    return findings


def find_missing_must_ship(mirror_dir: Path = MIRROR_DIR,
                            must_ship: list = MUST_SHIP) -> list:
    """Return the sorted subset of must_ship whose path does not exist as a
    file under mirror_dir."""
    return sorted(rel for rel in must_ship if not (mirror_dir / rel).is_file())


def find_shared_files(live_dir: Path = LIVE_DIR, mirror_dir: Path = MIRROR_DIR,
                       patterns: tuple = ("*.py", "*.sh")):
    """Yield (live_path, mirror_path, rel) for every file matching patterns
    that exists in BOTH live_dir and mirror_dir, matched by path relative
    to each root."""
    shared = []
    for pattern in patterns:
        for mirror_path in sorted(mirror_dir.rglob(pattern)):
            rel = mirror_path.relative_to(mirror_dir)
            live_path = live_dir / rel
            if live_path.is_file():
                shared.append((live_path, mirror_path, str(rel)))
    return shared


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--only", action="append", default=[], metavar="REL",
                    help="gate on these mirror-relative paths only (repeatable, "
                         "e.g. --only directives.py). The full repo-wide report "
                         "is still printed; only the PASS/FAIL decision narrows. "
                         "Used by `make gate-fast`, whose job is to gate the "
                         "change under review rather than to re-litigate "
                         "pre-existing repo-wide divergence. Default (and what "
                         "`make audit` runs): gate on everything.")
    ap.add_argument("--repo-root", default=None, metavar="DIR",
                    help="compare the pair inside DIR instead of this script's own "
                         "repository. The default (this script's REPO_ROOT, derived "
                         "from __file__) is what `make audit` and every shipped "
                         "assertion use; the flag exists so the check itself can be "
                         "exercised against a fixture tree without mutating the real "
                         "repo, and the root actually used is always printed below.")
    args = ap.parse_args()
    only = set(args.only)
    root = REPO_ROOT if args.repo_root is None else Path(args.repo_root).resolve()
    live_dir = root / "execution"
    mirror_dir = root / "template" / "execution"
    config_live_dir = root / ".agent" / "config"
    config_mirror_dir = root / "template" / ".agent" / "config"

    def token(items) -> str:
        """The banner prefix for one finding block.

        FAIL is reserved for findings that actually gate THIS invocation. In
        --only mode, divergence outside the scope is still worth REPORTING
        (D10 item 3) but reporting it as FAIL while exiting 0 trains every
        reader to ignore FAIL tokens in green CI — which is precisely how a
        4-file divergence sat unnoticed under a passing gate."""
        if not only or any(i in only for i in items):
            return "FAIL —"
        return "DIVERGED (out of scope, not gated here) —"

    missing = find_missing_must_ship(mirror_dir)
    shared = find_shared_files(live_dir, mirror_dir)
    rules_findings = find_rules_findings(root)
    try:
        rules_note = f"{len(load_declared_rules(root))} declared rule(s)"
    except RulesUnknown as exc:
        rules_note = f"EXPECTED-SET UNKNOWN ({exc})"
    if not shared:
        print("FAIL — found zero shared execution/*.py|*.sh files between "
              "execution/ and template/execution/; the discovery walk is "
              "broken (expected dozens, e.g. update_template.py, "
              "hooks/full_boot.sh)")
        return 1

    diverged = []
    for live_path, mirror_path, rel in shared:
        live_bytes = live_path.read_bytes()
        mirror_bytes = mirror_path.read_bytes()
        if live_bytes != mirror_bytes:
            diverged.append((rel, len(live_bytes.splitlines()),
                              len(mirror_bytes.splitlines())))

    config_missing = find_missing_must_ship(config_mirror_dir, CONFIG_MUST_SHIP)
    config_shared = find_shared_files(config_live_dir, config_mirror_dir, patterns=("*.json",))
    config_diverged = []
    for live_path, mirror_path, rel in config_shared:
        live_bytes = live_path.read_bytes()
        mirror_bytes = mirror_path.read_bytes()
        if live_bytes != mirror_bytes:
            config_diverged.append((rel, len(live_bytes.splitlines()),
                                     len(mirror_bytes.splitlines())))

    live_version = (root / ".agent" / "version").read_text().strip()
    mirror_version = (root / "template" / ".agent" / "version").read_text().strip()

    print(f"[root] {root}")
    print(f"[scan] {len(shared)} shared execution file(s) compared between "
          f"execution/ and template/execution/")
    print(f"[config-scan] {len(config_shared)} shared config file(s) compared "
          f"between .agent/config/ and template/.agent/config/")
    print(f"[rules-scan] {rules_note} compared between {RULES_LIVE_REL}/ and "
          f"template/{RULES_LIVE_REL}/, plus the manifest pair")
    print(f"[version] .agent/version={live_version}  "
          f"template/.agent/version={mirror_version}")

    if missing:
        print()
        print(f"{token(missing)} {len(missing)} MUST-SHIP file(s) missing entirely from "
              f"template/execution/ (not just diverged):")
        for rel in missing:
            print(f"  MISSING: {rel}")

    if diverged:
        print()
        print(f"{token([d[0] for d in diverged])} {len(diverged)} harness file(s) diverged between "
              f"execution/ (live) and template/execution/ (mirror):")
        for rel, live_lines, mirror_lines in diverged:
            print(f"  DIVERGED: {rel}  "
                  f"(execution/{rel}={live_lines} lines, "
                  f"template/execution/{rel}={mirror_lines} lines)")
        if live_version == mirror_version:
            print()
            print(f"  version stamps MATCH ({live_version}) despite this "
                  f"divergence — a version-currency check alone would have "
                  f"reported this workspace as up to date while shipping "
                  f"stale/regressed code on the next fallback-source apply.")

    if rules_findings:
        print()
        print(f"{token([k for k, _ in rules_findings])} {len(rules_findings)} finding(s) "
              f"for the DECLARED rule set ({RULES_MANIFEST_REL} -> "
              f"template/{RULES_LIVE_REL}/). The expected set is read from the "
              f"manifest, never hand-listed in this file:")
        for _key, msg in rules_findings:
            print(f"  {msg}")

    if config_missing:
        print()
        print(f"{token(config_missing)} {len(config_missing)} MUST-SHIP file(s) missing entirely from "
              f"template/.agent/config/ (not just diverged):")
        for rel in config_missing:
            print(f"  MISSING: {rel}")

    if config_diverged:
        print()
        print(f"{token([d[0] for d in config_diverged])} {len(config_diverged)} config file(s) diverged between "
              f".agent/config/ (live) and template/.agent/config/ (mirror):")
        for rel, live_lines, mirror_lines in config_diverged:
            print(f"  DIVERGED: {rel}  "
                  f"(.agent/config/{rel}={live_lines} lines, "
                  f"template/.agent/config/{rel}={mirror_lines} lines)")

    if only:
        blocking = ([r for r in missing if r in only]
                    + [d[0] for d in diverged if d[0] in only]
                    + [r for r in config_missing if r in only]
                    + [d[0] for d in config_diverged if d[0] in only]
                    + [k for k, _ in rules_findings if k in only])
        print()
        print(f"[scoped] gating on {len(only)} path(s): {', '.join(sorted(only))}")
        if blocking:
            print(f"FAIL — {len(blocking)} in-scope path(s) diverged or missing: "
                  f"{', '.join(sorted(blocking))}")
            return 1
        print("OK — every in-scope path is byte-identical between live and mirror. "
              "Any divergence listed above is out of this invocation's scope and "
              "is NOT gated here (run without --only, or `make audit`, for the "
              "repo-wide verdict).")
        return 0

    if missing or diverged or config_missing or config_diverged or rules_findings:
        return 1

    print()
    print(f"OK — all {len(shared)} shared execution file(s) are byte-identical "
          f"between execution/ and template/execution/.")
    print(f"OK — all {len(config_shared)} shared config file(s) are byte-identical "
          f"between .agent/config/ and template/.agent/config/.")
    print(f"OK — {rules_note} declared by {RULES_MANIFEST_REL} are present and "
          f"byte-identical at template/{RULES_LIVE_REL}/, manifest pair included.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
