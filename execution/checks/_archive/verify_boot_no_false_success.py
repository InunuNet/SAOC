#!/usr/bin/env python3
"""
verify_boot_no_false_success.py — Regression guard + postcondition mandate
for the false-success defect class.

Two field reports now converge on this shape:
  - GH #1350 comment (2026-08-15): full_boot.sh printed "applying..." then
    "Harness updated to 3.7.109" while the applied content was still 3.7.29.
  - This mission's own reproduction (verify_provenance_protection.py.golden):
    execution/update_template.py's own --apply summary printed
    "template_version: 1.0.0 -> 9.9.9" while the one HARNESS entry that
    mattered was entirely skipped and its content never moved.

Both are the same defect: a claim ("updated to X") derived from INTENT
(a version bump was attempted / a fetch was requested) rather than from
OBSERVATION (the content that version number represents is actually now
on disk). Per the mandate: report what you observed AFTER acting, never
what you intended.

This checks TWO files for TWO separate obligations:

  1. execution/hooks/full_boot.sh (and its template/ copy) — must never
     itself call update_template.py --apply (boot only detects and
     prompts), and must never print an unconditional success claim
     ("Harness updated", "updated to", "now active") without a preceding,
     same-block, post-hoc re-read of applied state.

  2. execution/update_template.py — its own --apply summary must not
     let a bumped template_version imply full content currency when any
     HARNESS entry was skipped/protected/guarded in the same run. The
     printed summary must surface skipped/guarded entries in the SAME
     breath as any version-bump line, not bury them in an earlier,
     easy-to-miss section (see reproduced run: "protected: .agent/skills/"
     appears 8 lines before the version-bump line with nothing connecting
     them — a human reading only the last 3 lines, which is what a boot
     hook or CI log tail would show, sees pure success).

Exit 0 if clean. Exit 1 naming the file and violation. Exit 2 if no
target files are found at all (config error, not a pass).
"""
import re
import sys
from pathlib import Path

BOOT_TARGETS = [
    Path("execution/hooks/full_boot.sh"),
    Path("template/execution/hooks/full_boot.sh"),
]

FORBIDDEN_APPLY_CALL = re.compile(r"update_template\.py\s+--apply|make\s+update-template\b(?!.*review)")
SUCCESS_CLAIM = re.compile(r"[Hh]arness updated|updated to \$|now active")


def check_boot_file(path: Path) -> list[str]:
    if not path.exists():
        return [f"{path}: MISSING (nothing to verify)"]
    text = path.read_text()
    violations = []
    lines = text.splitlines()

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        # Advisory text ("echo ... Run: python3 execution/update_template.py
        # --apply") is fine and expected -- boot SHOULD tell the user how to
        # apply it themselves. Only a real shell invocation is forbidden:
        # the line must not be an echo/printf of instructional text.
        is_echoed_text = stripped.startswith("echo ") or stripped.startswith("printf ")
        if FORBIDDEN_APPLY_CALL.search(line) and not is_echoed_text:
            violations.append(f"{path}:{i}: boot must never invoke apply directly: {line.strip()!r}")

    for i, line in enumerate(lines, 1):
        if SUCCESS_CLAIM.search(line):
            window = "\n".join(lines[max(0, i - 15):i])
            if "template_state" not in window and "profile.json" not in window:
                violations.append(
                    f"{path}:{i}: success claim with no preceding post-hoc state re-check: {line.strip()!r}"
                )
    return violations


def check_update_template_summary() -> list[str]:
    """update_template.py's final Summary block must reference skipped/guarded
    entries in the same block as any version-bump report, not just earlier,
    easier-to-miss WARN lines during the manifest walk."""
    path = Path("execution/update_template.py")
    if not path.exists():
        return [f"{path}: MISSING"]
    text = path.read_text()
    violations = []
    if "paths_skipped" not in text or "Summary:" not in text:
        violations.append(f"{path}: Summary block missing paths_skipped/paths_guarded reporting")
    # The version-bump report and the skip-count must appear in the same
    # printed block (main()'s tail), not require the reader to correlate
    # two separate sections of scrollback.
    if "update_profile_version" in text and "paths_skipped" in text:
        # heuristic: the summary print block must reference both within a
        # small window of source lines (same function, same print sequence)
        idx_summary = text.find('print("Summary:")')
        idx_version_call = text.find("update_profile_version(")
        if idx_summary == -1 or idx_version_call == -1 or idx_summary < idx_version_call:
            violations.append(
                f"{path}: version-bump report must be re-emitted or cross-referenced "
                "in the Summary block, not printed only earlier and separately"
            )
    return violations


def main() -> int:
    all_violations = []
    missing = 0
    for target in BOOT_TARGETS:
        result = check_boot_file(target)
        if result and result[0].endswith("MISSING (nothing to verify)"):
            missing += 1
            print(result[0])
            continue
        all_violations.extend(result)

    all_violations.extend(check_update_template_summary())

    if missing == len(BOOT_TARGETS):
        print("ERROR: no boot target files found", file=sys.stderr)
        return 2

    if all_violations:
        print(f"FAIL — {len(all_violations)} false-success violation(s):")
        for v in all_violations:
            print(f"  {v}")
        return 1

    print("OK — no auto-apply, no unverified success claims, summary surfaces skips alongside version bumps.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
