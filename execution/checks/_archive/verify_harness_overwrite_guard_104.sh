#!/usr/bin/env bash
# verify_harness_overwrite_guard_104.sh -- golden-file behavioral check for GitHub issue #104.
#
# Bug: execution/update_template.py's HARNESS copy path (copy_harness(), invoked from the
# manifest loop in main()) unconditionally backs up and overwrites a HARNESS-categorized
# file with the fetched template version -- even when the LOCAL file has uncommitted,
# in-flight modifications that diverge from the last-synced-from-template baseline. There
# is no hash-based "has this file been locally modified since the last sync?" check, no
# WARN, and no SKIP. The only recovery path is digging through the timestamped
# .agent/memory/scratch/update-backup-<ts>/ directory after the fact.
#
# Fix contract (locked storage convention -- the dev implementation MUST match this exact
# path/schema or these goldens will not pass):
#   Baseline store: .agent/memory/scratch/template_baselines.json
#   Schema: a flat JSON object mapping the manifest "path" string (relative, POSIX, exactly
#   as written in .agent/update-manifest.yaml) -> sha256 hex digest of the content that was
#   written to that path the last time it was synced FROM the template/upstream source.
#
# Required behavior per HARNESS file, evaluated BEFORE any overwrite:
#   - No baseline entry for this path (missing key, missing file, missing directory, or the
#     baseline file is corrupt/unreadable) AND local content matches incoming => nothing to
#     protect; proceed with the update normally and record a new baseline entry after the copy.
#     If local content DIFFERS from incoming with no recorded baseline, this is treated as
#     diverged (GH-1343-informed policy, superseding this script's original wording): WARN,
#     SKIP the overwrite, leave local content byte-for-byte untouched, do not write a baseline.
#   - Baseline entry present and sha256(current local file) == baseline hash => file is
#     untouched since last sync. Proceed with the update normally and refresh the baseline
#     entry to hash of the freshly-written content.
#   - Baseline entry present and sha256(current local file) != baseline hash => local file
#     has in-flight modifications since the last sync. Print a WARN naming the file and SKIP
#     overwriting it. Leave the local file's content untouched. Do NOT touch/advance the
#     stored baseline hash for this path (a silently-advanced baseline would erase the
#     divergence signal on the next run).
#
# This guard applies ONLY to category: HARNESS paths. WORKSPACE and DERIVED paths must
# continue to behave exactly as they do today (skip, unrelated to this mechanism) --
# whether or not a (possibly stale/poisoned) baseline entry happens to exist for their path.
#
# This script drives the REAL execution/update_template.py against isolated fixture
# directories (a fake "source" tree standing in for the fetched upstream tarball, and a
# fake "workspace" tree standing in for a downstream project) so no real repo state is
# touched.
#
# Usage: verify_harness_overwrite_guard_104.sh <case>
#   no_baseline               - HARNESS file has no stored baseline at all (and the entire
#                                .agent/memory/ tree is absent -- first-ever run) and its
#                                content differs from the template. Per GH-1343, must WARN,
#                                SKIP the overwrite, and leave local content byte-for-byte
#                                untouched. No crash despite the missing baseline directory.
#   match_baseline            - HARNESS file's stored baseline matches its current content
#                                (untouched since last sync); template changed upstream.
#                                Must update normally to the new template content and
#                                refresh the baseline to match.
#   mismatch_baseline         - HARNESS file's stored baseline does NOT match its current
#                                content (locally modified in-flight); template also changed
#                                upstream. Must WARN, SKIP the overwrite, leave local content
#                                byte-for-byte untouched, and NOT silently advance the stored
#                                baseline hash.
#   workspace_derived_untouched - WORKSPACE and DERIVED files (even with poisoned/mismatched
#                                baseline entries seeded for their paths) must be completely
#                                unaffected by the new guard: unchanged content, no WARN, and
#                                the pre-existing skip messages still print.
#   corrupt_baseline          - The baseline JSON file exists but is malformed. Must degrade
#                                gracefully (treat as no-baseline, no crash) rather than
#                                raising or permanently blocking; since local content differs
#                                from incoming, this collapses to the same GH-1343 SKIP-and-
#                                WARN outcome as no_baseline, not auto-overwrite.
#   dir_entry_mismatch        - Real-world reproduction: a locally-modified HARNESS file
#                                living INSIDE a directory-category manifest entry (mirrors
#                                the real `category: HARNESS, path: execution/` entry
#                                containing execution/pulse_mission_loop.sh). The guard must
#                                apply inside copy_harness()'s directory/rglob copy branch,
#                                not just its single-file branch: the modified leaf file must
#                                WARN and be preserved; an untouched sibling file in the same
#                                directory entry must still update normally.
#   dir_and_file_entry_order  - Ordering trap: manifest lists a directory-category HARNESS
#                                entry BEFORE a file-level HARNESS entry for a path nested
#                                inside that directory (mirrors execution/ before
#                                execution/bump_version.sh in the real manifest). The nested
#                                file has in-flight local modifications. The guard must fire
#                                regardless of entry order -- proving the check lives at the
#                                point of write inside copy_harness(), not in the manifest-
#                                loop dispatch, so an earlier-processed directory entry can't
#                                silently clobber the file before its own guard would run.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="$REPO_ROOT/execution/update_template.py"
CASE="${1:-}"

