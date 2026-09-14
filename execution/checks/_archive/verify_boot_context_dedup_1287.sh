#!/usr/bin/env bash
# verify_boot_context_dedup_1287.sh -- golden-file behavioral check for GitHub issue #1287.
#
# Bug: execution/hooks/full_boot.sh (and its template/ twin, template/execution/hooks/full_boot.sh
# -- NOT auto-synced with execution/, per the #1288 lesson, and independently verified here by
# diff to still lack BOTH fixes below) re-prints the ENTIRE "LATEST DIRECTIVE (comms.md)" block on
# every single boot, even when the directive text is byte-identical to the last session's, and
# dumps the ENTIRE rules.md regardless of length (no cap, unlike the existing learned.md
# tail-20-with-notice pattern already in execution/hooks/full_boot.sh). Both waste context budget
# every session for zero new information on long-lived projects.
#
# Fix contract (locked convention this script enforces):
#
#   1. comms.md dedup: cache the SHA-256 of the last-injected LATEST DIRECTIVE block text at
#      .agent/memory/scratch/.comms_last_hash (via `shasum -a 256`, macOS-safe -- sha256sum is
#      not guaranteed present on macOS). Compute the new directive's hash and compare to the
#      cached hash BEFORE printing:
#        - no directive present in comms.md at all -> print nothing, write nothing (today's
#          behavior when LATEST_DIRECTIVE is empty must be fully preserved).
#        - directive present, no cache file yet (first boot ever) OR cache unreadable/corrupt ->
#          SAFE DEFAULT: print the full directive (never silently swallow on doubt), then write
#          the fresh hash.
#        - directive present, hash matches cache (unchanged since last boot) -> do NOT re-print
#          the full block; cache file is left with the same hash (a no-op rewrite of the same
#          value is acceptable but the value itself must be unchanged).
#        - directive present, hash differs from cache (changed since last boot, including the
#          very first change after N unchanged boots) -> print the FULL new directive, then
#          overwrite the cache with the new hash.
#
#   2. rules.md cap: mirror the EXISTING learned.md pattern verbatim in style -- if rules.md
#      exceeds 30 lines, print a one-line notice ("... has N lines -- showing last 30 ...", same
#      wording style as the learned.md notice) and `tail -30` it instead of `cat`-ing the whole
#      file. At or under 30 lines: unchanged behavior, full `cat`, no notice line at all.
#
# This script drives the REAL execution/hooks/full_boot.sh (or its template/ twin with
# --template) end-to-end in an isolated fixture directory with controlled comms.md / rules.md /
# cache-file state, and greps stdout -- same fixture-isolation convention as
# execution/checks/verify_autonomy_type_guard_1288.sh -- so no real repo state is ever touched.
#
# Usage: verify_boot_context_dedup_1287.sh <case> [--template]
#   first_boot_directive_present   - (a) no cache file, directive present -> full directive
#                                     printed, cache file created with correct hash.
#   second_boot_unchanged          - (b) cache file present from a prior identical directive ->
#                                     directive block NOT re-printed, cache hash unchanged.
#   directive_changed              - (c) cache file present but stale (hash of an OLD directive
#                                     text) while comms.md now holds a NEW directive -> full NEW
#                                     directive printed, cache updated to the NEW hash.
#   no_directive_present            - (d) comms.md exists but has no "## [CODI" section at all ->
#                                     no directive block printed, no cache file created/touched.
#   cache_corrupted                 - trap case: cache file exists but contains garbage (not a
#                                     valid-looking hex hash) -> must NOT suppress the directive;
#                                     safe default is to print it anyway (degrade to "always
#                                     show" on doubt, never "never show again").
#   rules_under_cap                 - (e) rules.md at/under 30 lines -> full cat, no notice line.
#   rules_over_cap                  - (f) rules.md over 30 lines -> notice line + tail -30 only
#                                     (first 30-line-cap-worth of lines must NOT appear).
#
# Pass --template as a second argument to run the identical case against
# template/execution/hooks/full_boot.sh instead of execution/hooks/full_boot.sh.
#
# Exit 0 = PASS, exit 1 = FAIL.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CASE="${1:-}"
VARIANT="${2:-}"

if [ "$VARIANT" = "--template" ]; then
  TARGET="$REPO_ROOT/template/execution/hooks/full_boot.sh"
else
  TARGET="$REPO_ROOT/execution/hooks/full_boot.sh"
fi

if [ ! -f "$TARGET" ]; then
  echo "FAIL: target script not found: $TARGET" >&2
  exit 1
fi

