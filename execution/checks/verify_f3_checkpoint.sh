#!/usr/bin/env bash
# verify_f3_checkpoint.sh -- sandboxed behavioral + static scenarios for
# mission quota-aware-execution F3 (checkpoint-before-quota-death).
#
# Defect under test: execution/hooks/quota_death_checkpoint.sh (a StopFailure
# hook) reads `.stop_reason` from the payload. Claude Code's real StopFailure
# payload field is `.error` (docs.claude.com/en/docs/claude-code/hooks) --
# there is no `.stop_reason` field. Every real invocation falls through to
# "unknown" and nothing is ever written. The hook has never once fired
# successfully in production.
#
# Fix shape (design only -- @dev implements):
#   1. Reactive: quota_death_checkpoint.sh reads `.error` (not `.stop_reason`)
#      from the StopFailure payload, still gating only on rate_limit |
#      billing_error, everything else (authentication_failed, server_error,
#      invalid_request, max_output_tokens, unknown, missing) is a no-op.
#   2. Proactive (PRIMARY mechanism): inject_pressure.sh (UserPromptSubmit,
#      fires every turn) grows a high-water-mark branch that writes the same
#      checkpoint JSON when used_pct >= 90, modeled on its existing
#      "CONTEXT HIGH" >= 100000-token branch. This is primary because it
#      depends only on the harness's own verified quota mirror (already
#      wired), not on staying in sync with Claude Code's StopFailure payload
#      contract across CLI versions.
#   3. Both paths write the SAME schema to the SAME default path
#      (.agent/memory/scratch/.quota_death_checkpoint.json) that
#      full_boot.sh already consumes (execution/hooks/full_boot.sh:52-59),
#      preserving its existing field names verbatim so it needs no changes:
#        { "timestamp": <iso8601>,
#          "stop_reason": "rate_limit"|"billing_error"|"quota_high_water",
#          "active_mission": <active.json .mission, or null>,
#          "active_checkpoint": <active.json .checkpoint, or null>,
#          "recovery_message": <human string> }
#   4. Testability seams (new, both scripts): ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH
#      overrides the checkpoint output path (default unchanged:
#      .agent/memory/scratch/.quota_death_checkpoint.json);
#      ATHANOR_ACTIVE_MISSION_PATH overrides the active.json path read for the
#      mission/checkpoint snapshot (default unchanged:
#      .agent/memory/project/missions/active.json). Both default to today's
#      hardcoded relative paths when unset -- no change to production
#      behavior. inject_pressure.sh's proactive branch reuses its EXISTING
#      seams for quota %: ATHANOR_QUOTA_CACHE_OVERRIDE (source of used_pct)
#      and ATHANOR_QUOTA_MIRROR_OVERRIDE (F1's separate mirror write, unrelated
#      to the death-checkpoint but must not be allowed to hit the real
#      project mirror during tests).
#
# Drives the REAL execution/hooks/quota_death_checkpoint.sh and
# execution/hooks/inject_pressure.sh from repo root against throwaway
# mktemp fixtures. NEVER touches .agent/memory/scratch/, active.json, or
# ~/.claude -- every path is redirected via the override env vars above.
#
# Errexit-trap safety: every capture of a command whose exit code we inspect
# is wrapped in `set +e` / capture / `set -e` (docs/VALIDATION_CONTRACTS.md).
#
# Usage: verify_f3_checkpoint.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"

# write_active PATH MISSION MILESTONE FEATURE -- fixture active.json in the
# real shape (.agent/memory/project/missions/active.json): {"mission": <path
# string>, "checkpoint": {"milestone":..,"feature":..,"ts":..}, "activated_at":..}
write_active() {
    local path="$1" mission="$2" milestone="$3" feature="$4"
    jq -n --arg m "$mission" --arg ms "$milestone" --arg f "$feature" \
        '{mission:$m, checkpoint:{milestone:$ms, feature:$f, ts:"2026-08-07T00:00:00Z"}, activated_at:"2026-08-07T00:00:00Z"}' \
        > "$path"
}