WS="$(mktemp -d)"
SRC="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" "$SRC" 2>/dev/null || true; }
trap cleanup EXIT

BASELINE_FILE="$WS/.agent/memory/scratch/template_baselines.json"

TEMPLATE_V1="TEMPLATE-CONTENT-V1-BASELINE"
TEMPLATE_V2="TEMPLATE-CONTENT-V2-UPSTREAM-CHANGE"
LOCAL_PATCH_MARKER="LOCAL-IN-FLIGHT-PATCH-DO-NOT-LOSE"

sha256_of() {
  python3 -c "import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" "$1"
}

baseline_value() {
  # $1 = key. Never raises: prints '' if the file/dir/key is missing or the JSON is corrupt.
  python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    print(d.get(sys.argv[2], ''))
except Exception:
    print('')
" "$BASELINE_FILE" "$1" 2>/dev/null
}

setup_common() {
  mkdir -p "$WS/.agent"
  cat > "$WS/.agent/update-manifest.yaml" <<'YAML'
schema: athanor.manifest/v1
paths:
  - category: HARNESS
    path: harness_file.txt
  - category: WORKSPACE
    path: workspace_file.txt
  - category: DERIVED
    path: derived_file.txt
YAML
  printf 'GoldenFixtureProject-104\n' > "$WS/WORKSPACE"
  cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-104", "template_version": "1.0.0", "autonomy": {"level": "high"}}
JSON
  mkdir -p "$SRC/.agent"
}

seed_baseline() {
  # $1 = key, $2 = value
  mkdir -p "$WS/.agent/memory/scratch"
  python3 -c "
import json, sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
python_data = {}
try:
    python_data = json.load(open(path))
except Exception:
    pass
python_data[key] = val
json.dump(python_data, open(path, 'w'))
" "$BASELINE_FILE" "$1" "$2"
}

setup_common

case "$CASE" in
  no_baseline)
    # Deliberately: no .agent/memory tree at all (first-ever run, nothing recorded yet).
    printf 'PRE-EXISTING-LOCAL-V0' > "$WS/harness_file.txt"
    printf '%s' "$TEMPLATE_V1" > "$SRC/harness_file.txt"
    ;;
  match_baseline)
    printf '%s' "$TEMPLATE_V1" > "$WS/harness_file.txt"
    seed_baseline "harness_file.txt" "$(sha256_of "$WS/harness_file.txt")"
    printf '%s' "$TEMPLATE_V2" > "$SRC/harness_file.txt"
    ;;
  mismatch_baseline)
    printf '%s' "$TEMPLATE_V1" > "$WS/harness_file.txt"
    seed_baseline "harness_file.txt" "$(sha256_of "$WS/harness_file.txt")"
    printf '%s\n%s' "$TEMPLATE_V1" "$LOCAL_PATCH_MARKER" > "$WS/harness_file.txt"
    printf '%s' "$TEMPLATE_V2" > "$SRC/harness_file.txt"
    ;;
  workspace_derived_untouched)
    printf 'WORKSPACE-LOCAL-CONTENT' > "$WS/workspace_file.txt"
    printf 'DERIVED-LOCAL-CONTENT' > "$WS/derived_file.txt"
    # Poison baseline entries for non-HARNESS paths with mismatched hashes -- a buggy
    # implementation that applies the guard regardless of category would misbehave here.
    seed_baseline "workspace_file.txt" "0000000000000000000000000000000000000000000000000000000000000000"
    seed_baseline "derived_file.txt" "0000000000000000000000000000000000000000000000000000000000000000"
    printf 'harmless' > "$WS/harness_file.txt"
    printf 'harmless' > "$SRC/harness_file.txt"
    printf 'SRC-WORKSPACE-SHOULD-NEVER-BE-USED' > "$SRC/workspace_file.txt"
    printf 'SRC-DERIVED-SHOULD-NEVER-BE-USED' > "$SRC/derived_file.txt"
    ;;
  corrupt_baseline)
    # Corrupt baseline collapses to no-record; local differs from incoming,
    # so the run must WARN and SKIP (GH-1343-informed), not auto-overwrite.
    mkdir -p "$WS/.agent/memory/scratch"
    printf '{not-valid-json' > "$BASELINE_FILE"
    printf '%s' "$TEMPLATE_V1" > "$WS/harness_file.txt"
    printf '%s' "$TEMPLATE_V2" > "$SRC/harness_file.txt"
    ;;
  dir_entry_mismatch)
    # Real-world shape: category: HARNESS, path: dirfiles/ is a DIRECTORY entry
    # (like the real execution/ entry) containing two files -- one locally
    # modified (like execution/pulse_mission_loop.sh), one untouched.
    cat >> "$WS/.agent/update-manifest.yaml" <<'YAML'
  - category: HARNESS
    path: dirfiles/
