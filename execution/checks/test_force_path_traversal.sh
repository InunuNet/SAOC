#!/usr/bin/env bash
# Path-traversal / collision defense test for F6's --force-path (issue #1348
# remediation, execution/update_template.py). Manifest keys are matched
# exactly (set membership), never string-prefix matching, but the mandate
# from @lead is to prove real path CONTAINMENT independently — a crafted
# manifest entry (malicious edit, bad merge, typo) whose destination
# resolves outside the project tree, or through a symlink to outside the
# project tree, must be rejected BEFORE any write, exit 2, with a canary
# file OUTSIDE the fixture's project root left byte-for-byte and
# mtime-for-mtime untouched.
#
# Every fixture here is built ENTIRELY under a throwaway tmp dir. This test
# NEVER runs against the real repo (contrast with test_audit_wiring.sh's
# real_lines_green case, which deliberately does touch the real repo
# read-only — this script never does even that).
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SELF_DIR/../.." && pwd)"
UPDATE_TEMPLATE="$REPO_ROOT/execution/update_template.py"

canary_fingerprint() {
    # content hash + mtime, so both a byte change and a touched-but-same-content
    # write would be caught.
    local f="$1"
    shasum -a 256 "$f" | awk '{print $1}'
    stat -f '%m' "$f" 2>/dev/null || stat -c '%Y' "$f"
}

case "${1:-all}" in
  relative_escape_rejected)
    # A HARNESS manifest entry whose own "path" is a `..`-escaping value —
    # simulating a malicious/corrupt manifest edit, the case the resolved-path
    # containment check exists to catch independently of key-string matching.
    fixture_root="$(mktemp -d /tmp/f6-trav-rel.XXXXXX)"
    out_file="$(mktemp /tmp/f6-trav-rel-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT

    mkdir -p "$fixture_root/proj/.agent/memory/scratch" "$fixture_root/proj/_source"
    printf 'TestFixtureProject\n' > "$fixture_root/proj/WORKSPACE"
    printf '{}\n' > "$fixture_root/proj/.agent/profile.json"
    cat > "$fixture_root/proj/.agent/update-manifest.yaml" <<'EOF'
paths:
  - category: HARNESS
    path: ../canary.txt
EOF
    # Canary lives OUTSIDE the project root (a sibling of proj/), which is
    # exactly what the malicious "../canary.txt" HARNESS entry targets.
    printf 'canary content — must survive untouched\n' > "$fixture_root/canary.txt"
    before="$(canary_fingerprint "$fixture_root/canary.txt")"

    if ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --apply --source _source --force-path ../canary.txt ) > "$out_file" 2>&1; then
      echo "FAIL: a --force-path resolving outside the project tree (../canary.txt) should have been rejected (exit non-zero)" >&2
      cat "$out_file" >&2
      exit 1
    fi
    after="$(canary_fingerprint "$fixture_root/canary.txt")"
    if [ "$before" != "$after" ]; then
      echo "FAIL: the outside-the-project canary was modified — path-traversal containment failed to hold" >&2
      exit 1
    fi
    if ! grep -qi "outside the project" "$out_file"; then
      echo "FAIL: rejection message did not name the traversal/containment reason" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: a --force-path value resolving outside the project tree via '..' is rejected before any write; canary untouched"
    ;;
  symlink_escape_rejected)
    # .agent/skills/ inside the project is a SYMLINK pointing at a directory
    # OUTSIDE the project. The manifest key is computed from the legitimate
    # source-side rglob (so it passes the manifest-membership check), but the
    # real destination — after following the symlink — resolves outside the
    # project tree. Containment must catch this via resolved-path
    # containment, not string-prefix matching on the unresolved key.
    fixture_root="$(mktemp -d /tmp/f6-trav-symlink.XXXXXX)"
    out_file="$(mktemp /tmp/f6-trav-symlink-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT

    mkdir -p "$fixture_root/proj/.agent/memory/scratch" "$fixture_root/proj/_source/.agent/skills"
    mkdir -p "$fixture_root/outside_target"
    printf 'TestFixtureProject\n' > "$fixture_root/proj/WORKSPACE"
    printf '{}\n' > "$fixture_root/proj/.agent/profile.json"
    cat > "$fixture_root/proj/.agent/update-manifest.yaml" <<'EOF'
