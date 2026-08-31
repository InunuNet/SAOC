#!/usr/bin/env bash
# Fixture-based discrimination test for F6 (--force-path remediation on
# execution/update_template.py, issue #1348). Builds a throwaway "downstream
# project" install under /tmp — its own .agent/update-manifest.yaml,
# .agent/skills/, a fake "source" tree to update from, and a pre-seeded
# baseline-hash store — and exercises update_template.py against it exactly
# as a real project would invoke it (cwd = the fixture root, since
# update_template.py is intentionally CWD-relative: it runs INSIDE each
# downstream project, not anchored to Athanor's own repo). Never touches
# the real repo.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SELF_DIR/../.." && pwd)"
# Override for negative verification only (a scratch copy of
# update_template.py with a deliberately broken guard) — never set in the
# production assertion, which always tests the real repo file.
UPDATE_TEMPLATE="${UPDATE_TEMPLATE_UNDER_TEST:-$REPO_ROOT/execution/update_template.py}"

# Builds a fixture project at $1 with:
#   - a "source" tree at $1/_source (what --source points at) containing the
#     CANONICAL alembic.md
#   - an installed .agent/skills/alembic.md that has been HAND-PATCHED (the
#     exact state #104's guard exists to protect)
#   - a baseline-hash store recording the hash of the file BEFORE the hand
#     patch, so the guard actually fires (a real "local modification since
#     last sync", not merely "differs from source")
build_guarded_fixture() {
    local dir="$1"
    rm -rf "$dir"
    mkdir -p "$dir/.agent/skills" "$dir/_source/.agent/skills" "$dir/.agent/memory/scratch"
    printf 'TestFixtureProject\n' > "$dir/WORKSPACE"
    printf '{}\n' > "$dir/.agent/profile.json"
    cat > "$dir/.agent/update-manifest.yaml" <<'EOF'
paths:
  - category: HARNESS
    path: .agent/skills/
EOF
    printf -- '---\nalembic_version: 1.68.0\n---\n# Alembic\ncanonical content, post-merge\n' > "$dir/_source/.agent/skills/alembic.md"
    printf -- '---\nalembic_version: 1.0.0\n---\n# Alembic\noriginal content at last sync\n' > "$dir/.agent/skills/alembic.md"

    local baseline_hash
    baseline_hash="$(python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$dir/.agent/skills/alembic.md")"
    python3 -c "
import json, sys
json.dump({'.agent/skills/alembic.md': sys.argv[1]}, open(sys.argv[2], 'w'))
" "$baseline_hash" "$dir/.agent/memory/scratch/template_baselines.json"

    # NOW hand-patch it — this is the local modification since the recorded
    # baseline, i.e. exactly the state #104's guard is designed to protect.
    printf -- '---\nalembic_version: 1.0.0\n---\n# Alembic\nHAND-PATCHED locally after last sync\n' > "$dir/.agent/skills/alembic.md"
}

