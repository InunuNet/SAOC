#!/usr/bin/env python3
"""
mission.py — Multi-session mission orchestrator for Athanor.

Usage:
  mission.py new <goal> [--slug <slug>]
  mission.py validate <mission.md>
  mission.py status <mission.md> [--json]
  mission.py list [--status <enum>]
  mission.py cost <mission.md>
  mission.py checkpoint <mission.md> --feature F1 --status <enum> [--handoff <path>]
  mission.py attach-spec <mission.md> --feature F1 --spec <path> --contract <path>
  mission.py gate <mission.md> --milestone M1
  mission.py resume [<mission.md>]
  mission.py activate <mission.md>
  mission.py pause <mission.md>
  mission.py abandon <mission.md> --reason "..."
  mission.py skip <mission.md> --feature F1 --reason "..."
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────────

MISSIONS_DIR = Path(".agent/memory/project/missions")
ACTIVE_JSON = MISSIONS_DIR / "active.json"
SCHEMA = "athanor.mission/v1"
FEATURE_RE = re.compile(r"^F[0-9]+$")
MILESTONE_RE = re.compile(r"^M[0-9]+$")
VALID_STATUS = {"pending", "in_progress", "done", "blocked", "skipped", "paused", "abandoned"}
VALID_FEATURE_STATUS = {"pending", "in_progress", "done", "blocked", "skipped"}
VALID_MISSION_STATUS = {"pending", "in_progress", "done", "paused", "abandoned", "close_out"}

# ── YAML/JSON helpers ──────────────────────────────────────────────────────────

def _load_yaml():
    try:
        import yaml
        return yaml
    except ImportError:
        return None


def _dump_frontmatter(data: dict) -> str:
    yaml = _load_yaml()
    if yaml:
        return "---\n" + yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True) + "---\n"
    # Fallback: manual YAML-ish serialisation (good enough for our schema)
    lines = ["---"]
    lines.extend(_manual_yaml_dump(data, indent=0))
    lines.append("---")
    return "\n".join(lines) + "\n"


def _manual_yaml_dump(obj, indent=0):
    pad = "  " * indent
    lines = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if v is None:
                lines.append(f"{pad}{k}: null")
            elif isinstance(v, bool):
                lines.append(f"{pad}{k}: {'true' if v else 'false'}")
            elif isinstance(v, (int, float)):
                lines.append(f"{pad}{k}: {v}")
            elif isinstance(v, str):
                # Quote if needed
                if any(c in v for c in ":#{}[]|>&*?,-") or "\n" in v:
                    escaped = v.replace('"', '\\"')
                    lines.append(f'{pad}{k}: "{escaped}"')
                else:
                    lines.append(f"{pad}{k}: {v}")
            elif isinstance(v, list):
                if not v:
                    lines.append(f"{pad}{k}: []")
                else:
                    lines.append(f"{pad}{k}:")
                    for item in v:
                        if isinstance(item, dict):
                            sub = _manual_yaml_dump(item, indent + 1)
                            lines.append(f"{pad}  -")
                            for sl in sub:
                                lines.append("  " + sl)
                        else:
                            lines.append(f"{pad}  - {item}")
            elif isinstance(v, dict):
                lines.append(f"{pad}{k}:")
                lines.extend(_manual_yaml_dump(v, indent + 1))
    return lines


def parse_mission_file(path: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, body_markdown). Exits on parse error."""
    p = Path(path)
    if not p.exists():
        print(f"ERROR: mission file not found: {path}", file=sys.stderr)
        sys.exit(1)
    content = p.read_text()
    if not content.startswith("---"):
        print(f"ERROR: {path} has no YAML frontmatter", file=sys.stderr)
        sys.exit(1)
    # Split on second ---
    parts = content.split("---", 2)
    if len(parts) < 3:
        print(f"ERROR: {path} frontmatter is not closed with ---", file=sys.stderr)
        sys.exit(1)
    raw_fm = parts[1].strip()
    body = parts[2] if len(parts) > 2 else ""

    yaml = _load_yaml()
    if yaml:
        try:
            fm = yaml.safe_load(raw_fm)
        except Exception as e:
            print(f"ERROR: YAML parse error in {path}: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Try json-like fallback (won't work for most missions — require pyyaml)
        print("ERROR: PyYAML not installed. Run: pip install pyyaml", file=sys.stderr)
        sys.exit(1)

    if not isinstance(fm, dict):
        print(f"ERROR: frontmatter is not a dict in {path}", file=sys.stderr)
        sys.exit(1)
    return fm, body


def write_mission_file(path: str, fm: dict, body: str):
    """Atomically write mission file."""
    content = _dump_frontmatter(fm) + body
    tmp = path + ".tmp"
    Path(tmp).write_text(content)
    os.replace(tmp, path)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_active() -> dict | None:
    if not ACTIVE_JSON.exists():
        return None
    try:
        return json.loads(ACTIVE_JSON.read_text())
    except Exception:
        return None


def write_active(mission_path: str, checkpoint: dict | None = None):
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "mission": str(mission_path),
        "checkpoint": checkpoint or {"milestone": None, "feature": None},
        "activated_at": now_iso(),
    }
    tmp = str(ACTIVE_JSON) + ".tmp"
    Path(tmp).write_text(json.dumps(data, indent=2))
    os.replace(tmp, str(ACTIVE_JSON))