WS="$(mktemp -d)"
cleanup() { /bin/rm -rf "$WS" 2>/dev/null || true; }
trap cleanup EXIT

# --- Minimal fixture project skeleton so full_boot.sh's many non-fatal steps no-op cleanly ---
mkdir -p "$WS/.agent/memory/scratch" "$WS/.agent/memory/project" "$WS/.agent/providers" "$WS/.agent/memory/project/missions"
printf 'GoldenFixtureProject-1287\n' > "$WS/WORKSPACE"
printf 'test\n' > "$WS/.agent/version"
cat > "$WS/.agent/profile.json" <<'JSON'
{"project_name": "GoldenFixtureProject-1287", "template_version": "test", "onboarding_complete": true, "autonomy": {"level": "medium"}, "identity": {"agent_name": "TestAgent", "project_role": "tester"}}
JSON
# goals.md / learned.md / backlog.md absent is fine -- full_boot.sh handles missing files.
touch "$WS/.agent/memory/project/goals.md" "$WS/.agent/memory/project/learned.md"

COMMS_FILE="$WS/.agent/memory/project/comms.md"
RULES_FILE="$WS/.agent/memory/project/rules.md"
CACHE_FILE="$WS/.agent/memory/scratch/.comms_last_hash"

write_comms_with_directive() {
  # $1 = distinguishing marker text embedded in the directive body
  #
  # NOTE: deliberately a SINGLE "## [CODI ->" section (not multiple). execution/hooks/full_boot.sh
  # and template/execution/hooks/full_boot.sh use genuinely DIFFERENT extraction logic for "which
  # CODI block is latest" (execution/ uses `grep -n ... | tail -1` to find the LAST matching
  # line; template/ uses an awk state machine that stops at the FIRST matching block). That
  # divergence is a separate, pre-existing issue from #1287's dedup/cap scope -- these goldens
  # must isolate dedup/cap behavior from "which block is latest" logic, so a single unambiguous
  # CODI section is used so both extraction strategies agree on the same directive text.
  cat > "$COMMS_FILE" <<EOF
# Comms Log

## [CODI -> AGENT] 2026-01-02
DIRECTIVE-MARKER: $1
Follow this instruction exactly.
EOF
}

write_comms_no_directive() {
  cat > "$COMMS_FILE" <<'EOF'
# Comms Log

(no CODI directive sections at all -- just prose notes)
Some unrelated log line.
EOF
}

write_rules_lines() {
  # $1 = number of lines to generate
  local n="$1"
  rm -f "$RULES_FILE"
  for i in $(seq 1 "$n"); do
    echo "rule line $i -- rules-content-marker-$i" >> "$RULES_FILE"
  done
}

hash_of_directive_marker() {
  # Compute the hash exactly as the target script does: sha256 of the extracted directive body,
  # via `printf '%s' "$VAR" | shasum -a 256` where $VAR comes from a $(...) command substitution
  # (which strips trailing newlines) -- NOT `printf '%s\n'`. Must match byte-for-byte or this
  # golden's expected-hash comparisons are meaningless.
  printf '%s' "DIRECTIVE-MARKER: $1
Follow this instruction exactly." | shasum -a 256 | awk '{print $1}'
}

run_boot() {
  (cd "$WS" && bash "$TARGET" 2>&1)
}

