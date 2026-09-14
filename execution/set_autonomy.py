#!/usr/bin/env python3
"""set_autonomy.py — the CONCLUSIVE autonomy write.

Every write here is followed by a RE-READ of the file it just wrote, and the
level is reported from that re-read rather than from the value passed in. A
setter that reports success from its own argument is reporting its intent, not
the state of the disk — which is how `make set-autonomy` shipped for months
with no confirmation that anything landed.

The logic lives in a script that takes `--root` rather than in a Makefile
recipe, because a recipe can only be exercised by running `make` in the
workspace under test: a fixture has no Makefile, and running it at the repo
root would mutate the real profile. An untestable write path is plausibly why
this one went so long unverified. `make set-autonomy` is now a thin wrapper.

Two stores, and the difference matters (REQUIREMENTS.md section 6):

* `.agent/profile.json` -> `autonomy` is the workspace DEFAULT. It is a
  recommendation for the next mission and never the authority for a mission
  that has its own record.
* `.agent/memory/project/missions/active.json` -> `autonomy` (written with
  `--mission`) is the per-mission DECISION. Writing it stamps `decided_at`,
  which is the thing that opens the decision gate — a mission without that
  stamp does not start.
"""

import argparse
import datetime
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import autonomy as autonomy_dialect  # noqa: E402  (path fixed up above)
import sync_autonomy  # noqa: E402  (path fixed up above)

PROFILE_REL = ".agent/profile.json"
ACTIVE_MISSION_REL = ".agent/memory/project/missions/active.json"
EXIT_INVALID_LEVEL = 2
EXIT_WRITE_UNCONFIRMED = 3
EXIT_POLICY_SYNC_FAILED = 4


def _timestamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _load(path):
    """The JSON document at `path`, or (None, error)."""
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except (OSError, ValueError) as exc:
        return None, f"{exc.__class__.__name__}: {exc}"


def _write(path, document):
    """Write `document` atomically. A half-written store is unreadable, and an
    unreadable autonomy store is indistinguishable from an absent one — which
    the gate treats as UNDECIDED, silently discarding a decision.
    """
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    os.replace(str(temp), str(path))


def build_record(level, decided_by=None, decided=False):
    """The autonomy object written to a store.

    `level` is stored VERBATIM — a legacy `high` stays `high`, so nothing that
    already reads the five-level vocabulary is silently rewritten underneath
    it. `normalized` and `permission_tier` are recorded alongside so no reader
    has to derive either and risk deriving it differently.
    """
    record = {
        "level": level,
        "normalized": autonomy_dialect.normalize(level),
        "permission_tier": autonomy_dialect.permission_tier(level),
        "updated_at": _timestamp(),
    }
    if decided:
        record["decided_at"] = record["updated_at"]
        record["decided_by"] = decided_by or "operator"
    return record


def apply_level(root, level, to_mission=False, decided_by=None):
    """Write the level, RE-READ it, and return (ok, target, on_disk, detail)."""
    target = root / (ACTIVE_MISSION_REL if to_mission else PROFILE_REL)
    document, error = _load(target)
    if not isinstance(document, dict):
        return False, target, None, f"cannot read {target}: {error or 'not a JSON object'}"
    if to_mission and not document.get("mission"):
        return False, target, None, (
            f"{target} names no active mission — there is nothing to decide "
            f"autonomy for. Start one with: python3 execution/mission.py new <slug>")

    document["autonomy"] = build_record(level, decided_by, decided=to_mission)
    try:
        _write(target, document)
    except OSError as exc:
        return False, target, None, f"could not write {target}: {exc}"

    # The re-read. Everything reported below comes from THIS document, not from
    # the one written above.
    reread, error = _load(target)
    if not isinstance(reread, dict):
        return False, target, None, f"wrote {target} but could not re-read it: {error}"
    stored = (reread.get("autonomy") or {}).get("level")
    if stored != level:
        return False, target, stored, (
            f"wrote level '{level}' to {target} but re-reading it returned "
            f"'{stored}' — the write did not land")
    if to_mission and not (reread.get("autonomy") or {}).get("decided_at"):
        return False, target, stored, (
            f"wrote {target} but the re-read carries no decided_at stamp — the "
            f"decision gate would still treat this mission as undecided")
    return True, target, stored, None


