#!/usr/bin/env python3
"""
verify_retraction_mechanism.py — delivered-value-retraction F1: a
mechanism for update_template.py to correct a value it PREVIOUSLY
delivered and now knows was wrong, when upstream's own reconciliation
(json_deep_merge -> deep_merge) can only ADD/OVERWRITE keys upstream
CURRENTLY has and can never retract a key upstream no longer ships.

Concrete real-world instance this closes: Alembic's .claude/settings.json
picked up a literal, unexpanded
  "env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": "$ANTHROPIC_DEFAULT_HAIKU_MODEL"}
via our own 3.7.100 -> 3.7.103 delivery. Claude Code does not shell-expand
settings env values, so the literal string became the haiku-tier model id
and killed Agent-tool dispatch for three of Alembic's agents. The bad key
exists in NEITHER current upstream nor template/.claude/settings.json, so
no future --apply can ever remove it: deep_merge() (update_template.py)
only ever adds/overwrites keys present in `override` (the incoming
source); a key ABSENT from override is never touched in `base` (the
workspace's existing file), by construction of the recursive-merge loop
in that function. This script proves that gap and then verifies the
fix: a manifest-driven `retractions:` list + `apply_retractions()`.

DESIGN UNDER TEST (SPEC.md, delivered-value-retraction):
  .agent/update-manifest.yaml gains an optional top-level `retractions:`
  list. Each entry:
    path:        destination file (workspace-relative)
    key_path:    dotted path into the parsed JSON, e.g. "env.FOO"
    bad_value:   the EXACT value that must currently be present for this
                 entry to fire (JSON-comparable: str/int/float/bool/null)
    action:      "remove" | "replace"
    replacement: value to write when action == "replace" (absent/null for
                 "remove")
    reason:      human-readable audit text (why this was ever delivered
                 and why it is wrong)
    issue:       optional issue id/URL
  apply_retractions(manifest, project_root, backup_dir, dry_run) walks
  every entry, loads `path` as JSON, resolves `key_path`, and ONLY acts
  if the CURRENT value at that key is byte-for-byte/JSON-equal to
  `bad_value`. A deliberately-set DIFFERENT local value at the same key
  is left completely untouched -- retraction is a targeted signature
  match against a known-bad literal, never a blanket "this key is
  suspicious" sweep. Matching requires NO history/ledger of what was
  previously delivered: the signature is hardcoded in the manifest entry
  itself, so it fires identically on a workspace onboarded five versions
  ago with never a single retraction-aware run, exactly the state EVERY
  real Alembic-class workspace is in today. A backup of the file is taken
  before the write (reusing the existing backup_dir + symlink-refusal
  machinery every other write site in this module already uses), and
  every fired retraction is appended to a durable, human-readable audit
  log at .agent/memory/scratch/retractions_applied.json (path, key_path,
  old value, new value/removed, reason, issue, timestamp) AND printed to
  stdout during the run -- so a workspace is always told what was removed
  and why, and can recover the prior value from the backup if desired.

FOUR ROWS, mirroring the existing F1-F9 provenance-matrix rigor:
  ROW A (the reported defect, NO ledger present): a fresh fixture
    workspace -- no .agent/memory/scratch/template_baselines.json, no
    retraction log, nothing -- whose .claude/settings.json carries the
    exact bad literal. A single retraction-aware --apply-equivalent run
    must remove it. This is the row that proves the mechanism does NOT
    require history to work, since real workspaces have none.
  ROW B (deliberate local edit must survive): same key, but the
    workspace operator intentionally set it to a real, different model
    id. Must be left completely unchanged -- proves the signature match
    is exact-value, not "any value at this key path is fair game."
  ROW C (audit trail): after ROW A's retraction fires, the audit log
    names the path, key_path, old/new value, and the human-readable
    reason -- not merely a silent edit.
  ROW D (reversibility): after ROW A's retraction fires, the PRE-
    retraction file content is recoverable from the backup directory the
    run created -- retraction is never destructive-without-a-trail.

Usage: verify_retraction_mechanism.py
Exit codes: 0 pass, 1 fail.
"""
import json
import shutil
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "execution"))

BAD_LITERAL = "$ANTHROPIC_DEFAULT_HAIKU_MODEL"
DELIBERATE_VALUE = "claude-haiku-4-5-20251001"