def clear_active():
    if ACTIVE_JSON.exists():
        ACTIVE_JSON.unlink()


# ── Subcommands ────────────────────────────────────────────────────────────────

def cmd_new(args):
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)

    goal = args.goal
    slug = args.slug if args.slug else re.sub(r"[^a-z0-9]+", "-", goal.lower()).strip("-")[:40]
    date_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"{date_prefix}-{slug}.md"
    out_path = MISSIONS_DIR / filename

    # Cross-date slug collision scan: find any *-{slug}.md regardless of date prefix.
    # Skip the current out_path (same-day exact match is handled by the next block).
    for existing in MISSIONS_DIR.glob(f"*-{slug}.md"):
        if existing == out_path:
            continue
        try:
            fm, _ = parse_mission_file(str(existing))
        except SystemExit:
            # Malformed mission frontmatter — skip silently rather than crashing.
            continue
        except Exception:
            continue
        if fm.get("slug") != slug:
            continue
        existing_status = fm.get("status", "")
        if existing_status == "done":
            print(f"NOTE: mission slug '{slug}' previously completed: {existing}", file=sys.stderr)
            print(f"Creating new mission with same slug under today's date prefix.", file=sys.stderr)
            continue
        else:
            print(f"ERROR: mission slug '{slug}' already exists with status={existing_status!r}: {existing}", file=sys.stderr)
            print("Resume that mission instead, or rename the slug.", file=sys.stderr)
            sys.exit(1)

    if out_path.exists():
        print(f"ERROR: mission file already exists: {out_path}", file=sys.stderr)
        sys.exit(1)

    fm = {
        "schema": SCHEMA,
        "slug": slug,
        "goal": goal,
        "created_at": now_iso(),
        "started_at": None,
        "last_active_at": None,
        "status": "pending",
        "cost_estimate": {
            "features": 0,
            "milestones": 0,
            "total_calls": 0,
        },
        "last_checkpoint": {
            "milestone": None,
            "feature": None,
            "ts": None,
        },
        "features": [],
        "milestones": [],
    }
    body = f"\n# Mission: {goal}\n\n## Context\n\n(Add context here)\n\n## Notes\n\n"
    write_mission_file(str(out_path), fm, body)
    write_active(str(out_path))

    print(f"Created: {out_path}")
    print(f"Active:  {ACTIVE_JSON}")
    print(f"Next:    Edit {out_path} to add features and milestones, then run:")
    print(f"           python3 execution/mission.py validate {out_path}")
    print("ACTION_REQUIRED: /compact")