YAML
    mkdir -p "$WS/dirfiles" "$SRC/dirfiles"
    # Locally-modified leaf file inside the directory entry.
    printf '%s' "$TEMPLATE_V1" > "$WS/dirfiles/pulse_mission_loop.sh"
    seed_baseline "dirfiles/pulse_mission_loop.sh" "$(sha256_of "$WS/dirfiles/pulse_mission_loop.sh")"
    printf '%s\n%s' "$TEMPLATE_V1" "$LOCAL_PATCH_MARKER" > "$WS/dirfiles/pulse_mission_loop.sh"
    printf '%s' "$TEMPLATE_V2" > "$SRC/dirfiles/pulse_mission_loop.sh"
    # Untouched sibling file in the SAME directory entry -- must still update.
    printf '%s' "$TEMPLATE_V1" > "$WS/dirfiles/other_file.txt"
    seed_baseline "dirfiles/other_file.txt" "$(sha256_of "$WS/dirfiles/other_file.txt")"
    printf '%s' "$TEMPLATE_V2" > "$SRC/dirfiles/other_file.txt"
    ;;
  dir_and_file_entry_order)
    # Real-world shape: a directory entry (execution/) is listed BEFORE a
    # file-level entry (execution/bump_version.sh) for a path nested inside
    # it. The nested file has in-flight local modifications. The guard must
    # fire no matter which entry the manifest loop visits first.
    cat >> "$WS/.agent/update-manifest.yaml" <<'YAML'
  - category: HARNESS
    path: orderdir/
  - category: HARNESS
    path: orderdir/target_file.txt
YAML
    mkdir -p "$WS/orderdir" "$SRC/orderdir"
    printf '%s' "$TEMPLATE_V1" > "$WS/orderdir/target_file.txt"
    seed_baseline "orderdir/target_file.txt" "$(sha256_of "$WS/orderdir/target_file.txt")"
    printf '%s\n%s' "$TEMPLATE_V1" "$LOCAL_PATCH_MARKER" > "$WS/orderdir/target_file.txt"
    printf '%s' "$TEMPLATE_V2" > "$SRC/orderdir/target_file.txt"
    ;;
  *)
    echo "FAIL: unknown case '$CASE' (expected no_baseline|match_baseline|mismatch_baseline|workspace_derived_untouched|corrupt_baseline|dir_entry_mismatch|dir_and_file_entry_order)" >&2
    exit 1
    ;;
esac

OUT="$(cd "$WS" && python3 "$TARGET" --source "$SRC" --apply 2>&1)"
RC=$?