RETRACTION_ENTRY = {
    "path": ".claude/settings.json",
    "key_path": "env.ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "bad_value": BAD_LITERAL,
    "action": "remove",
    "reason": (
        "delivered by 3.7.100-3.7.103 via json_deep_merge; Claude Code "
        "does not shell-expand settings env values, so this unexpanded "
        "self-referencing literal became the haiku-tier model id and "
        "broke Agent-tool dispatch for model:haiku agents"
    ),
    "issue": "delivered-value-retraction-F1",
}


def _make_fixture(tmp_root: Path, settings_value) -> Path:
    settings_dir = tmp_root / ".claude"
    settings_dir.mkdir(parents=True, exist_ok=True)
    settings_path = settings_dir / "settings.json"
    settings_path.write_text(json.dumps({"env": {"ANTHROPIC_DEFAULT_HAIKU_MODEL": settings_value}}, indent=2) + "\n")
    return settings_path


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def ok(msg: str) -> int:
    print(f"PASS: {msg}")
    return 0


def main() -> int:
    try:
        import update_template  # noqa: F401
    except Exception as e:
        return fail(f"cannot import execution/update_template.py at all: {e}")

    if not hasattr(update_template, "apply_retractions"):
        return fail(
            "update_template.apply_retractions() does not exist -- the "
            "retraction mechanism (delivered-value-retraction F1) is not "
            "implemented. deep_merge()/json_deep_merge() only ever "
            "add/overwrite keys present in the incoming source; nothing "
            "in this module today can ever remove or correct a key "
            "upstream no longer ships. Reproduced directly: deep_merge("
            f"{{'env': {{'ANTHROPIC_DEFAULT_HAIKU_MODEL': {BAD_LITERAL!r}}}}}, "
            "{}) leaves the bad key fully intact -- "
            f"{update_template.deep_merge({'env': {'ANTHROPIC_DEFAULT_HAIKU_MODEL': BAD_LITERAL}}, {})}"
        )

    results = {}

    # ROW A: no ledger present at all, bad literal present -> must retract.
    tmp_a = Path(tempfile.mkdtemp(prefix="retraction-rowA-"))
    try:
        settings_path = _make_fixture(tmp_a, BAD_LITERAL)
        ledger_dir = tmp_a / ".agent" / "memory" / "scratch"
        if ledger_dir.exists():
            return fail("ROW A fixture setup bug: a scratch dir already existed")
        backup_dir = tmp_a / ".agent" / "memory" / "scratch" / "retraction-backup"
        manifest = {"retractions": [RETRACTION_ENTRY]}
        update_template.apply_retractions(manifest, project_root=tmp_a, backup_dir=backup_dir, dry_run=False)
        after = json.loads(settings_path.read_text())
        env = after.get("env", {})
        row_a_pass = "ANTHROPIC_DEFAULT_HAIKU_MODEL" not in env
        results["ROW A (no-ledger retraction fires)"] = row_a_pass
        print(f"[ROW A] no pre-existing ledger, bad literal present -> after apply_retractions, env={env} "
              f"({'retracted' if row_a_pass else 'STILL PRESENT'})")

        # ROW C: audit trail.
        log_path = tmp_a / ".agent" / "memory" / "scratch" / "retractions_applied.json"
        row_c_pass = False
        if log_path.exists():
            try:
                log = json.loads(log_path.read_text())
                entries = log if isinstance(log, list) else log.get("retractions", [])
                row_c_pass = any(
                    isinstance(e, dict)
                    and e.get("key_path") == "env.ANTHROPIC_DEFAULT_HAIKU_MODEL"
                    and BAD_LITERAL in json.dumps(e)
                    and "reason" in e
                    for e in entries
                )
            except Exception:
                row_c_pass = False
        results["ROW C (audit trail records what/why)"] = row_c_pass
        print(f"[ROW C] audit log at {log_path}: {'present and names the retraction' if row_c_pass else 'MISSING or incomplete'}")

        # ROW D: reversibility via backup.
        row_d_pass = False
        if backup_dir.exists():
            for candidate in backup_dir.rglob("settings.json"):
                try:
                    backed_up = json.loads(candidate.read_text())
                except Exception:
                    continue
                if backed_up.get("env", {}).get("ANTHROPIC_DEFAULT_HAIKU_MODEL") == BAD_LITERAL:
                    row_d_pass = True
                    break
        results["ROW D (pre-retraction content recoverable from backup)"] = row_d_pass
        print(f"[ROW D] backup under {backup_dir}: {'pre-retraction content recoverable' if row_d_pass else 'NOT FOUND'}")
    finally:
        shutil.rmtree(tmp_a, ignore_errors=True)

    # ROW B: deliberate local value at the same key must survive untouched.
    tmp_b = Path(tempfile.mkdtemp(prefix="retraction-rowB-"))
    try:
        settings_path = _make_fixture(tmp_b, DELIBERATE_VALUE)
        backup_dir = tmp_b / ".agent" / "memory" / "scratch" / "retraction-backup"
        manifest = {"retractions": [RETRACTION_ENTRY]}
        update_template.apply_retractions(manifest, project_root=tmp_b, backup_dir=backup_dir, dry_run=False)
        after = json.loads(settings_path.read_text())
        row_b_pass = after.get("env", {}).get("ANTHROPIC_DEFAULT_HAIKU_MODEL") == DELIBERATE_VALUE
        results["ROW B (deliberate different local value untouched)"] = row_b_pass
        print(f"[ROW B] deliberate local value {DELIBERATE_VALUE!r} -> after apply_retractions, "
              f"value={after.get('env', {}).get('ANTHROPIC_DEFAULT_HAIKU_MODEL')!r} "
              f"({'untouched' if row_b_pass else 'WRONGLY CLOBBERED'})")
    finally:
        shutil.rmtree(tmp_b, ignore_errors=True)

    # ROW E: a malformed entry (missing required keys) must not crash the
    # whole pass, and a well-formed entry LATER in the same list must still
    # fire -- proves this is SKIP-and-continue, not merely "does not raise".
    # Kills two distinct shortcuts: (a) an uncaught KeyError from direct
    # `entry["key_path"]` indexing propagating out of apply_retractions
    # entirely (main()'s try/finally at update_template.py has no except,
    # so this would kill the whole --apply run after other HARNESS/MERGE
    # writes already landed); (b) an implementation that wraps the per-entry
    # body in try/except but `continue`s the OUTER caller instead of the
    # loop, or `return`s early, silently dropping every entry after the
    # first bad one -- that shortcut passes "does not raise" but fails
    # "valid entry still fires", which is the property actually asserted
    # here.
    MALFORMED_MISSING_KEYS = {"path": ".claude/settings.json", "action": "remove"}
    tmp_e = Path(tempfile.mkdtemp(prefix="retraction-rowE-"))
    try:
        settings_path = _make_fixture(tmp_e, BAD_LITERAL)
        backup_dir = tmp_e / ".agent" / "memory" / "scratch" / "retraction-backup"
        manifest = {"retractions": [MALFORMED_MISSING_KEYS, RETRACTION_ENTRY]}
        row_e_pass = True
        row_e_detail = ""
        try:
            update_template.apply_retractions(manifest, project_root=tmp_e, backup_dir=backup_dir, dry_run=False)
        except Exception as e:
            row_e_pass = False
            row_e_detail = f"apply_retractions RAISED on a malformed entry instead of skip-and-continue: {e.__class__.__name__}: {e}"
        if row_e_pass:
            after = json.loads(settings_path.read_text())
            fired = "ANTHROPIC_DEFAULT_HAIKU_MODEL" not in after.get("env", {})
            row_e_pass = fired
            row_e_detail = (
                "malformed entry skipped, well-formed entry after it still fired" if fired
                else "call did not raise, but the well-formed entry AFTER the malformed one never fired -- "
                     "processing stopped instead of skip-and-continue"
            )
        results["ROW E (malformed entry: missing keys, skip-and-continue)"] = row_e_pass
        print(f"[ROW E] {row_e_detail}")
    finally:
        shutil.rmtree(tmp_e, ignore_errors=True)

    # ROW F: manifest["retractions"] itself is not a list (e.g. a hand-
    # authored YAML typo collapsing the list into a single mapping). Kills
    # the shortcut of only guarding individual entries (`for entry in
    # entries: entry["path"]`) while still doing `for entry in entries`
    # over a dict -- Python happily iterates a dict's KEYS as strings, so
    # `entry["path"]` on a string raises TypeError, not KeyError, a
    # DIFFERENT uncaught exception than ROW E's -- a fix that only wraps
    # entry[...] indexing without also validating the top-level shape can
    # still crash here.
    tmp_f = Path(tempfile.mkdtemp(prefix="retraction-rowF-"))
    try:
        settings_path = _make_fixture(tmp_f, BAD_LITERAL)
        backup_dir = tmp_f / ".agent" / "memory" / "scratch" / "retraction-backup"
        manifest = {"retractions": dict(RETRACTION_ENTRY)}  # a dict, not a list
        row_f_pass = True
        row_f_detail = ""
        try:
            update_template.apply_retractions(manifest, project_root=tmp_f, backup_dir=backup_dir, dry_run=False)
        except Exception as e:
            row_f_pass = False
            row_f_detail = f"apply_retractions RAISED when retractions: was not a list: {e.__class__.__name__}: {e}"
        if row_f_pass:
            after = json.loads(settings_path.read_text())
            unchanged = after.get("env", {}).get("ANTHROPIC_DEFAULT_HAIKU_MODEL") == BAD_LITERAL
            row_f_pass = unchanged
            row_f_detail = (
                "malformed top-level shape handled gracefully, file left untouched" if unchanged
                else "call did not raise, but it mutated the file despite a malformed top-level 'retractions' shape"
            )
        results["ROW F (retractions: not a list, top-level shape guard)"] = row_f_pass
        print(f"[ROW F] {row_f_detail}")
    finally:
        shutil.rmtree(tmp_f, ignore_errors=True)

    # ROW G: destination file is read-only at write time (backup/read still
    # succeed; only the final write_text() fails). Kills two shortcuts:
    # (a) an uncaught PermissionError from `dst.write_text(...)` propagating
    # out of apply_retractions entirely (the only unguarded write call in
    # the function -- read, backup copy2, and the symlink checks are all
    # already wrapped or inherently tolerant); (b) same as ROW E's shortcut
    # (b) -- catching the exception but not continuing to the NEXT entry in
    # the same list, tested here via a second, writable entry after the
    # read-only one.
    SECOND_ENTRY = {
        "path": ".claude/settings.local.json",
        "key_path": "env.ANTHROPIC_DEFAULT_SONNET_MODEL",
        "bad_value": "$ANTHROPIC_DEFAULT_SONNET_MODEL",
        "action": "remove",
        "reason": "second fixture entry for ROW G continuation check",
        "issue": "delivered-value-retraction-F1-rowG",
    }
    tmp_g = Path(tempfile.mkdtemp(prefix="retraction-rowG-"))
    try:
        readonly_settings = _make_fixture(tmp_g, BAD_LITERAL)
        writable_settings = tmp_g / ".claude" / "settings.local.json"
        writable_settings.write_text(json.dumps({"env": {"ANTHROPIC_DEFAULT_SONNET_MODEL": "$ANTHROPIC_DEFAULT_SONNET_MODEL"}}, indent=2) + "\n")
        backup_dir = tmp_g / ".agent" / "memory" / "scratch" / "retraction-backup"
        readonly_settings.chmod(0o444)
        manifest = {"retractions": [RETRACTION_ENTRY, SECOND_ENTRY]}
        row_g_pass = True
        row_g_detail = ""
        try:
            update_template.apply_retractions(manifest, project_root=tmp_g, backup_dir=backup_dir, dry_run=False)
        except Exception as e:
            row_g_pass = False
            row_g_detail = f"apply_retractions RAISED on a read-only destination file: {e.__class__.__name__}: {e}"
        finally:
            readonly_settings.chmod(0o644)  # restore for cleanup regardless of outcome
        if row_g_pass:
            second_after = json.loads(writable_settings.read_text())
            fired = "ANTHROPIC_DEFAULT_SONNET_MODEL" not in second_after.get("env", {})
            row_g_pass = fired
            row_g_detail = (
                "read-only entry skipped (PermissionError caught), later writable entry still fired" if fired
                else "call did not raise, but the writable entry AFTER the read-only one never fired -- "
                     "processing stopped instead of skip-and-continue"
            )
        results["ROW G (permission-denied write target, skip-and-continue)"] = row_g_pass
        print(f"[ROW G] {row_g_detail}")
    finally:
        shutil.rmtree(tmp_g, ignore_errors=True)

    failed = [name for name, passed in results.items() if not passed]
    print()
    if failed:
        return fail(f"{len(failed)}/{len(results)} row(s) failed: {failed}")
    return ok(f"all {len(results)} rows passed: {list(results.keys())}")


if __name__ == "__main__":
    sys.exit(main())