def resync_policy_and_cache(root):
    """Regenerate provider policy files and drop the session cache.

    execution/hooks/check_autonomy.sh reads `.claude/policies/autonomy.json`
    as authoritative and falls back to `.agent/profile.json` only when that
    policy file is absent (#1383). This setter writes ONLY profile.json, so
    without this step a workspace that has ever synced its provider policy
    once is left with the OLD level in the policy file after a level change
    -- the floor then resolves the stale, more permissive tier and fails
    OPEN. `execution/sync_autonomy.py` is the one place that already knows
    how to produce that policy file correctly; this reuses it directly
    rather than hand-rolling a second writer that could drift from it.

    Returns None on success, or an error string.
    """
    sync_rc = sync_autonomy.main(["--root", str(root)])
    if sync_rc != 0:
        return (f"wrote the new autonomy level but "
                f"execution/sync_autonomy.py --root {root} failed "
                f"(rc={sync_rc}) -- provider policy files may now disagree "
                f"with profile.json, which the floor could resolve as MORE "
                f"permissive than the level just set")

    # The floor's session cache self-invalidates whenever the policy file or
    # profile.json is newer than it (both were just rewritten above), so this
    # clear is not load-bearing for correctness -- but a cache is the guard's
    # own trust state, and leaving a soon-to-be-stale-anyway file around for
    # another process to read in the gap is not a chance worth taking here.
    for cache_path in glob.glob(str(root / ".tmp" / "athanor_autonomy_*")):
        try:
            os.remove(cache_path)
        except OSError:
            pass
    return None


def _parse_args(argv=None):
    parser = argparse.ArgumentParser(
        prog="set_autonomy.py",
        description="Set the autonomy level and verify it landed on disk.")
    parser.add_argument("--level", required=True,
                        help="interactive | autonomous | loop (the legacy "
                             "off/low/medium/high are accepted and stored "
                             "verbatim)")
    parser.add_argument("--root", default=None,
                        help="Workspace root (default: the repo this script "
                             "ships in)")
    parser.add_argument("--mission", action="store_true",
                        help="Record the DECISION for the active mission "
                             "(stamps decided_at) instead of setting the "
                             "workspace default")
    parser.add_argument("--by", default=None,
                        help="Who decided (recorded as decided_by; default: "
                             "operator)")
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(argv)
    root = Path(args.root).resolve() if args.root \
        else Path(__file__).resolve().parent.parent

    # Validate BEFORE touching the store. A validator that writes first and
    # checks afterwards leaves a rejected level on disk.
    normalised = autonomy_dialect.normalize(args.level)
    if normalised is None:
        print(f"❌ '{args.level}' is not a recognised autonomy level. Valid: "
              f"{' '.join(autonomy_dialect.LEVELS)} (legacy: "
              f"{' '.join(autonomy_dialect.LEGACY_LEVEL_MAP)}). "
              f"Nothing was written.", file=sys.stderr)
        return EXIT_INVALID_LEVEL

    ok, target, on_disk, detail = apply_level(
        root, args.level, to_mission=args.mission, decided_by=args.by)
    if not ok:
        print(f"❌ {detail}", file=sys.stderr)
        return EXIT_WRITE_UNCONFIRMED

    # Only the workspace default (profile.json) feeds the floor's fallback
    # read and shares a session cache with the policy file; a --mission
    # decision is recorded in active.json, which the floor never reads.
    if not args.mission:
        sync_error = resync_policy_and_cache(root)
        if sync_error:
            print(f"❌ {sync_error}", file=sys.stderr)
            return EXIT_POLICY_SYNC_FAILED

    scope = "mission decision" if args.mission else "workspace default"
    tier = autonomy_dialect.permission_tier(args.level)
    print(f"✅ autonomy {scope} set to: {on_disk}")
    print(f"   verified by re-read of {target.relative_to(root)}: "
          f"autonomy.level = {on_disk} (three-level: {normalised}, "
          f"permission tier: {tier})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
