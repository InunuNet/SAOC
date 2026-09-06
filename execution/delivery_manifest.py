#!/usr/bin/env python3
"""delivery_manifest.py — regenerate `.agent/delivery-manifest.yaml`.

The delivery manifest is the DECLARED expected set the boot panel measures the
workspace against. It exists because a denominator computed from the tree under
test moves with the numerator: delete a rule, recount, and the panel reports
`rules 7/7` forever. An expectation regenerated from the artifact inherits the
artifact's mutations (assertion-shape.md, Bucket E), which is why regeneration
is a DELIBERATE act with a reviewable diff — `make delivery-manifest ACCEPT=1` —
and never a side effect of `make sync`.

    python3 execution/delivery_manifest.py            # show the diff, exit 1 if any
    python3 execution/delivery_manifest.py --accept   # write it

The class dirs, the hook-registration rule and the manifest parser are imported
from boot_panel rather than restated here: two definitions of "what counts as a
rule" is exactly the disagreement the panel's one-collector design exists to
make impossible.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boot_panel  # noqa: E402  (path fixed up above)

HEADER = """# .agent/delivery-manifest.yaml — the DECLARED expected delivery set.
#
# Regenerated ONLY by `make delivery-manifest ACCEPT=1`, never by `make sync`.
# Read by execution/boot_panel.py as the denominator for the boot panel's
# delivery counts. Adding a rule/skill/agent/workflow/hook is a two-file change
# on purpose: the expected set is a decision, not an accident.
"""

CLASS_ORDER = list(boot_panel.CLASSES) + ["hooks"]


def observe(root):
    """The set the tree currently holds, per class. Hooks by REGISTRATION."""
    root = Path(root).resolve()
    observed = {cls: boot_panel._md_names(root / boot_panel.CLASS_DIRS[cls])
                for cls in boot_panel.CLASSES}
    observed["hooks"] = sorted(boot_panel._registered_hooks(root))
    return observed


def render(observed):
    lines = [HEADER.rstrip("\n")]
    for cls in CLASS_ORDER:
        lines.append(f"{cls}:")
        lines.extend(f"  - {name}" for name in observed.get(cls, []))
    return "\n".join(lines) + "\n"


def diff(declared, observed):
    """(class, verb, name) for every difference. Empty means aligned."""
    findings = []
    for cls in CLASS_ORDER:
        want = list((declared or {}).get(cls) or [])
        have = list(observed.get(cls) or [])
        findings.extend((cls, "declared but absent", n) for n in want if n not in have)
        findings.extend((cls, "present but undeclared", n) for n in have if n not in want)
    return findings


def main(argv=None):
    parser = argparse.ArgumentParser(
        prog="delivery_manifest.py",
        description="Regenerate the declared delivery manifest (deliberate act).")
    parser.add_argument("--root", default=".", help="Workspace root (default: cwd)")
    parser.add_argument("--accept", action="store_true",
                        help="Write the manifest. Without this, only the diff is printed.")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    path = root / boot_panel.MANIFEST_REL
    observed = observe(root)
    declared = boot_panel._parse_manifest(path)
    findings = diff(declared, observed)

    if declared is None:
        print(f"no manifest at {boot_panel.MANIFEST_REL} — the panel is falling back to a "
              "canonical (self-derived) denominator")
    for cls, verb, name in findings:
        print(f"  {cls}: {name} — {verb}")

    if not args.accept:
        if declared is not None and not findings:
            print(f"{boot_panel.MANIFEST_REL} matches the tree — nothing to regenerate")
            return 0
        print("run: make delivery-manifest ACCEPT=1   (review the diff before committing)")
        return 1

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render(observed))
    total = sum(len(v) for v in observed.values())
    print(f"wrote {boot_panel.MANIFEST_REL}: {total} declared artifact(s) across "
          f"{len(CLASS_ORDER)} classes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