# write_cache PATH UTILIZATION -- fixture usage-cache.json shape read by
# inject_pressure.sh via ATHANOR_QUOTA_CACHE_OVERRIDE (.five_hour.utilization,
# .five_hour.resets_at).
write_cache() {
    local path="$1" pct="$2"
    local resets
    resets="$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
    jq -n --argjson p "$pct" --arg r "$resets" '{five_hour:{utilization:$p, resets_at:$r}}' > "$path"
}

case "$CASE" in

  # --- Part 1: reactive path (quota_death_checkpoint.sh) ---------------

  static_reads_error_not_stop_reason)
    fail=0
    grep -Eq "jq -r '\.error( |//)" execution/hooks/quota_death_checkpoint.sh \
        || { echo "FAIL: quota_death_checkpoint.sh does not parse .error from the StopFailure payload (docs.claude.com: payload field is .error, not .stop_reason)"; fail=1; }
    grep -q "jq -r '\.stop_reason" execution/hooks/quota_death_checkpoint.sh \
        && { echo "FAIL: quota_death_checkpoint.sh still parses .stop_reason from the payload -- that field does not exist in the real StopFailure payload"; fail=1; }
    [ "$fail" -eq 0 ] && echo "PASS: static_reads_error_not_stop_reason" || exit 1
    ;;

  reactive_rate_limit_writes_checkpoint)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3

    set +e
    echo '{"session_id":"s1","error":"rate_limit","error_details":"5-hour limit reached"}' \
        | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
          bash execution/hooks/quota_death_checkpoint.sh
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: hook exited $exit_code (StopFailure hooks must never fail the turn)"; fail=1; }
    [ -f "$cp" ] || { echo "FAIL: no checkpoint written for error=rate_limit -- this is the core defect: the payload has .error, not .stop_reason, so the current code never matches"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- checkpoint dir ---"; ls -la "$tmpdir"
        exit 1
    fi
    echo "PASS: reactive_rate_limit_writes_checkpoint"
    ;;

  reactive_billing_error_writes_checkpoint)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3

    set +e
    echo '{"session_id":"s1","error":"billing_error"}' \
        | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
          bash execution/hooks/quota_death_checkpoint.sh
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: hook exited $exit_code for error=billing_error"; fail=1; }
    [ -f "$cp" ] || { echo "FAIL: no checkpoint written for error=billing_error"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: reactive_billing_error_writes_checkpoint"
    ;;

  reactive_non_quota_error_writes_nothing)
    # NOTE: trivially true pre-fix -- today the hook NEVER writes a checkpoint
    # for any input (it always reads the nonexistent .stop_reason and falls
    # to the *) exit 0 branch), so "authentication_failed writes nothing" is
    # vacuously satisfied before the fix exists too. This is a non-regression
    # safety net proving the fix's error-type filter stays selective, not
    # F3's falsifiable core (that is reactive_rate_limit_writes_checkpoint /
    # reactive_billing_error_writes_checkpoint).
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3

    for err in authentication_failed invalid_request server_error max_output_tokens unknown; do
        set +e
        echo "{\"session_id\":\"s1\",\"error\":\"${err}\"}" \
            | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
              bash execution/hooks/quota_death_checkpoint.sh
        exit_code=$?
        set -e
        [ "$exit_code" -eq 0 ] || { echo "FAIL: hook exited $exit_code for non-quota error=$err (must always exit 0)"; exit 1; }
        [ -f "$cp" ] && { echo "FAIL: checkpoint was written for non-quota error=$err -- only rate_limit/billing_error should checkpoint"; exit 1; }
    done
    echo "PASS: reactive_non_quota_error_writes_nothing"
    ;;

  reactive_missing_error_field_no_crash)
    # NOTE: trivially true pre-fix -- the existing `// "unknown"` jq default
    # and `set -uo pipefail` (no `-e`) already tolerate a missing/malformed
    # field without crashing. A regression safety net, not falsifiable core.
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3

    for payload in '{}' 'not json at all' '{"session_id":"s1"}'; do
        set +e
        printf '%s' "$payload" \
            | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
              bash execution/hooks/quota_death_checkpoint.sh 2>"$tmpdir/stderr"
        exit_code=$?
        set -e
        [ "$exit_code" -eq 0 ] || { echo "FAIL: hook exited $exit_code on malformed/missing-error payload: $payload"; cat "$tmpdir/stderr"; exit 1; }
        [ -f "$cp" ] && { echo "FAIL: checkpoint written for malformed/missing-error payload: $payload"; exit 1; }
        grep -qi traceback "$tmpdir/stderr" && { echo "FAIL: crash trace for payload: $payload"; exit 1; }
    done
    echo "PASS: reactive_missing_error_field_no_crash"
    ;;

  reactive_checkpoint_content_sufficient)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3

    echo '{"session_id":"s1","error":"rate_limit"}' \
        | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
          bash execution/hooks/quota_death_checkpoint.sh >/dev/null 2>&1 || true

    fail=0
    [ -f "$cp" ] || { echo "FAIL: no checkpoint file to inspect (see reactive_rate_limit_writes_checkpoint)"; exit 1; }
    mission_val="$(jq -r '.active_mission // empty' "$cp")"
    milestone_val="$(jq -r '.active_checkpoint.milestone // empty' "$cp")"
    feature_val="$(jq -r '.active_checkpoint.feature // empty' "$cp")"
    reason_val="$(jq -r '.stop_reason // empty' "$cp")"
    msg_val="$(jq -r '.recovery_message // empty' "$cp")"
    [ "$mission_val" = ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" ] || { echo "FAIL: checkpoint's active_mission ('$mission_val') does not match the fixture active.json's .mission -- checkpoint must capture WHICH mission/checkpoint to resume, not merely that a death occurred"; fail=1; }
    [ "$milestone_val" = "M1" ] || { echo "FAIL: checkpoint's active_checkpoint.milestone ('$milestone_val') != M1 from fixture"; fail=1; }
    [ "$feature_val" = "F3" ] || { echo "FAIL: checkpoint's active_checkpoint.feature ('$feature_val') != F3 from fixture"; fail=1; }
    [ "$reason_val" = "rate_limit" ] || { echo "FAIL: checkpoint's stop_reason ('$reason_val') != rate_limit"; fail=1; }
    [ -n "$msg_val" ] || { echo "FAIL: checkpoint has no human-readable recovery_message"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- checkpoint content ---"; cat "$cp"
        exit 1
    fi
    echo "PASS: reactive_checkpoint_content_sufficient"
    ;;

  # --- Part 2: proactive path (inject_pressure.sh high-water-mark) -----

  static_proactive_high_water_branch_exists)
    fail=0
    grep -q 'ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH' execution/hooks/inject_pressure.sh \
        || { echo "FAIL: inject_pressure.sh has no high-water-mark branch writing to the checkpoint path (ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH override not referenced)"; fail=1; }
    grep -Eq '(^|[^0-9])90([^0-9]|$)' execution/hooks/inject_pressure.sh \
        || { echo "FAIL: inject_pressure.sh does not reference a 90 (percent) high-water threshold"; fail=1; }
    [ "$fail" -eq 0 ] && echo "PASS: static_proactive_high_water_branch_exists" || exit 1
    ;;

  proactive_fires_at_boundary_90)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cache="$tmpdir/usage-cache.json"
    mirror="$tmpdir/mirror.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3
    write_cache "$cache" 90

    set +e
    out="$(echo '{}' | ATHANOR_QUOTA_CACHE_OVERRIDE="$cache" ATHANOR_QUOTA_MIRROR_OVERRIDE="$mirror" \
        ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
        bash execution/hooks/inject_pressure.sh)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: inject_pressure.sh exited $exit_code (UserPromptSubmit hooks must never fail the turn)"; fail=1; }
    echo "$out" | jq -e . >/dev/null 2>&1 || { echo "FAIL: inject_pressure.sh did not emit valid JSON on stdout"; fail=1; }
    [ -f "$cp" ] || { echo "FAIL: no checkpoint written at used_pct=90 (>= 90 boundary, inclusive) -- this is the primary mechanism per F3 design"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- stdout ---"; echo "$out"
        exit 1
    fi
    echo "PASS: proactive_fires_at_boundary_90"
    ;;

  proactive_does_not_fire_below_90)
    # NOTE: trivially true pre-fix -- the high-water branch does not exist
    # yet, so nothing is ever written regardless of used_pct. A non-regression
    # safety net (proving the eventual threshold check is >= not >), not
    # F3's falsifiable core (that is proactive_fires_at_boundary_90).
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cache="$tmpdir/usage-cache.json"
    mirror="$tmpdir/mirror.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3
    write_cache "$cache" 89

    set +e
    echo '{}' | ATHANOR_QUOTA_CACHE_OVERRIDE="$cache" ATHANOR_QUOTA_MIRROR_OVERRIDE="$mirror" \
        ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
        bash execution/hooks/inject_pressure.sh >/dev/null
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: inject_pressure.sh exited $exit_code at used_pct=89"; fail=1; }
    [ -f "$cp" ] && { echo "FAIL: checkpoint written at used_pct=89, below the 90 threshold"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: proactive_does_not_fire_below_90"
    ;;

  proactive_checkpoint_content_sufficient)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cache="$tmpdir/usage-cache.json"
    mirror="$tmpdir/mirror.json"
    cp="$tmpdir/checkpoint.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3
    write_cache "$cache" 95

    echo '{}' | ATHANOR_QUOTA_CACHE_OVERRIDE="$cache" ATHANOR_QUOTA_MIRROR_OVERRIDE="$mirror" \
        ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
        bash execution/hooks/inject_pressure.sh >/dev/null 2>&1 || true

    fail=0
    [ -f "$cp" ] || { echo "FAIL: no checkpoint file to inspect (see proactive_fires_at_boundary_90)"; exit 1; }
    mission_val="$(jq -r '.active_mission // empty' "$cp")"
    milestone_val="$(jq -r '.active_checkpoint.milestone // empty' "$cp")"
    feature_val="$(jq -r '.active_checkpoint.feature // empty' "$cp")"
    msg_val="$(jq -r '.recovery_message // empty' "$cp")"
    [ "$mission_val" = ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" ] || { echo "FAIL: proactive checkpoint's active_mission ('$mission_val') does not match fixture active.json"; fail=1; }
    [ "$milestone_val" = "M1" ] || { echo "FAIL: proactive checkpoint's active_checkpoint.milestone ('$milestone_val') != M1"; fail=1; }
    [ "$feature_val" = "F3" ] || { echo "FAIL: proactive checkpoint's active_checkpoint.feature ('$feature_val') != F3"; fail=1; }
    [ -n "$msg_val" ] || { echo "FAIL: proactive checkpoint has no human-readable recovery_message"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- checkpoint content ---"; cat "$cp"
        exit 1
    fi
    echo "PASS: proactive_checkpoint_content_sufficient"
    ;;

  static_atomic_checkpoint_write)
    # The one write in this feature that must survive an abrupt death (OOM,
    # SIGKILL, or the very quota-exhaustion event this feature exists to
    # survive) is currently the one write NOT done atomically: both hooks
    # compose the checkpoint via `jq -n ... > "$CHECKPOINT"`, and shell
    # redirection truncates/creates the destination BEFORE jq produces any
    # output. A kill mid-write leaves an empty or truncated-invalid file.
    # inject_pressure.sh already uses the correct tmp-path + os.replace()
    # pattern for its lower-stakes quota-mirror write in this same file --
    # this assertion requires the higher-stakes checkpoint write follow the
    # same precedent: write to a temp file, then mv/rename into place, so
    # $CHECKPOINT is only ever absent or complete, never partial.
    fail=0

    if grep -qF '> "$CHECKPOINT"' execution/hooks/quota_death_checkpoint.sh; then
        echo "FAIL: quota_death_checkpoint.sh redirects jq output directly onto \$CHECKPOINT ('> \"\$CHECKPOINT\"') -- not atomic; a kill mid-write leaves a truncated/empty checkpoint, defeating the crash-recovery mechanism"
        fail=1
    fi
    grep -Eq '\bmv\b.*\$CHECKPOINT|os\.replace\([^)]*CHECKPOINT' execution/hooks/quota_death_checkpoint.sh \
        || { echo "FAIL: quota_death_checkpoint.sh has no atomic rename (mv / os.replace) into \$CHECKPOINT -- the checkpoint must be written to a temp file first, then renamed into place"; fail=1; }

    if grep -qF '> "$CHECKPOINT"' execution/hooks/inject_pressure.sh; then
        echo "FAIL: inject_pressure.sh's high-water checkpoint write redirects jq output directly onto \$CHECKPOINT ('> \"\$CHECKPOINT\"') -- not atomic, unlike this same file's own quota-mirror write a few lines above (which correctly uses tmp_path + os.replace())"
        fail=1
    fi
    grep -Eq '\bmv\b.*\$CHECKPOINT|os\.replace\([^)]*CHECKPOINT' execution/hooks/inject_pressure.sh \
        || { echo "FAIL: inject_pressure.sh has no atomic rename (mv / os.replace) into \$CHECKPOINT for the high-water checkpoint write"; fail=1; }

    [ "$fail" -eq 0 ] && echo "PASS: static_atomic_checkpoint_write" || exit 1
    ;;

  # --- Part 3: fail-safe direction (both hooks degrade silently) -------

  reactive_unwritable_checkpoint_path_does_not_crash_turn)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3
    # Blocking path: a plain file where the checkpoint's PARENT directory
    # needs to be, so any mkdir -p/open() targeting it must fail.
    blocker="$tmpdir/blocker"
    : > "$blocker"
    cp="$blocker/checkpoint.json"

    set +e
    echo '{"session_id":"s1","error":"rate_limit"}' \
        | ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
          bash execution/hooks/quota_death_checkpoint.sh
    exit_code=$?
    set -e

    [ "$exit_code" -eq 0 ] || { echo "FAIL: hook exited $exit_code when its checkpoint path was unwritable -- a hook failure must degrade silently, never break the turn (StopFailure output/exit is ignored by Claude Code, but a nonzero exit here signals the fix crashed rather than degraded)"; exit 1; }
    echo "PASS: reactive_unwritable_checkpoint_path_does_not_crash_turn"
    ;;

  proactive_unwritable_checkpoint_path_does_not_crash_turn)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    active="$tmpdir/active.json"
    cache="$tmpdir/usage-cache.json"
    mirror="$tmpdir/mirror.json"
    write_active "$active" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" M1 F3
    write_cache "$cache" 95
    blocker="$tmpdir/blocker"
    : > "$blocker"
    cp="$blocker/checkpoint.json"

    set +e
    out="$(echo '{}' | ATHANOR_QUOTA_CACHE_OVERRIDE="$cache" ATHANOR_QUOTA_MIRROR_OVERRIDE="$mirror" \
        ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$cp" ATHANOR_ACTIVE_MISSION_PATH="$active" \
        bash execution/hooks/inject_pressure.sh)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: inject_pressure.sh exited $exit_code when the checkpoint path was unwritable -- a UserPromptSubmit hook must NEVER block the turn"; fail=1; }
    echo "$out" | jq -e . >/dev/null 2>&1 || { echo "FAIL: inject_pressure.sh did not emit valid JSON on stdout when the checkpoint write failed -- a silent internal failure must not corrupt the additionalContext payload either"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- stdout ---"; echo "$out"
        exit 1
    fi
    echo "PASS: proactive_unwritable_checkpoint_path_does_not_crash_turn"
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: static_reads_error_not_stop_reason, reactive_rate_limit_writes_checkpoint, reactive_billing_error_writes_checkpoint, reactive_non_quota_error_writes_nothing, reactive_missing_error_field_no_crash, reactive_checkpoint_content_sufficient, static_proactive_high_water_branch_exists, proactive_fires_at_boundary_90, proactive_does_not_fire_below_90, proactive_checkpoint_content_sufficient, reactive_unwritable_checkpoint_path_does_not_crash_turn, proactive_unwritable_checkpoint_path_does_not_crash_turn, static_atomic_checkpoint_write" >&2
    exit 1
    ;;
esac
