#!/usr/bin/env bash
# verify_f4_quota_resume.sh -- sandboxed behavioral + static scenarios for
# mission quota-aware-execution F4 (durable quota-window resume, default-OFF).
#
# Feature under test (does not exist yet -- @dev implements):
#   execution/pulse_quota_resume.sh
#
# SAFETY: this check NEVER touches the real .agent/pulse/queue, the real
# .agent/memory/scratch/.quota_death_checkpoint.json, the real
# .agent/memory/project/missions/active.json, launchctl, the Pulse plist, or
# manage_pulse.sh. Every path is a mktemp fixture passed via override env
# vars. Dispatcher scenarios use pulse_dispatcher.py's OWN budget/backoff
# gates to guarantee blocking BEFORE any provider subprocess would be
# launched -- no real provider CLI is ever invoked by this script.
#
# Errexit-trap safety: every capture of a command whose exit code we inspect
# is wrapped in `set +e` / capture / `set -e` (docs/VALIDATION_CONTRACTS.md).
#
# Usage: verify_f4_quota_resume.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

SCRIPT="execution/pulse_quota_resume.sh"
CASE="${1:-}"

# write_checkpoint PATH TIMESTAMP MISSION MILESTONE FEATURE -- F3-schema
# checkpoint fixture: {timestamp, stop_reason, active_mission,
# active_checkpoint:{milestone,feature}, recovery_message}.
write_checkpoint() {
    local path="$1" ts="$2" mission="$3" milestone="$4" feature="$5"
    jq -n --arg ts "$ts" --arg m "$mission" --arg ms "$milestone" --arg f "$feature" \
        '{timestamp:$ts, stop_reason:"quota_high_water", active_mission:$m,
          active_checkpoint:{milestone:$ms, feature:$f}, recovery_message:"resume the mission"}' \
        > "$path"
}

# write_mirror PATH OFFSET_SECONDS -- quota.py mirror fixture. OFFSET is
# resets_at relative to now: negative = already passed, positive = future.
# captured_at is always "now" so quota.py never reports state=stale.
write_mirror() {
    local path="$1" offset="$2"
    local now_epoch resets_epoch resets_at captured_at
    now_epoch="$(date -u +%s)"
    resets_epoch=$((now_epoch + offset))
    resets_at="$(date -u -r "$resets_epoch" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$resets_epoch" +%Y-%m-%dT%H:%M:%SZ)"
    captured_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    jq -n --argjson p 95 --arg r "$resets_at" --argjson s "$offset" --arg c "$captured_at" \
        '{used_pct:$p, resets_at:$r, seconds_to_reset:$s, captured_at:$c}' \
        > "$path"
}

# setup_sandbox -- builds a throwaway fake project root with .agent/pulse/queue
# so the REAL pulse_dispatcher.py can run against it via --project-root
# without touching this repo's real Pulse state.
setup_sandbox() {
    local root="$1"
    mkdir -p "$root/.agent/pulse/queue"
}

# scenario_env TMPDIR TS_OFFSET_FOR_CHECKPOINT RESETS_OFFSET -- common fixture
# wiring shared by most cases: fresh checkpoint (age 0) unless overridden,
# resets_at at the given offset. Prints nothing; exports via nameref-free
# globals for simplicity in this bash version.
build_common_fixtures() {
    local tmpdir="$1" checkpoint_age_seconds="$2" resets_offset="$3"
    local mission="cp" milestone="M1" feature="F4"
    CKPT="$tmpdir/checkpoint.json"
    MIRROR="$tmpdir/mirror.json"
    QUEUE="$tmpdir/fakeroot/.agent/pulse/queue"
    FAKEROOT="$tmpdir/fakeroot"
    setup_sandbox "$FAKEROOT"
    local now_epoch ckpt_epoch ckpt_ts
    now_epoch="$(date -u +%s)"
    ckpt_epoch=$((now_epoch - checkpoint_age_seconds))
    ckpt_ts="$(date -u -r "$ckpt_epoch" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "@$ckpt_epoch" +%Y-%m-%dT%H:%M:%SZ)"
    write_checkpoint "$CKPT" "$ckpt_ts" ".agent/memory/project/missions/2026-08-06-quota-aware-execution.md" "$milestone" "$feature"
    write_mirror "$MIRROR" "$resets_offset"
}