case "${1:-all}" in
  default_unaffected)
    fixture_root="$(mktemp -d /tmp/f6-default.XXXXXX)"
    out_file="$(mktemp /tmp/f6-default-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    build_guarded_fixture "$fixture_root/proj"
    before_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    # --allow-skips: this fixture deliberately leaves a guarded hand-patched
    # file undelivered, which is a non-zero exit under delivery-integrity F1.
    # The flag acknowledges that and restores exit 0 without changing what is
    # delivered or silencing the WARN this case asserts on.
    ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --apply --allow-skips --source "$fixture_root/proj/_source" ) > "$out_file" 2>&1
    after_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    if [ "$before_hash" != "$after_hash" ]; then
      echo "FAIL: a plain --apply run (no --force-path) modified a guarded, hand-patched file — regression" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "WARN.*local modifications" "$out_file"; then
      echo "FAIL: default run did not WARN about the guarded file it left untouched" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "HAND-PATCHED" "$fixture_root/proj/.agent/skills/alembic.md"; then
      echo "FAIL: hand-patched content was not preserved verbatim" >&2
      exit 1
    fi
    echo "PASS: default --apply (no --force-path) leaves the guarded hand-patched file byte-for-byte untouched and WARNs — regression-safe"
    ;;
  force_dry_run_noop)
    fixture_root="$(mktemp -d /tmp/f6-dryrun.XXXXXX)"
    out_file="$(mktemp /tmp/f6-dryrun-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    build_guarded_fixture "$fixture_root/proj"
    before_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    # No --apply: --force-path alone must be a preview only, never a write.
    ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --source "$fixture_root/proj/_source" --force-path .agent/skills/alembic.md ) > "$out_file" 2>&1
    after_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    if [ "$before_hash" != "$after_hash" ]; then
      echo "FAIL: --force-path without --apply wrote to disk — this is the single most dangerous possible regression for this feature" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: --force-path without --apply previews only; the guarded file is untouched (opt-in requires --apply)"
    ;;
  force_overwrites)
    fixture_root="$(mktemp -d /tmp/f6-force.XXXXXX)"
    out_file="$(mktemp /tmp/f6-force-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    build_guarded_fixture "$fixture_root/proj"

    ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --apply --source "$fixture_root/proj/_source" --force-path .agent/skills/alembic.md ) > "$out_file" 2>&1
    result_content="$(cat "$fixture_root/proj/.agent/skills/alembic.md")"
    canonical_content="$(cat "$fixture_root/proj/_source/.agent/skills/alembic.md")"

    if [ "$result_content" != "$canonical_content" ]; then
      echo "FAIL: --force-path --apply did not overwrite the guarded file with canonical content" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "FORCE" "$out_file" || ! grep -q ".agent/skills/alembic.md" "$out_file"; then
      echo "FAIL: no FORCE message naming the overwritten path was printed" >&2
      cat "$out_file" >&2
      exit 1
    fi
    # The FORCE announcement must appear BEFORE the file is left in its new
    # (canonical) state is not directly observable from output alone, but
    # the message must explicitly state what was about to happen (local
    # modifications being cleared), not just "copied".
    if ! grep -qi "local modification" "$out_file"; then
      echo "FAIL: FORCE message did not state that local modifications are being cleared" >&2
      cat "$out_file" >&2
      exit 1
    fi
    # A backup of the pre-overwrite (hand-patched) content must exist.
    backup_match="$(grep -rl "HAND-PATCHED" "$fixture_root/proj/.agent/memory/scratch/"update-backup-*/.agent/skills/alembic.md 2>/dev/null || true)"
    if [ -z "$backup_match" ]; then
      echo "FAIL: no backup of the pre-overwrite hand-patched content was found under .agent/memory/scratch/update-backup-*/" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: --force-path --apply overwrites the named guarded file with canonical content, announces it explicitly before/while doing so, and backs up the destroyed content"
    ;;
  force_rejects_unknown_path)
    fixture_root="$(mktemp -d /tmp/f6-unknown.XXXXXX)"
    out_file="$(mktemp /tmp/f6-unknown-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    build_guarded_fixture "$fixture_root/proj"
    before_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    if ( cd "$fixture_root/proj" && python3 "$UPDATE_TEMPLATE" --apply --source "$fixture_root/proj/_source" --force-path some/random/path/not/in/manifest.md ) > "$out_file" 2>&1; then
      echo "FAIL: --force-path for a path outside any HARNESS manifest entry should have been rejected (exit non-zero)" >&2
      cat "$out_file" >&2
      exit 1
    fi
    after_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"
    if [ "$before_hash" != "$after_hash" ]; then
      echo "FAIL: a rejected --force-path run still modified an unrelated guarded file — collateral damage" >&2
      exit 1
    fi
    echo "PASS: --force-path for a path outside the HARNESS manifest is rejected before any write, with no collateral changes"
    ;;
  force_env_var_ignored)
    # A6 repair: --force-path must never be auto-populated from an
    # environment variable, so an accidental env-var inheritance in a
    # cron/CI context can't silently trigger the force path the way
    # FORCE_UPDATE=true's blanket force can. Exports the two most
    # plausible misuse-prone env var names, runs --apply with NO
    # --force-path flag on the command line, and asserts the guarded file
    # is exactly as untouched as default_unaffected proves.
    fixture_root="$(mktemp -d /tmp/f6-envignored.XXXXXX)"
    out_file="$(mktemp /tmp/f6-envignored-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    build_guarded_fixture "$fixture_root/proj"
    before_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    ( cd "$fixture_root/proj" && FORCE_PATH=".agent/skills/alembic.md" HARNESS_FORCE_PATH=".agent/skills/alembic.md" python3 "$UPDATE_TEMPLATE" --apply --allow-skips --source "$fixture_root/proj/_source" ) > "$out_file" 2>&1
    after_hash="$(shasum -a 256 "$fixture_root/proj/.agent/skills/alembic.md" | awk '{print $1}')"

    if [ "$before_hash" != "$after_hash" ]; then
      echo "FAIL: FORCE_PATH/HARNESS_FORCE_PATH env vars silently activated the force path — the guarded, hand-patched file was overwritten with no --force-path CLI flag" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "WARN.*local modifications" "$out_file"; then
      echo "FAIL: run with FORCE_PATH/HARNESS_FORCE_PATH set did not WARN about the guarded file it left untouched" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "HAND-PATCHED" "$fixture_root/proj/.agent/skills/alembic.md"; then
      echo "FAIL: hand-patched content was not preserved verbatim" >&2
      exit 1
    fi
    echo "PASS: FORCE_PATH/HARNESS_FORCE_PATH env vars are ignored — --force-path is never auto-populated from the environment"
    ;;
  force_update_guard_unaffected)
    # A7 repair: the pre-existing, unrelated FORCE_UPDATE=true blanket
    # self-update guard (is_template_repo / WORKSPACE=="Athanor") must
    # still fire exactly as before, untouched by F6's --force-path
    # changes. Uses a separate minimal fixture (not build_guarded_fixture
    # — this scenario doesn't need the HARNESS-guard setup).
    fixture_root="$(mktemp -d /tmp/f6-forceupdateguard.XXXXXX)"
    out_file="$(mktemp /tmp/f6-forceupdateguard-out.XXXXXX)"
    trap 'rm -rf "$fixture_root" "$out_file"' EXIT
    mkdir -p "$fixture_root/proj/.agent" "$fixture_root/proj/_source"
    printf 'Athanor\n' > "$fixture_root/proj/WORKSPACE"
    printf '{}\n' > "$fixture_root/proj/.agent/profile.json"
    printf 'paths: []\n' > "$fixture_root/proj/.agent/update-manifest.yaml"
    # --source is passed explicitly (an empty local scratch dir) on BOTH
    # invocations below so update_template.py never takes its no-source
    # default path (a real `gh`/network fetch of upstream main, which
    # happens BEFORE the self-update guard runs) — the guard's own
    # behavior is independent of source content, so this only removes an
    # unwanted network call, it doesn't change what's under test.

    if ( cd "$fixture_root/proj" && env -u FORCE_UPDATE python3 "$UPDATE_TEMPLATE" --apply --source "$fixture_root/proj/_source" ) > "$out_file" 2>&1; then
      echo "FAIL: expected the self-update guard to refuse (nonzero exit) with FORCE_UPDATE unset" >&2
      cat "$out_file" >&2
      exit 1
    fi
    if ! grep -q "Running inside the Athanor template repo" "$out_file"; then
      echo "FAIL: self-update guard did not print its real refusal message with FORCE_UPDATE unset" >&2
      cat "$out_file" >&2
      exit 1
    fi

    ( cd "$fixture_root/proj" && FORCE_UPDATE=1 python3 "$UPDATE_TEMPLATE" --apply --source "$fixture_root/proj/_source" ) > "$out_file" 2>&1 || true
    if grep -q "Running inside the Athanor template repo" "$out_file"; then
      echo "FAIL: self-update guard still fired with FORCE_UPDATE=1 set — the blanket-bypass escape hatch is broken" >&2
      cat "$out_file" >&2
      exit 1
    fi
    echo "PASS: FORCE_UPDATE guard fires without FORCE_UPDATE and doesn't fire with it set — unaffected by F6"
    ;;
  all)
    "$SELF_DIR/test_force_path_remediation.sh" default_unaffected
    "$SELF_DIR/test_force_path_remediation.sh" force_dry_run_noop
    "$SELF_DIR/test_force_path_remediation.sh" force_overwrites
    "$SELF_DIR/test_force_path_remediation.sh" force_rejects_unknown_path
    "$SELF_DIR/test_force_path_remediation.sh" force_env_var_ignored
    "$SELF_DIR/test_force_path_remediation.sh" force_update_guard_unaffected
    ;;
  *)
    echo "usage: $0 {default_unaffected|force_dry_run_noop|force_overwrites|force_rejects_unknown_path|force_env_var_ignored|force_update_guard_unaffected|all}" >&2
    exit 2
    ;;
esac
