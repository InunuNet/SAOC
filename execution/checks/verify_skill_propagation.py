#!/usr/bin/env python3
"""F2 propagation check: every canonical skill file (.agent/skills/*.md) must be
byte-identical to the same-named file at every provider skill path
(.claude/skills/, .gemini/skills/).

This is the #104 detector: a hand-patched or missing provider copy means the harness
failed to propagate a skill update to an install. sync_skills.sh's own design
(delete-and-recopy every *.md into the provider dirs on every run) means a
fully-synced tree is always byte-identical by construction — so a mismatch here is
really evidence that sync_skills.sh did not (or has not yet) run for this install,
not a new comparison this script has to re-derive.

Shape-based, deliberately: walks every *.md file under the canonical skills dir and
never names a specific skill, so it generalizes to any future skill (Alembic's or
anyone else's) without editing this script.

F2 is the propagation check, NOT the drift check (see verify_skill_drift.py). FAIL
here means "the harness failed to reach this install" — fix by re-running
`make sync` (or `make update-template` then `make sync`) for the named project. It
never means the content itself is stale everywhere; that is F3's job, with the
opposite remediation (Alembic re-audits and republishes). Keep the two separate.

IMPORTANT — what a green result does and does NOT prove: passing means only that
this project's provider copies are in sync with ITS OWN canonical
(intra-project propagation succeeded). It does NOT mean the canonical content
itself is current against the latest Alembic release — a project whose
`.agent/skills/`, `.claude/skills/`, and `.gemini/skills/` all agree on an OLD
`alembic_version` passes this check cleanly, because F2 has no visibility outside
the project boundary. Fleet currency is F3's (verify_skill_drift.py) job, not
this check's — run both.

Exit 0: every canonical skill is byte-identical at every provider path. Prints a
one-line reminder to stdout that this proves propagation only, not fleet
currency — it does not mean silent success.
Exit non-zero, naming every offending path: at least one provider copy is missing
or diverged from canonical.
Exit non-zero, "cannot verify": canonical dir missing or empty (safe default is to
block, never silently pass).
"""
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DIR = ".agent/skills"
PROVIDER_DIRS = (".claude/skills", ".gemini/skills")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=str(REPO_ROOT),
        help="Project root to check (default: this repo's root, self-anchored via __file__)",
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()

    canonical_dir = root / CANONICAL_DIR
    if not canonical_dir.is_dir():
        print(f"cannot verify: {canonical_dir} is missing", file=sys.stderr)
        return 1

    canonical_files = sorted(p for p in canonical_dir.glob("*.md") if p.is_file())
    if not canonical_files:
        print(f"cannot verify: no *.md skill files found under {canonical_dir}", file=sys.stderr)
        return 1

    failures = []
    for canonical_file in canonical_files:
        try:
            canonical_bytes = canonical_file.read_bytes()
        except OSError as exc:
            failures.append(f"cannot read canonical {canonical_file}: {exc}")
            continue

        for provider_rel in PROVIDER_DIRS:
            provider_file = root / provider_rel / canonical_file.name
            if not provider_file.is_file():
                failures.append(
                    f"missing propagation target: {provider_file} "
                    f"(canonical: {canonical_file}) — run make sync for this project"
                )
                continue
            try:
                provider_bytes = provider_file.read_bytes()
            except OSError as exc:
                failures.append(f"cannot read {provider_file}: {exc}")
                continue
            if provider_bytes != canonical_bytes:
                failures.append(
                    f"stale install detected: {provider_file} diverges from canonical "
                    f"{canonical_file} — run make sync (or make update-template then "
                    f"make sync) for this project"
                )

    if failures:
        print("propagation check FAILED:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1

    print(
        "propagation check PASSED: canonical skills are byte-identical at every "
        "provider path (intra-project sync only — this does NOT prove the fleet "
        "has current content; run verify_skill_drift.py for currency)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