def cmd_validate(args):
    fm, _ = parse_mission_file(args.mission)
    errors = []

    # Schema
    if fm.get("schema") != SCHEMA:
        errors.append(f"schema must be '{SCHEMA}', got: {fm.get('schema')!r}")

    # Required top-level fields
    for field in ["schema", "slug", "goal", "created_at", "status", "features", "milestones"]:
        if field not in fm:
            errors.append(f"Missing required field: {field}")

    # Status
    status = fm.get("status", "")
    if status not in VALID_MISSION_STATUS:
        errors.append(f"Invalid mission status: {status!r}. Valid: {sorted(VALID_MISSION_STATUS)}")

    features = fm.get("features", [])
    milestones = fm.get("milestones", [])

    # Feature IDs unique and format
    feature_ids = set()
    for f in features:
        fid = f.get("id", "")
        if not FEATURE_RE.match(fid):
            errors.append(f"Feature ID must match ^F[0-9]+$: {fid!r}")
        if fid in feature_ids:
            errors.append(f"Duplicate feature ID: {fid}")
        feature_ids.add(fid)

        # spec or inline_brief
        has_spec = bool(f.get("spec"))
        has_brief = bool(f.get("inline_brief"))
        if has_spec and has_brief:
            errors.append(f"Feature {fid}: cannot have both spec and inline_brief")
        if not has_spec and not has_brief:
            errors.append(f"Feature {fid}: must have either spec or inline_brief")

        # Feature status
        fstatus = f.get("status", "")
        if fstatus not in VALID_FEATURE_STATUS:
            errors.append(f"Feature {fid} invalid status: {fstatus!r}")

    # Milestone IDs unique and format
    milestone_ids = set()
    milestone_feature_refs = set()
    for m in milestones:
        mid = m.get("id", "")
        if not MILESTONE_RE.match(mid):
            errors.append(f"Milestone ID must match ^M[0-9]+$: {mid!r}")
        if mid in milestone_ids:
            errors.append(f"Duplicate milestone ID: {mid}")
        milestone_ids.add(mid)

        for fid in m.get("features", []):
            if fid in milestone_feature_refs:
                errors.append(f"Feature {fid} appears in multiple milestones")
            milestone_feature_refs.add(fid)

    # Every feature must appear in exactly one milestone
    for fid in feature_ids:
        if fid not in milestone_feature_refs:
            errors.append(f"Feature {fid} is not referenced in any milestone")

    if errors:
        for e in errors:
            print(f"  x {e}")
        sys.exit(1)

    print(f"Valid: {args.mission}")
    print(f"  {len(features)} feature(s), {len(milestones)} milestone(s), status={status}")