# delivery-integrity F1 changed how a withheld delivery is SIGNALLED, not
# whether it happens: --apply now exits 1 when the run carried content it did
# not deliver, and prints a terminal "WITHHELD" block naming every undelivered
# path plus the two remedies that clear it. Five of this script's seven cases
# exist precisely to make the guard withhold something, so the original blanket
# `exit != 0 => FAIL` reads that feature as a crash and reports the guard broken
# at the exact moment it is working.
#
# The fix is here, in the verifier, NOT in the exit contract: this script's
# assertion -- the overwrite guard protects local edits -- is still correct, and
# only the mechanism that signals it changed. Distinguishing the two matters,
# because "exited non-zero" must keep catching a real crash. Exit 1 is tolerated
# ONLY when the run also printed the WITHHELD report; every other non-zero exit
# is still a hard failure, and the per-case assertions below (local content
# preserved byte-for-byte, WARN naming the file, baseline not advanced) remain
# the actual evidence. require_withheld() additionally pins the path into the
# WITHHELD block, so a run that exits 1 for some unrelated reason cannot pass.
if [ "$RC" -eq 1 ] && echo "$OUT" | grep -q "^WITHHELD"; then
  : # intentional loud partial delivery -- per-case assertions below decide
elif [ "$RC" -ne 0 ]; then
  echo "FAIL: update_template.py exited $RC for case '$CASE' with no WITHHELD report -- a crash or an unrelated refusal, not the intentional partial-delivery exit" >&2
  echo "$OUT" >&2
  exit 1
fi

require_withheld() {
  # $1 = path that this case expects to be named as undelivered.
  if [ "$RC" -ne 1 ]; then
    echo "FAIL: case '$CASE' withheld $1 but the run exited $RC -- a partial delivery must exit non-zero so automated callers cannot read it as success (delivery-integrity F1)" >&2
    echo "$OUT" >&2
    exit 1
  fi
  if ! echo "$OUT" | sed -n '/^WITHHELD/,$p' | grep -qF -- "- $1"; then
    echo "FAIL: case '$CASE' did not name $1 in the WITHHELD report, so the operator is never told which path was not delivered" >&2
    echo "$OUT" >&2
    exit 1
  fi
  if ! echo "$OUT" | grep -q -- "--force-path"; then
    echo "FAIL: case '$CASE' printed a WITHHELD report with no remedy naming --force-path" >&2
    echo "$OUT" >&2
    exit 1
  fi
}

require_exit_zero() {
  # Cases that withhold NOTHING must still exit 0 -- the tolerance added above
  # must not let a genuine regression hide behind a WITHHELD block.
  if [ "$RC" -ne 0 ]; then
    echo "FAIL: case '$CASE' delivered everything it carried but exited $RC" >&2
    echo "$OUT" >&2
    exit 1
  fi
}

if echo "$OUT" | grep -qi "Traceback"; then
  echo "FAIL: update_template.py raised an unhandled exception for case '$CASE'" >&2
  echo "$OUT" >&2
  exit 1
fi