# run_f4 -- invokes the (not-yet-existing) script with the standard fixture
# env. Extra args/env can be layered by the caller before calling this.
run_f4() {
    ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH="$CKPT" \
    ATHANOR_QUOTA_RESUME_MIRROR_PATH="$MIRROR" \
    ATHANOR_QUOTA_RESUME_QUEUE_DIR="$QUEUE" \
    ATHANOR_QUOTA_RESUME_PROJECT_PATH="$FAKEROOT" \
        bash "$SCRIPT"
}

count_queue_files() {
    find "$QUEUE" -maxdepth 1 -name '*.json' -type f 2>/dev/null | wc -l | tr -d ' '
}

case "$CASE" in

  # --- Static: interface exists and follows the required shape ----------

  static_flag_env_var_gates_script)
    [ -f "$SCRIPT" ] || { echo "FAIL: $SCRIPT does not exist"; exit 1; }
    grep -q 'ATHANOR_PULSE_QUOTA_RESUME' "$SCRIPT" \
        || { echo "FAIL: $SCRIPT never references ATHANOR_PULSE_QUOTA_RESUME -- the master default-OFF switch"; exit 1; }
    echo "PASS: static_flag_env_var_gates_script"
    ;;

  static_uses_quota_py_oracle)
    [ -f "$SCRIPT" ] || { echo "FAIL: $SCRIPT does not exist"; exit 1; }
    grep -Eq 'quota\.py.*status' "$SCRIPT" \
        || { echo "FAIL: $SCRIPT does not call execution/quota.py status -- it must reuse F1's oracle rather than inventing its own quota read"; exit 1; }
    echo "PASS: static_uses_quota_py_oracle"
    ;;

  static_uses_pulse_ticket_enqueue)
    [ -f "$SCRIPT" ] || { echo "FAIL: $SCRIPT does not exist"; exit 1; }
    grep -Eq 'pulse_ticket\.py.*enqueue' "$SCRIPT" \
        || { echo "FAIL: $SCRIPT does not call execution/pulse_ticket.py enqueue -- tickets must be created through the shared ticket writer, not hand-composed JSON"; exit 1; }
    echo "PASS: static_uses_pulse_ticket_enqueue"
    ;;

  static_never_touches_service_lifecycle)
    [ -f "$SCRIPT" ] || { echo "FAIL: $SCRIPT does not exist"; exit 1; }
    fail=0
    grep -q 'launchctl' "$SCRIPT" && { echo "FAIL: $SCRIPT references launchctl -- F4 must never start/stop/load/unload the Pulse service"; fail=1; }
    grep -q 'manage_pulse\.sh' "$SCRIPT" && { echo "FAIL: $SCRIPT references manage_pulse.sh -- F4 must not touch service lifecycle"; fail=1; }
    grep -q '\.plist' "$SCRIPT" && { echo "FAIL: $SCRIPT references a .plist -- F4 must not touch the launchd unit"; fail=1; }
    grep -Eq '\bclaude\b.*-p |codex exec|gemini .*-p ' "$SCRIPT" && { echo "FAIL: $SCRIPT appears to invoke a provider CLI directly -- dispatch belongs to pulse_dispatcher.py alone, F4 only enqueues a ticket"; fail=1; }
    [ "$fail" -eq 0 ] && echo "PASS: static_never_touches_service_lifecycle" || exit 1
    ;;

  # --- Core safety #1 (highest priority): default-OFF is truly inert ----

  flag_off_is_inert_even_with_perfect_trigger)
    # NOTE: pre-implementation this is RED because $SCRIPT does not exist at
    # all (bash reports "No such file or directory", nonzero exit) -- it is
    # NOT a meaningful demonstration of gating logic yet, just proof the
    # script is absent. Post-implementation it becomes the load-bearing
    # safety assertion: every OTHER trigger condition below is satisfied
    # (fresh checkpoint, resets_at already passed) and the flag alone must
    # still suppress all behavior.
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60

    fail=0
    for flagval in "" "0" "false" "False" "FALSE"; do
        set +e
        if [ -z "$flagval" ]; then
            env -u ATHANOR_PULSE_QUOTA_RESUME bash -c "
                ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH='$CKPT' \
                ATHANOR_QUOTA_RESUME_MIRROR_PATH='$MIRROR' \
                ATHANOR_QUOTA_RESUME_QUEUE_DIR='$QUEUE' \
                ATHANOR_QUOTA_RESUME_PROJECT_PATH='$FAKEROOT' \
                bash '$SCRIPT'"
        else
            ATHANOR_PULSE_QUOTA_RESUME="$flagval" run_f4
        fi
        exit_code=$?
        set -e
        [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code with ATHANOR_PULSE_QUOTA_RESUME='$flagval' -- must exit 0, never break the Pulse cycle even when inert"; fail=1; }
        n="$(count_queue_files)"
        [ "$n" -eq 0 ] || { echo "FAIL: $n ticket(s) written to queue with ATHANOR_PULSE_QUOTA_RESUME='$flagval' -- the flag must make the script COMPLETELY inert regardless of how perfectly the other trigger conditions (fresh checkpoint, resets_at already passed) are satisfied"; fail=1; }
    done

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: flag_off_is_inert_even_with_perfect_trigger"
    ;;

  # --- Core functional case (doubles as at/after boundary) ---------------

  flag_on_fresh_checkpoint_reset_passed_enqueues_ticket)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -1   # resets_at 1s in the past -- boundary at/after

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code on the base positive case"; fail=1; }
    n="$(count_queue_files)"
    [ "$n" -eq 1 ] || { echo "FAIL: expected exactly 1 ticket in queue, found $n"; fail=1; }
    if [ "$n" -ge 1 ]; then
        ticket_file="$(find "$QUEUE" -maxdepth 1 -name '*.json' -type f | head -1)"
        schema_val="$(jq -r '.schema // empty' "$ticket_file")"
        requires_val="$(jq -r '.requires_model // empty' "$ticket_file")"
        [ "$schema_val" = "athanor.pulse.ticket/v1" ] || { echo "FAIL: enqueued ticket schema ('$schema_val') != athanor.pulse.ticket/v1 -- ticket must be produced by pulse_ticket.py, not hand-rolled"; fail=1; }
        [ "$requires_val" = "true" ] || { echo "FAIL: enqueued ticket requires_model ('$requires_val') != true -- a resume ticket must actually invoke a provider"; fail=1; }
    fi

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: flag_on_fresh_checkpoint_reset_passed_enqueues_ticket"
    ;;

  # --- Core safety #3: resets_at boundary, just-before -------------------

  boundary_resets_at_not_yet_passed_no_ticket)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 60   # resets_at 60s in the FUTURE

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code when resets_at is still in the future"; fail=1; }
    n="$(count_queue_files)"
    [ "$n" -eq 0 ] || { echo "FAIL: $n ticket(s) written even though resets_at has NOT passed yet -- must never dispatch before the quota window has actually reset"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: boundary_resets_at_not_yet_passed_no_ticket"
    ;;

  # --- Core safety #5: stale checkpoint from an old window ---------------

  stale_checkpoint_no_ticket)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    # Checkpoint is 7h old (> default 6h staleness bound); resets_at HAS
    # passed, so the only reason this must not fire is staleness.
    build_common_fixtures "$tmpdir" 25200 -60

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code on a stale checkpoint"; fail=1; }
    n="$(count_queue_files)"
    [ "$n" -eq 0 ] || { echo "FAIL: $n ticket(s) written from a checkpoint 7h old (older than the default 6h staleness bound) -- a stale checkpoint from an old, already-handled window must not trigger a resume"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: stale_checkpoint_no_ticket"
    ;;

  # --- Core safety #4: bounded / no repeat-dispatch loop ------------------

  dedupe_key_stable_across_repeated_ticks)
    # Proves F4's contribution to boundedness: the dedupe_key it derives from
    # a given checkpoint is IDENTICAL across repeated ticks against that same
    # checkpoint. The actual repeat-dispatch CAP is pulse_dispatcher.py's
    # existing dedupe_active/reserve_dedupe TTL mechanism (already covered by
    # mission harness-integrity-hardening F2) -- this assertion only has to
    # prove F4 does not defeat it by varying the key run to run (e.g. via a
    # random ticket id or a wall-clock-now timestamp in the key).
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code1=$?
    set -e
    [ "$exit_code1" -eq 0 ] || { echo "FAIL: first tick exited $exit_code1"; exit 1; }
    n1="$(count_queue_files)"
    [ "$n1" -ge 1 ] || { echo "FAIL: first tick produced no ticket to inspect"; exit 1; }
    first_ticket="$(find "$QUEUE" -maxdepth 1 -name '*.json' -type f | head -1)"
    key1="$(jq -r '.dedupe_key // empty' "$first_ticket")"
    [ -n "$key1" ] || { echo "FAIL: first ticket has no dedupe_key"; exit 1; }

    # Second tick, same checkpoint (same timestamp), same sandbox.
    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code2=$?
    set -e
    [ "$exit_code2" -eq 0 ] || { echo "FAIL: second tick exited $exit_code2"; exit 1; }

    fail=0
    for f in "$QUEUE"/*.json; do
        key="$(jq -r '.dedupe_key // empty' "$f")"
        [ "$key" = "$key1" ] || { echo "FAIL: ticket $f has dedupe_key '$key', expected '$key1' -- repeated ticks against the SAME checkpoint must derive the SAME dedupe_key so pulse_dispatcher.py's existing dedupe TTL can bound repeat dispatch; a varying key (e.g. from a random id or wall-clock-now) would let this loop indefinitely"; fail=1; }
    done

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: dedupe_key_stable_across_repeated_ticks"
    ;;

  # --- Core safety #2: existing budget/backoff caps still apply ----------

  budget_cap_still_applies_to_resume_ticket)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code=$?
    set -e
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code producing the ticket to feed into the dispatcher"; exit 1; }
    n="$(count_queue_files)"
    [ "$n" -ge 1 ] || { echo "FAIL: no ticket produced to test against the dispatcher's budget gate"; exit 1; }

    # Real pulse_dispatcher.py, real budget_block_reason -- forced exhausted
    # via ATHANOR_PULSE_DAILY_MAX_LAUNCHES=0, so the block fires BEFORE any
    # lease/provider_ready/launch_provider code path is ever reached (no
    # real provider subprocess risk).
    set +e
    out="$(ATHANOR_PULSE_DAILY_MAX_LAUNCHES=0 python3 execution/pulse_dispatcher.py --project-root "$FAKEROOT" --once --max-launches 5 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: pulse_dispatcher.py exited $exit_code"; echo "$out"; fail=1; }
    echo "$out" | grep -qi 'daily launch budget exhausted' \
        || { echo "FAIL: dispatcher did not report the resume ticket as budget-blocked -- output was:"; echo "$out"; fail=1; }
    n_after="$(count_queue_files)"
    [ "$n_after" -ge 1 ] || { echo "FAIL: resume ticket disappeared from the queue (was archived/launched) despite the daily launch budget being exhausted -- a resume must NOT bypass budget_block_reason"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: budget_cap_still_applies_to_resume_ticket"
    ;;

  provider_backoff_still_applies_to_resume_ticket)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4
    exit_code=$?
    set -e
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code producing the ticket"; exit 1; }
    n="$(count_queue_files)"
    [ "$n" -ge 1 ] || { echo "FAIL: no ticket produced to test against provider backoff"; exit 1; }

    # Pre-seed budget.json with an ACTIVE provider backoff for
    # claude-code+$FAKEROOT, matching pulse_dispatcher.py's own
    # budget_state_path/_backoff_key shape, so check_provider_backoff blocks
    # before any lease/launch code path.
    #
    # IMPORTANT: pulse_ticket.py:project_root() resolves the project path
    # (Path(...).expanduser().resolve()) before writing it into the ticket,
    # and pulse_dispatcher.py reads that RESOLVED path back out to build the
    # backoff lookup key. On macOS, mktemp -d returns a path under /var,
    # which is itself a symlink to /private/var, so the raw $FAKEROOT and
    # its resolved form differ -- a key seeded with the raw path would never
    # match the dispatcher's lookup key and the assertion would FAIL (because
    # the backoff would not block, the ticket would launch, and the check for
    # backoff-blocking would find it missing). Resolve here so the seeded key
    # matches production behavior on both macOS and Linux (where raw and
    # resolved are typically identical already).
    resolved_fakeroot="$(python3 -c "import sys; from pathlib import Path; print(Path(sys.argv[1]).resolve())" "$FAKEROOT")"
    state_dir="$FAKEROOT/.agent/pulse/dispatcher"
    mkdir -p "$state_dir"
    future_ts="$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
    today="$(date -u +%Y-%m-%d)"
    jq -n --arg d "$today" --arg key "claude-code:$resolved_fakeroot" --arg until "$future_ts" \
        '{date:$d, launches:0, tokens:0, last_launch_at:null, project_launches:{},
          provider_failures:{($key):3}, provider_backoff:{($key):$until}}' \
        > "$state_dir/budget.json"

    set +e
    out="$(python3 execution/pulse_dispatcher.py --project-root "$FAKEROOT" --once --max-launches 5 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: pulse_dispatcher.py exited $exit_code"; echo "$out"; fail=1; }
    echo "$out" | grep -qi 'backing off' \
        || { echo "FAIL: dispatcher did not report the resume ticket as backoff-blocked -- output was:"; echo "$out"; fail=1; }
    n_after="$(count_queue_files)"
    [ "$n_after" -ge 1 ] || { echo "FAIL: resume ticket disappeared from the queue despite active provider backoff -- a resume must NOT bypass check_provider_backoff"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: provider_backoff_still_applies_to_resume_ticket"
    ;;

  # --- Fail-safe direction ------------------------------------------------

  fail_safe_malformed_checkpoint_no_crash)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60
    printf 'not json at all' > "$CKPT"

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4 2>"$tmpdir/stderr"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code on a malformed checkpoint -- must degrade silently, never break the Pulse cycle"; fail=1; }
    n="$(count_queue_files)"
    [ "$n" -eq 0 ] || { echo "FAIL: $n ticket(s) written from a malformed checkpoint"; fail=1; }
    grep -qi traceback "$tmpdir/stderr" && { echo "FAIL: crash trace on malformed checkpoint"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: fail_safe_malformed_checkpoint_no_crash"
    ;;

  fail_safe_unknown_quota_state_no_crash)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    build_common_fixtures "$tmpdir" 0 -60
    # Mirror missing entirely -> quota.py returns state=unknown.
    rm -f "$MIRROR"

    set +e
    ATHANOR_PULSE_QUOTA_RESUME=1 run_f4 2>"$tmpdir/stderr"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: script exited $exit_code when the quota oracle reports state=unknown -- must degrade silently"; fail=1; }
    n="$(count_queue_files)"
    [ "$n" -eq 0 ] || { echo "FAIL: $n ticket(s) written despite an unknown quota signal -- an unreadable/degraded oracle must never be treated as 'the window has reset'"; fail=1; }
    grep -qi traceback "$tmpdir/stderr" && { echo "FAIL: crash trace on missing quota mirror"; fail=1; }

    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: fail_safe_unknown_quota_state_no_crash"
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: static_flag_env_var_gates_script, static_uses_quota_py_oracle, static_uses_pulse_ticket_enqueue, static_never_touches_service_lifecycle, flag_off_is_inert_even_with_perfect_trigger, flag_on_fresh_checkpoint_reset_passed_enqueues_ticket, boundary_resets_at_not_yet_passed_no_ticket, stale_checkpoint_no_ticket, dedupe_key_stable_across_repeated_ticks, budget_cap_still_applies_to_resume_ticket, provider_backoff_still_applies_to_resume_ticket, fail_safe_malformed_checkpoint_no_crash, fail_safe_unknown_quota_state_no_crash" >&2
    exit 1
    ;;
esac