def _feature_summary(fm: dict) -> dict:
    """Return per-status feature counts."""
    counts = {}
    for f in fm.get("features", []):
        s = f.get("status", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return counts


def _milestone_summary(fm: dict) -> list[dict]:
    out = []
    for m in fm.get("milestones", []):
        feat_ids = m.get("features", [])
        feats = {f["id"]: f for f in fm.get("features", [])}
        statuses = [feats[fid]["status"] for fid in feat_ids if fid in feats]
        done = sum(1 for s in statuses if s == "done")
        out.append({
            "id": m["id"],
            "name": m.get("name", ""),
            "status": m.get("status", "pending"),
            "features_total": len(feat_ids),
            "features_done": done,
            "gate_result": m.get("gate_result"),
        })
    return out


def cmd_status(args):
    fm, _ = parse_mission_file(args.mission)
    feat_counts = _feature_summary(fm)
    ms_summary = _milestone_summary(fm)

    total_features = len(fm.get("features", []))
    done_features = feat_counts.get("done", 0)
    total_milestones = len(fm.get("milestones", []))
    done_milestones = sum(1 for m in ms_summary if m["status"] == "done")

    if args.json:
        print(json.dumps({
            "slug": fm.get("slug"),
            "goal": fm.get("goal"),
            "status": fm.get("status"),
            "features_total": total_features,
            "features_done": done_features,
            "feature_counts": feat_counts,
            "milestones": ms_summary,
            "last_checkpoint": fm.get("last_checkpoint"),
            "cost_estimate": fm.get("cost_estimate"),
        }, indent=2))
        return

    print(f"Mission: {fm.get('slug')} — {fm.get('goal')}")
    print(f"Status:  {fm.get('status')} | Features: {done_features}/{total_features} done | Milestones: {done_milestones}/{total_milestones} done")
    print()
    print("Features:")
    for f in fm.get("features", []):
        icon = {"done": "✓", "in_progress": "→", "blocked": "✗", "skipped": "~"}.get(f["status"], "·")
        print(f"  {icon} {f['id']} [{f['status']:<12}] {f.get('title', f.get('name', ''))}")
    print()
    print("Milestones:")
    for m in ms_summary:
        gate = f" gate={m['gate_result']}" if m["gate_result"] else ""
        print(f"  M {m['id']} [{m['status']:<10}] {m['name']} ({m['features_done']}/{m['features_total']} features done{gate})")

    cp = fm.get("last_checkpoint", {})
    if cp and (cp.get("milestone") or cp.get("feature")):
        print()
        print(f"Last checkpoint: milestone={cp.get('milestone')} feature={cp.get('feature')} at {cp.get('ts','?')}")


def cmd_list(args):
    MISSIONS_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(MISSIONS_DIR.glob("*.md"))
    if not files:
        print("(no missions found)")
        return

    active = read_active()
    active_path = active["mission"] if active else None

    filter_status = args.status

    for f in files:
        try:
            fm, _ = parse_mission_file(str(f))
        except SystemExit:
            print(f"  ! {f.name} (parse error)")
            continue
        status = fm.get("status", "?")
        if filter_status and status != filter_status:
            continue
        is_active = str(f) == active_path or f.name == Path(active_path).name if active_path else False
        marker = " [ACTIVE]" if is_active else ""
        print(f"  {status:<12} {f.name}{marker} — {fm.get('goal','?')[:60]}")


def cmd_cost(args):
    fm, _ = parse_mission_file(args.mission)
    n_features = len(fm.get("features", []))
    n_milestones = len(fm.get("milestones", []))
    total = n_features + 2 * n_milestones
    print(f"Cost estimate for '{fm.get('slug', args.mission)}':")
    print(f"  Features:   {n_features} agent calls")
    print(f"  Milestones: {n_milestones} × 2 (gate + wrap) = {2*n_milestones} calls")
    print(f"  total≈{total} calls")

    # Update cost_estimate in file
    fm.setdefault("cost_estimate", {})
    fm["cost_estimate"]["features"] = n_features
    fm["cost_estimate"]["milestones"] = n_milestones
    fm["cost_estimate"]["total_calls"] = total
    _, body = parse_mission_file(args.mission)
    write_mission_file(args.mission, fm, body)


def cmd_checkpoint(args):
    fm, body = parse_mission_file(args.mission)

    fid = args.feature
    new_status = args.status

    if new_status not in VALID_FEATURE_STATUS:
        print(f"ERROR: invalid status {new_status!r}. Valid: {sorted(VALID_FEATURE_STATUS)}", file=sys.stderr)
        sys.exit(1)

    # Find feature
    feature = next((f for f in fm.get("features", []) if f["id"] == fid), None)
    if not feature:
        print(f"ERROR: feature {fid} not found in mission", file=sys.stderr)
        sys.exit(1)

    old_status = feature["status"]
    feature["status"] = new_status

    if new_status == "in_progress" and not feature.get("started_at"):
        feature["started_at"] = now_iso()
    if new_status == "done" and not feature.get("completed_at"):
        feature["completed_at"] = now_iso()

    if args.handoff:
        feature["handoff"] = args.handoff

    # Update mission-level checkpoint
    ts = now_iso()
    fm["last_checkpoint"] = {
        "milestone": _find_milestone_for_feature(fm, fid),
        "feature": fid,
        "ts": ts,
    }
    fm["last_active_at"] = ts

    # Update mission status
    if fm["status"] == "pending" and new_status == "in_progress":
        fm["status"] = "in_progress"
        if not fm.get("started_at"):
            fm["started_at"] = ts

    # Update active.json checkpoint
    active = read_active()
    if active:
        write_active(active["mission"], fm["last_checkpoint"])

    write_mission_file(args.mission, fm, body)
    print(f"Checkpoint: {fid} {old_status} → {new_status}")


def _find_milestone_for_feature(fm: dict, fid: str) -> str | None:
    for m in fm.get("milestones", []):
        if fid in m.get("features", []):
            return m["id"]
    return None


def cmd_attach_spec(args):
    fm, body = parse_mission_file(args.mission)

    fid = args.feature
    feature = next((f for f in fm.get("features", []) if f["id"] == fid), None)
    if not feature:
        print(f"ERROR: feature {fid} not found", file=sys.stderr)
        sys.exit(1)

    feature["spec"] = args.spec
    feature["contract"] = args.contract
    # Clear inline_brief if we're attaching a spec
    if feature.get("inline_brief"):
        feature["inline_brief"] = None

    write_mission_file(args.mission, fm, body)
    print(f"Attached spec={args.spec} contract={args.contract} to {fid}")


def cmd_gate(args):
    fm, body = parse_mission_file(args.mission)

    mid = args.milestone
    milestone = next((m for m in fm.get("milestones", []) if m["id"] == mid), None)
    if not milestone:
        print(f"ERROR: milestone {mid} not found", file=sys.stderr)
        sys.exit(1)

    feature_ids = milestone.get("features", [])
    features_by_id = {f["id"]: f for f in fm.get("features", [])}

    any_fail = False
    skipped = 0
    ran = 0

    for fid in feature_ids:
        f = features_by_id.get(fid)
        if not f:
            print(f"  WARNING: feature {fid} referenced in milestone but not defined")
            continue

        # If feature is skipped, skip its gate
        if f["status"] == "skipped":
            print(f"  SKIP {fid}: feature is skipped")
            skipped += 1
            continue

        contract = f.get("contract")
        if not contract:
            # No contract — if feature is done, count as pass; otherwise warn
            if f["status"] == "done":
                print(f"  PASS {fid}: done (no contract)")
            elif f["status"] in ("pending", "in_progress"):
                print(f"  FAIL {fid}: status={f['status']} (not done, no contract)")
                any_fail = True
            else:
                print(f"  PASS {fid}: status={f['status']} (no contract)")
            ran += 1
            continue

        # Run contract gate
        contract_path = contract
        if not Path(contract_path).exists():
            print(f"  FAIL {fid}: contract file not found: {contract_path}")
            any_fail = True
            ran += 1
            continue

        result = subprocess.run(
            [sys.executable, "execution/contract.py", "gate", contract_path, "--phase", "max", "--run-checks"],
            capture_output=True, text=True
        )
        print(f"  {'PASS' if result.returncode == 0 else 'FAIL'} {fid} (contract gate exit={result.returncode}):")
        for line in (result.stdout + result.stderr).strip().splitlines():
            print(f"    {line}")
        if result.returncode != 0:
            any_fail = True
        ran += 1

    # Update milestone status
    ts = now_iso()
    milestone["gate_ran_at"] = ts
    if any_fail:
        milestone["gate_result"] = "fail"
        write_mission_file(args.mission, fm, body)
        print(f"\nFAIL Milestone {mid} gate FAILED — resolve failing features before advancing.")
        sys.exit(2)
    else:
        milestone["gate_result"] = "pass"
        milestone["status"] = "done"
        # Check if all milestones done → mission done
        all_done = all(m.get("status") == "done" for m in fm.get("milestones", []))
        if all_done:
            fm["status"] = "done"
        write_mission_file(args.mission, fm, body)
        print(f"\nPASS Milestone {mid} gate passed ({ran} ran, {skipped} skipped).")
        if all_done:
            print("All milestones complete. Mission status → done.")


def cmd_resume(args):
    mission_path = None
    if args.mission:
        mission_path = args.mission
    else:
        active = read_active()
        if not active:
            print("No active mission. Run: python3 execution/mission.py list")
            sys.exit(0)
        mission_path = active.get("mission")
        if not mission_path:
            print("No active mission. Run: python3 execution/mission.py list")
            sys.exit(0)

    if not Path(mission_path).exists():
        print(f"(active mission pointer is stale — run: python3 execution/mission.py list)")
        sys.exit(0)

    fm, body = parse_mission_file(mission_path)

    # Find next action
    # 1. Find first incomplete feature
    features = fm.get("features", [])
    milestones = fm.get("milestones", [])

    # Find milestones in order
    for m in milestones:
        if m.get("status") == "done":
            continue
        mid = m["id"]
        fids = m.get("features", [])
        feat_map = {f["id"]: f for f in features}

        # Find first non-done, non-skipped feature in this milestone
        pending_features = [fid for fid in fids if feat_map.get(fid, {}).get("status") not in ("done", "skipped")]
        if pending_features:
            fid = pending_features[0]
            feat = feat_map[fid]
            print(f"RESUME: run /spec for {fid} '{feat.get('title', '')}' (milestone {mid})")
            return

        # All features in milestone are done/skipped — need gate
        gate_result = m.get("gate_result")
        if gate_result != "pass":
            print(f"RESUME: run mission.py gate --milestone {mid} '{m.get('name', '')}'")
            return

    # All milestones done
    all_ms_done = all(m.get("status") == "done" for m in milestones)
    if all_ms_done and milestones:
        fm["status"] = "close_out"
        fm["last_active_at"] = now_iso()
        write_mission_file(mission_path, fm, body)
        slug = fm.get("slug", Path(mission_path).stem)
        print(f"MAINTAINER WRAP-UP REQUIRED — dispatch @maintainer. Run: python3 execution/mission.py close-out {mission_path}")
        sys.exit(2)
    elif not milestones:
        print("RESUME: no milestones defined — edit mission file to add features and milestones")
    else:
        remaining = [m for m in milestones if m.get("status") != "done"]
        if remaining:
            print(f"RESUME: run mission.py gate --milestone {remaining[0]['id']} for remaining milestones")


def cmd_close_out(args):
    fm, body = parse_mission_file(args.mission)
    if fm.get("status") != "close_out":
        print(
            f"ERROR: mission status is '{fm.get('status')}', expected 'close_out'. "
            "Run mission.py resume first.",
            file=sys.stderr,
        )
        sys.exit(1)
    slug = fm.get("slug", Path(args.mission).stem)
    goal = fm.get("goal", "")
    result = subprocess.run(
        ["python3", "execution/brain.py", "wrap-up", "-s", f"{slug}: {goal}", "-t", f"mission,{slug},complete"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ERROR: brain wrap-up failed:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    fm["status"] = "done"
    fm["completed_at"] = now_iso()
    fm["last_active_at"] = now_iso()
    write_mission_file(args.mission, fm, body)
    clear_active()
    print("DONE: mission closed. Commit now.")


def cmd_activate(args):
    fm, _ = parse_mission_file(args.mission)
    write_active(args.mission)
    print(f"Activated: {args.mission}")


def cmd_pause(args):
    fm, body = parse_mission_file(args.mission)
    fm["status"] = "paused"
    fm["last_active_at"] = now_iso()
    write_mission_file(args.mission, fm, body)
    clear_active()
    print(f"Paused: {args.mission}")
    print("active.json cleared.")


def cmd_abandon(args):
    fm, body = parse_mission_file(args.mission)
    fm["status"] = "abandoned"
    fm["last_active_at"] = now_iso()
    if not fm.get("notes"):
        fm["notes"] = ""
    fm["notes"] = (fm.get("notes", "") + f"\nAbandoned: {args.reason}").strip()
    write_mission_file(args.mission, fm, body)

    active = read_active()
    if active and active.get("mission") == args.mission:
        clear_active()
    print(f"Abandoned: {args.mission}")
    print(f"Reason: {args.reason}")


def cmd_skip(args):
    fm, body = parse_mission_file(args.mission)

    fid = args.feature
    feature = next((f for f in fm.get("features", []) if f["id"] == fid), None)
    if not feature:
        print(f"ERROR: feature {fid} not found", file=sys.stderr)
        sys.exit(1)

    old_status = feature["status"]
    feature["status"] = "skipped"
    feature["notes"] = (feature.get("notes", "") + f"\nSkipped: {args.reason}").strip()

    write_mission_file(args.mission, fm, body)
    print(f"Skipped: {fid} ({old_status} → skipped)")
    print(f"Reason: {args.reason}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Athanor Mission Orchestrator")
    sub = parser.add_subparsers(dest="cmd")

    # new
    p_new = sub.add_parser("new", help="Create a new mission")
    p_new.add_argument("goal", help="Goal string for this mission")
    p_new.add_argument("--slug", help="Override auto-generated slug")

    # validate
    p_val = sub.add_parser("validate", help="Validate mission schema")
    p_val.add_argument("mission", help="Path to mission .md file")

    # status
    p_status = sub.add_parser("status", help="Print mission progress")
    p_status.add_argument("mission", help="Path to mission .md file")
    p_status.add_argument("--json", action="store_true", default=False)

    # list
    p_list = sub.add_parser("list", help="List all missions")
    p_list.add_argument("--status", help="Filter by status")

    # cost
    p_cost = sub.add_parser("cost", help="Estimate mission call cost")
    p_cost.add_argument("mission", help="Path to mission .md file")

    # checkpoint
    p_cp = sub.add_parser("checkpoint", help="Update feature status")
    p_cp.add_argument("mission", help="Path to mission .md file")
    p_cp.add_argument("--feature", required=True, help="Feature ID (e.g. F1)")
    p_cp.add_argument("--status", required=True, help="New status")
    p_cp.add_argument("--handoff", help="Path to handoff JSON file")

    # attach-spec
    p_as = sub.add_parser("attach-spec", help="Attach spec+contract to a feature")
    p_as.add_argument("mission", help="Path to mission .md file")
    p_as.add_argument("--feature", required=True)
    p_as.add_argument("--spec", required=True)
    p_as.add_argument("--contract", required=True)

    # gate
    p_gate = sub.add_parser("gate", help="Run milestone gate")
    p_gate.add_argument("mission", help="Path to mission .md file")
    p_gate.add_argument("--milestone", required=True, help="Milestone ID (e.g. M1)")

    # resume
    p_resume = sub.add_parser("resume", help="Print next action for active mission")
    p_resume.add_argument("mission", nargs="?", help="Path to mission .md (defaults to active.json)")

    # activate
    p_act = sub.add_parser("activate", help="Set a mission as active")
    p_act.add_argument("mission", help="Path to mission .md file")

    # pause
    p_pause = sub.add_parser("pause", help="Pause a mission")
    p_pause.add_argument("mission", help="Path to mission .md file")

    # abandon
    p_abandon = sub.add_parser("abandon", help="Abandon a mission")
    p_abandon.add_argument("mission", help="Path to mission .md file")
    p_abandon.add_argument("--reason", required=True)

    # skip
    p_skip = sub.add_parser("skip", help="Skip a feature")
    p_skip.add_argument("mission", help="Path to mission .md file")
    p_skip.add_argument("--feature", required=True)
    p_skip.add_argument("--reason", required=True)

    # close-out
    p_co = sub.add_parser("close-out", help="Complete @maintainer wrap-up and mark mission done")
    p_co.add_argument("mission", help="Path to mission .md file")

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        sys.exit(1)

    cmd_map = {
        "new": cmd_new,
        "validate": cmd_validate,
        "status": cmd_status,
        "list": cmd_list,
        "cost": cmd_cost,
        "checkpoint": cmd_checkpoint,
        "attach-spec": cmd_attach_spec,
        "gate": cmd_gate,
        "resume": cmd_resume,
        "close-out": cmd_close_out,
        "activate": cmd_activate,
        "pause": cmd_pause,
        "abandon": cmd_abandon,
        "skip": cmd_skip,
    }
    cmd_map[args.cmd](args)


if __name__ == "__main__":
    main()