case "$CASE" in
  no_baseline)
    # GH-1343-informed policy: no recorded baseline AND local content differs
    # from incoming => treated as diverged, same as a confirmed mismatch.
    # WARN + SKIP, preserving local content byte-for-byte, no baseline write.
    NEW_CONTENT="$(cat "$WS/harness_file.txt" 2>/dev/null || true)"
    if [ "$NEW_CONTENT" != "PRE-EXISTING-LOCAL-V0" ]; then
      echo "FAIL: harness_file.txt is '$NEW_CONTENT', expected it to stay 'PRE-EXISTING-LOCAL-V0' (no-baseline-and-differs must SKIP the overwrite and preserve local content, per GH-1343)" >&2
      exit 1
    fi
    if ! (echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "harness_file.txt"); then
      echo "FAIL: no WARN naming harness_file.txt was printed for the no-baseline-and-differs case (GH-1343 regression: silently destroying un-tracked local content)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    require_withheld "harness_file.txt"
    echo "PASS: no_baseline case -- local content preserved, WARN printed, no baseline silently written"
    ;;

  match_baseline)
    NEW_CONTENT="$(cat "$WS/harness_file.txt" 2>/dev/null || true)"
    if [ "$NEW_CONTENT" != "$TEMPLATE_V2" ]; then
      echo "FAIL: harness_file.txt is '$NEW_CONTENT', expected update to '$TEMPLATE_V2' (untouched-since-last-sync file must still update)" >&2
      exit 1
    fi
    RECORDED="$(baseline_value "harness_file.txt")"
    EXPECTED_HASH="$(sha256_of "$WS/harness_file.txt")"
    if [ "$RECORDED" != "$EXPECTED_HASH" ]; then
      echo "FAIL: baseline for harness_file.txt is '$RECORDED', expected refreshed hash '$EXPECTED_HASH'" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "harness_file.txt"; then
      echo "FAIL: unexpected WARN for harness_file.txt when local content matched the stored baseline" >&2
      echo "$OUT" >&2
      exit 1
    fi
    require_exit_zero
    echo "PASS: match_baseline case -- untouched file updated normally, baseline refreshed"
    ;;

  mismatch_baseline)
    NEW_CONTENT="$(cat "$WS/harness_file.txt" 2>/dev/null || true)"
    if ! printf '%s' "$NEW_CONTENT" | grep -qF "$LOCAL_PATCH_MARKER"; then
      echo "FAIL: harness_file.txt no longer contains the local patch marker -- in-flight local modification was overwritten instead of skipped" >&2
      echo "--- actual content ---" >&2
      echo "$NEW_CONTENT" >&2
      exit 1
    fi
    if [ "$NEW_CONTENT" = "$TEMPLATE_V2" ]; then
      echo "FAIL: harness_file.txt was silently overwritten with the new template content ($TEMPLATE_V2)" >&2
      exit 1
    fi
    if ! (echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "harness_file.txt"); then
      echo "FAIL: no WARN naming harness_file.txt was printed for a locally-modified HARNESS file" >&2
      echo "$OUT" >&2
      exit 1
    fi
    RECORDED="$(baseline_value "harness_file.txt")"
    ORIGINAL_HASH="$(printf '%s' "$TEMPLATE_V1" | python3 -c "import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())")"
    if [ "$RECORDED" != "$ORIGINAL_HASH" ]; then
      echo "FAIL: baseline for harness_file.txt was changed to '$RECORDED' (expected it to stay at the original '$ORIGINAL_HASH' -- a silently-advanced baseline hides the divergence)" >&2
      exit 1
    fi
    require_withheld "harness_file.txt"
    echo "PASS: mismatch_baseline case -- locally modified file preserved untouched, WARN printed, baseline left unchanged"
    ;;

  workspace_derived_untouched)
    WS_CONTENT="$(cat "$WS/workspace_file.txt" 2>/dev/null || true)"
    DERIVED_CONTENT="$(cat "$WS/derived_file.txt" 2>/dev/null || true)"
    if [ "$WS_CONTENT" != "WORKSPACE-LOCAL-CONTENT" ]; then
      echo "FAIL: workspace_file.txt changed to '$WS_CONTENT' -- the new guard must never touch WORKSPACE-category files" >&2
      exit 1
    fi
    if [ "$DERIVED_CONTENT" != "DERIVED-LOCAL-CONTENT" ]; then
      echo "FAIL: derived_file.txt changed to '$DERIVED_CONTENT' -- the new guard must never touch DERIVED-category files" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "workspace_file.txt (WORKSPACE"; then
      echo "FAIL: expected the pre-existing WORKSPACE skip message for workspace_file.txt" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "derived_file.txt (DERIVED"; then
      echo "FAIL: expected the pre-existing DERIVED skip message for derived_file.txt" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if echo "$OUT" | grep -i "warn" | grep -qE "workspace_file\.txt|derived_file\.txt"; then
      echo "FAIL: overwrite-guard WARN leaked onto a WORKSPACE/DERIVED path -- the guard must be scoped to HARNESS only" >&2
      echo "$OUT" >&2
      exit 1
    fi
    require_exit_zero
    echo "PASS: workspace_derived_untouched case -- WORKSPACE/DERIVED files unaffected by the new guard, even with poisoned baseline entries"
    ;;

  corrupt_baseline)
    # A corrupt baseline file collapses to the same no-record status as
    # no_baseline. Local content differs from incoming, so this degrades to
    # the same GH-1343-informed SKIP-and-WARN outcome -- not auto-overwrite.
    NEW_CONTENT="$(cat "$WS/harness_file.txt" 2>/dev/null || true)"
    if [ "$NEW_CONTENT" != "$TEMPLATE_V1" ]; then
      echo "FAIL: harness_file.txt is '$NEW_CONTENT', expected it to stay '$TEMPLATE_V1' (a corrupt baseline must degrade to no-record-and-differs, which SKIPs the overwrite, not auto-overwrite)" >&2
      exit 1
    fi
    if echo "$OUT" | grep -qi "Traceback"; then
      echo "FAIL: update_template.py raised an unhandled exception reading the corrupt baseline file" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! (echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "harness_file.txt"); then
      echo "FAIL: no WARN naming harness_file.txt was printed for the corrupt-baseline-and-differs case" >&2
      echo "$OUT" >&2
      exit 1
    fi
    require_withheld "harness_file.txt"
    echo "PASS: corrupt_baseline case -- malformed baseline file did not crash the run; local content preserved with WARN"
    ;;

  dir_entry_mismatch)
    MODIFIED_CONTENT="$(cat "$WS/dirfiles/pulse_mission_loop.sh" 2>/dev/null || true)"
    if ! printf '%s' "$MODIFIED_CONTENT" | grep -qF "$LOCAL_PATCH_MARKER"; then
      echo "FAIL: dirfiles/pulse_mission_loop.sh no longer contains the local patch marker -- a locally-modified file nested inside a directory-category HARNESS entry was silently overwritten (the directory/rglob copy branch has no guard)" >&2
      echo "--- actual content ---" >&2
      echo "$MODIFIED_CONTENT" >&2
      exit 1
    fi
    if [ "$MODIFIED_CONTENT" = "$TEMPLATE_V2" ]; then
      echo "FAIL: dirfiles/pulse_mission_loop.sh was silently overwritten with the new template content ($TEMPLATE_V2)" >&2
      exit 1
    fi
    if ! (echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "dirfiles/pulse_mission_loop.sh"); then
      echo "FAIL: no WARN naming dirfiles/pulse_mission_loop.sh was printed for a locally-modified file inside a directory-category HARNESS entry" >&2
      echo "$OUT" >&2
      exit 1
    fi
    RECORDED="$(baseline_value "dirfiles/pulse_mission_loop.sh")"
    ORIGINAL_HASH="$(printf '%s' "$TEMPLATE_V1" | python3 -c "import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())")"
    if [ "$RECORDED" != "$ORIGINAL_HASH" ]; then
      echo "FAIL: baseline for dirfiles/pulse_mission_loop.sh was changed to '$RECORDED' (expected it to stay at the original '$ORIGINAL_HASH')" >&2
      exit 1
    fi
    SIBLING_CONTENT="$(cat "$WS/dirfiles/other_file.txt" 2>/dev/null || true)"
    if [ "$SIBLING_CONTENT" != "$TEMPLATE_V2" ]; then
      echo "FAIL: dirfiles/other_file.txt (untouched sibling in the same directory entry) is '$SIBLING_CONTENT', expected update to '$TEMPLATE_V2' -- an unmodified file in the same directory entry must still update normally" >&2
      exit 1
    fi
    require_withheld "dirfiles/pulse_mission_loop.sh"
    echo "PASS: dir_entry_mismatch case -- locally modified file nested in a directory-category HARNESS entry preserved with WARN, untouched sibling still updated"
    ;;

  dir_and_file_entry_order)
    MODIFIED_CONTENT="$(cat "$WS/orderdir/target_file.txt" 2>/dev/null || true)"
    if ! printf '%s' "$MODIFIED_CONTENT" | grep -qF "$LOCAL_PATCH_MARKER"; then
      echo "FAIL: orderdir/target_file.txt no longer contains the local patch marker -- the earlier-processed directory entry (orderdir/) clobbered the file before the later file-level entry's guard could run (the ordering bug QA found)" >&2
      echo "--- actual content ---" >&2
      echo "$MODIFIED_CONTENT" >&2
      exit 1
    fi
    if [ "$MODIFIED_CONTENT" = "$TEMPLATE_V2" ]; then
      echo "FAIL: orderdir/target_file.txt was silently overwritten with the new template content ($TEMPLATE_V2) by the directory-entry pass despite the later file-level guarded entry" >&2
      exit 1
    fi
    if ! (echo "$OUT" | grep -qi "warn" && echo "$OUT" | grep -i "warn" | grep -q "orderdir/target_file.txt"); then
      echo "FAIL: no WARN naming orderdir/target_file.txt was printed -- guard must fire regardless of manifest entry order" >&2
      echo "$OUT" >&2
      exit 1
    fi
    RECORDED="$(baseline_value "orderdir/target_file.txt")"
    ORIGINAL_HASH="$(printf '%s' "$TEMPLATE_V1" | python3 -c "import hashlib,sys;print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())")"
    if [ "$RECORDED" != "$ORIGINAL_HASH" ]; then
      echo "FAIL: baseline for orderdir/target_file.txt was changed to '$RECORDED' (expected it to stay at the original '$ORIGINAL_HASH')" >&2
      exit 1
    fi
    require_withheld "orderdir/target_file.txt"
    echo "PASS: dir_and_file_entry_order case -- guard is order-independent; nested file preserved regardless of directory-entry-before-file-entry ordering"
    ;;
esac