case "$CASE" in
  first_boot_directive_present)
    write_comms_with_directive "alpha"
    rm -f "$CACHE_FILE"
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: alpha"; then
      echo "FAIL: first_boot_directive_present -- full directive was NOT printed on the very first boot (no cache file existed yet). Safe-default-to-show is violated." >&2
      echo "$OUT" >&2
      exit 1
    fi
    if [ ! -f "$CACHE_FILE" ]; then
      echo "FAIL: first_boot_directive_present -- cache file was not created after printing the directive" >&2
      exit 1
    fi
    echo "PASS: first_boot_directive_present -- full directive printed, cache file created"
    ;;

  second_boot_unchanged)
    write_comms_with_directive "alpha"
    EXPECTED_HASH="$(hash_of_directive_marker "alpha")"
    printf '%s' "$EXPECTED_HASH" > "$CACHE_FILE"
    OUT="$(run_boot)"
    if echo "$OUT" | grep -q "DIRECTIVE-MARKER: alpha"; then
      echo "FAIL: second_boot_unchanged -- directive was RE-PRINTED even though its hash matches the cache from the prior boot (this is the headline bug -- repeat boots must not re-inject an unchanged directive)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    AFTER_HASH="$(cat "$CACHE_FILE" 2>/dev/null || echo "")"
    if [ "$AFTER_HASH" != "$EXPECTED_HASH" ]; then
      echo "FAIL: second_boot_unchanged -- cache hash changed even though the directive text did not ($EXPECTED_HASH -> $AFTER_HASH)" >&2
      exit 1
    fi
    echo "PASS: second_boot_unchanged -- unchanged directive suppressed, cache hash stable"
    ;;

  directive_changed)
    write_comms_with_directive "alpha"
    STALE_HASH="$(hash_of_directive_marker "some-other-old-directive-text")"
    printf '%s' "$STALE_HASH" > "$CACHE_FILE"
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: alpha"; then
      echo "FAIL: directive_changed -- new/changed directive was NOT printed even though the cached hash does not match the current directive's hash" >&2
      echo "$OUT" >&2
      exit 1
    fi
    NEW_EXPECTED_HASH="$(hash_of_directive_marker "alpha")"
    AFTER_HASH="$(cat "$CACHE_FILE" 2>/dev/null || echo "")"
    if [ "$AFTER_HASH" != "$NEW_EXPECTED_HASH" ]; then
      echo "FAIL: directive_changed -- cache was not updated to the new directive's hash after printing it (still '$AFTER_HASH', expected '$NEW_EXPECTED_HASH')" >&2
      exit 1
    fi
    echo "PASS: directive_changed -- new directive printed, cache updated to new hash"
    ;;

  no_directive_present)
    write_comms_no_directive
    rm -f "$CACHE_FILE"
    OUT="$(run_boot)"
    if echo "$OUT" | grep -q "LATEST DIRECTIVE"; then
      echo "FAIL: no_directive_present -- a LATEST DIRECTIVE block header was printed even though comms.md has no CODI directive section at all" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if [ -f "$CACHE_FILE" ]; then
      echo "FAIL: no_directive_present -- cache file was created/touched even though there was no directive to hash" >&2
      exit 1
    fi
    echo "PASS: no_directive_present -- no block printed, no cache file written"
    ;;

  cache_corrupted)
    write_comms_with_directive "alpha"
    printf 'THIS IS NOT A VALID SHA256 HASH !!! %%%%' > "$CACHE_FILE"
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -q "DIRECTIVE-MARKER: alpha"; then
      echo "FAIL: cache_corrupted -- directive was SUPPRESSED because the cache file was unreadable/corrupt. Safe default on doubt must be to SHOW the directive, never to silently withhold it forever." >&2
      echo "$OUT" >&2
      exit 1
    fi
    echo "PASS: cache_corrupted -- corrupt cache degrades to showing the directive (safe default), does not suppress it"
    ;;

  rules_under_cap)
    write_rules_lines 30
    OUT="$(run_boot)"
    if echo "$OUT" | grep -qi "showing last 30"; then
      echo "FAIL: rules_under_cap -- cap notice printed even though rules.md is exactly at the 30-line threshold (must be unaffected, full cat, no notice)" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "rules-content-marker-1$"; then
      echo "FAIL: rules_under_cap -- first line of rules.md (marker-1) missing from output; full cat expected at/under cap" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "rules-content-marker-30$"; then
      echo "FAIL: rules_under_cap -- last line of rules.md (marker-30) missing from output" >&2
      exit 1
    fi
    echo "PASS: rules_under_cap -- 30-line rules.md printed in full, no notice"
    ;;

  rules_over_cap)
    write_rules_lines 45
    OUT="$(run_boot)"
    if ! echo "$OUT" | grep -qi "45 lines"; then
      echo "FAIL: rules_over_cap -- no cap notice mentioning the actual line count (45) was printed for an over-cap rules.md" >&2
      echo "$OUT" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -qi "last 30"; then
      echo "FAIL: rules_over_cap -- cap notice did not mention 'last 30', expected wording mirroring the learned.md notice style" >&2
      exit 1
    fi
    if echo "$OUT" | grep -q "rules-content-marker-1$"; then
      echo "FAIL: rules_over_cap -- line 1 of a 45-line rules.md leaked into output; only the LAST 30 lines (16-45) should be shown via tail -30" >&2
      exit 1
    fi
    if ! echo "$OUT" | grep -q "rules-content-marker-45$"; then
      echo "FAIL: rules_over_cap -- last line (marker-45) of rules.md missing from output; tail -30 should include it" >&2
      exit 1
    fi
    echo "PASS: rules_over_cap -- notice printed with correct line count, only last 30 lines shown"
    ;;

  *)
    echo "FAIL: unknown case '$CASE' (expected first_boot_directive_present|second_boot_unchanged|directive_changed|no_directive_present|cache_corrupted|rules_under_cap|rules_over_cap)" >&2
    exit 1
    ;;
esac
