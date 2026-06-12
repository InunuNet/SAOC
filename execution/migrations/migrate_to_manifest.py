#!/usr/bin/env python3
"""
migrate_to_manifest.py — Idempotent migration to manifest-driven updates.

Detects whether this workspace has been migrated to .agent/update-manifest.yaml
and prints status. Run once after upgrading from pre-F8 harness versions.

This script is idempotent: running it multiple times produces the same output.

Usage:
  python3 execution/migrations/migrate_to_manifest.py [--dry-run] [--help]
"""
import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description=(
            "Idempotent migration check for manifest-driven updates.\n"
            "Verifies .agent/update-manifest.yaml exists and is readable.\n"
            "Safe to run multiple times — produces identical output each time."
        )
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Check migration status without writing anything (always the behaviour — included for consistency)",
    )
    args = parser.parse_args()

    manifest = Path(".agent/update-manifest.yaml")

    if manifest.exists():
        print("Already migrated: .agent/update-manifest.yaml found.")
        # Validate it's readable YAML
        try:
            import yaml
            data = yaml.safe_load(manifest.read_text())
            paths = data.get("paths", [])
            cats = {p.get("category") for p in paths}
            expected = {"HARNESS", "WORKSPACE", "DERIVED", "MERGE"}
            if cats == expected:
                print(f"Manifest is valid: {len(paths)} paths, all 4 categories present.")
            else:
                missing = expected - cats
                extra = cats - expected
                if missing:
                    print(f"  WARN: missing categories: {missing}")
                if extra:
                    print(f"  WARN: unexpected categories: {extra}")
        except ImportError:
            print("  NOTE: PyYAML not available — cannot validate manifest content.")
        except Exception as e:
            print(f"  WARN: manifest parse error: {e}")
        print("Run 'python3 execution/update_template.py --dry-run' to validate the driver.")
    else:
        print("Not yet migrated. .agent/update-manifest.yaml not found.")
        print("Copy .agent/update-manifest.yaml from the harness template.")
        print("Then run this script again to verify.")
        sys.exit(1)


if __name__ == "__main__":
    main()