paths:
  - category: HARNESS
    path: .agent/skills/
EOF
    printf -- 'canonical replacement content\n' > "$fixture_root/proj/_source/.agent/skills/victim.md"

    # The canary the symlink points at, OUTSIDE the project root.
    printf 'canary content — must survive untouched\n' > "$fixture_root/outside_target/victim.md"
    ln -s "$fixture_root/outside_target" "$fixture_root/proj/.agent/skills"
    before="$(canary_fingerprint "$fixture_root/outside_target/victim.md")"

    if ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --apply --source _source --force-path .agent/skills/victim.md ) > "$out_file" 2>&1; then
      echo "FAIL: a --force-path whose destination is a symlink resolving outside the project should have been rejected" >&2
      cat "$out_file" >&2
      exit 1
    fi
    after="$(canary_fingerprint "$fixture_root/outside_target/victim.md")"
    if [ "$before" != "$after" ]; then
      echo "FAIL: the symlink-target canary outside the project was modified — containment failed to follow the symlink" >&2
      exit 1
    fi
    if ! grep -qi "outside the project" "$out_file"; then
      echo "FAIL: rejection message did not name the traversal/containment reason" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: a --force-path destination reached only via a symlink resolving outside the project is rejected before any write; canary untouched"
    ;;
  collision_rejected)
    # White-box: the manifest key scheme is collision-resistant by
    # construction for any real manifest (key format is a deterministic
    # function of source root + relative path, so two legitimate entries
    # cannot produce the same key with different destinations). To prove
    # the ambiguity-refusal branch in _validate_force_paths actually fires
    # rather than merely existing as dead code, monkeypatch
    # _collect_valid_harness_keys to return a synthetic collision and assert
    # the process exits 2 without reaching any write.
    out_file="$(mktemp /tmp/f6-collision-out.XXXXXX)"
    trap 'rm -f "$out_file"' EXIT
    if python3 - "$UPDATE_TEMPLATE" > "$out_file" 2>&1 <<'PYEOF'
import importlib.util
import sys
from pathlib import Path

mod_path = sys.argv[1]
spec = importlib.util.spec_from_file_location("update_template", mod_path)
ut = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ut)

# Synthetic collision: same key, two different destinations.
ut._collect_valid_harness_keys = lambda manifest, source: {
    "a/b.md": [Path("a/b.md"), Path("a/other.md")]
}

try:
    ut._validate_force_paths(
        frozenset({"a/b.md"}), manifest={"paths": []}, source=Path("."),
        project_root=Path(".").resolve(),
    )
    print("NO EXIT — collision was not rejected")
    sys.exit(1)
except SystemExit as e:
    if e.code == 2:
        print("collision correctly rejected with exit 2")
        sys.exit(0)
    print(f"unexpected exit code: {e.code}")
    sys.exit(1)
PYEOF
    then
      : # exit 0 from the heredoc means PASS path below
    else
      echo "FAIL: ambiguous --force-path key (collision across manifest entries) was not rejected with exit 2" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -qi "ambiguous" "$out_file"; then
      echo "FAIL: collision rejection message did not name the ambiguity reason" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: an ambiguous --force-path key (collision across manifest entries) is rejected with exit 2 rather than guessed"
    ;;
  all)
    "$SELF_DIR/test_force_path_traversal.sh" relative_escape_rejected
    "$SELF_DIR/test_force_path_traversal.sh" symlink_escape_rejected
    "$SELF_DIR/test_force_path_traversal.sh" collision_rejected
    ;;
  *)
    echo "usage: $0 {relative_escape_rejected|symlink_escape_rejected|collision_rejected|all}" >&2
    exit 2
    ;;
esac
