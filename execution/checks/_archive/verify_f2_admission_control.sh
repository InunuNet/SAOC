#!/usr/bin/env bash
# verify_f2_admission_control.sh -- sandboxed behavioral + static scenarios for
# mission quota-aware-execution F2 (admission control in mission.py).
#
# Defect under test: mission.py's cmd_checkpoint() and cmd_resume() have zero
# awareness of F1's quota oracle (execution/quota.py). Today they will
# happily transition a feature pending -> in_progress (checkpoint), or
# suggest dispatching @architect for a fresh feature (resume), even when
# the remaining 5-hour quota window cannot possibly finish it -- exactly
# the failure mode that stranded half-done features overnight 2026-08-05/06.
#
# Fix shape (design only -- @dev implements): a shared admission-check
# helper in mission.py calls `execution/quota.py status --json`, fails OPEN
# (allows) on any degrade -- state=="unknown", quota.py missing, quota.py
# crashing, malformed JSON -- and only BLOCKS when state=="ok" AND
# used_pct >= ATHANOR_QUOTA_ADMISSION_THRESHOLD (default 85). It gates
# exactly the same transition mission.py already special-cases at
# mission.py:475 (`new_status == "in_progress" and not
# feature.get("started_at")`) -- i.e. STARTING a feature that has never
# been started before, never a feature already in flight, never
# close-out/gate/pause/abandon/skip. `--ignore-quota` on checkpoint/resume
# is the operator override; ATHANOR_QUOTA_MIRROR_PATH (test-only, forwarded
# to quota.py's --mirror-path) and ATHANOR_QUOTA_ADMISSION_THRESHOLD are the
# testability/tuning seams.
#
# Drives the REAL execution/mission.py and execution/quota.py from repo
# root against throwaway mission fixtures and throwaway quota mirror
# fixtures in a mktemp sandbox. Never touches
# .agent/memory/project/missions/, active.json, or the real project quota
# mirror (.agent/memory/scratch/.quota_status.json) -- ATHANOR_QUOTA_MIRROR_PATH
# always points at a sandboxed fixture file, never the real one. Never
# commits, never pushes.
#
# Errexit-trap safety: every capture of an expected-to-fail command is
# wrapped in `set +e` / capture / `set -e` per docs/VALIDATION_CONTRACTS.md
# (an earlier mission produced a false negative from this exact mistake).
#
# Usage: verify_f2_admission_control.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"

# write_mirror PATH USED_PCT -- writes a fresh, well-formed quota mirror
# fixture with captured_at set to "now" so it never trips F1's staleness
# threshold (900s).
write_mirror() {
    local path="$1" used_pct="$2"
    local now resets
    now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    resets="$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)"
    cat > "$path" <<JSON
{"used_pct": ${used_pct}, "resets_at": "${resets}", "seconds_to_reset": 3600.0, "captured_at": "${now}"}
JSON
}

# feat_status FILE -- extract feature F1's status field specifically (not the
# mission-level `status:` field, nor the milestone's `status:` field). Parses
# the YAML frontmatter with PyYAML rather than text-matching indentation --
# a text-based match tied to one specific indent depth silently breaks the
# moment the emitter's indent style differs from the fixture's (exactly what
# happened here: write_mission() below emits `  - id: F1` at 2-space indent,
# but mission.py's own PyYAML dumper re-emits list items at 0-indent after a
# rewrite -- an awk pattern anchored to only one of those shapes returns ""
# on the other, which made assertions against the *unwritten* (still
# 2-indent) path structurally unable to ever observe "pending").
feat_status() {
    python3 -c "
import sys, yaml
with open(sys.argv[1]) as f:
    text = f.read()
_, fm, _ = text.split('---', 2)
data = yaml.safe_load(fm)
for feat in data.get('features', []):
    if feat.get('id') == 'F1':
        print(feat.get('status', ''))
        break
" "$1"
}

# write_mission PATH F1_STATUS F1_STARTED_AT -- single-feature, single-milestone
# sandbox mission. F1_STARTED_AT "yes" marks the feature as already in-flight
# (started_at populated); "no" leaves it null (never started).
write_mission() {
    local path="$1" f1status="$2" started="$3"
    local started_field="null"
    if [ "$started" = "yes" ]; then
        started_field="'2026-08-06T00:00:00+00:00'"
    fi
    cat > "$path" <<YAML
---
schema: athanor.mission/v1
slug: f2-admission-sandbox
goal: sandbox test mission for verify_f2_admission_control.sh
created_at: '2026-08-06T00:00:00+00:00'
status: in_progress
features:
  - id: F1
    title: Feature one
    status: ${f1status}
    agent: dev
    spec: null
    inline_brief: test
    contract: null
    started_at: ${started_field}
    completed_at: null
    handoff: null
    notes: ''
milestones:
  - id: M1
    name: First milestone
    features: [F1]
    status: pending
    gate_ran_at: null
    gate_result: null
    rationale: test
---

# F2 Admission Sandbox
YAML
}

case "$CASE" in

  static_fail_open_shape)
    body="$(awk '/^def _quota_admission_check\(/{p=1} p && /^def [a-zA-Z_]+\(/ && !/^def _quota_admission_check\(/{p=0} p' execution/mission.py)"
    fail=0
    [ -n "$body" ] || { echo "FAIL: no _quota_admission_check() function found in execution/mission.py"; fail=1; }
    echo "$body" | grep -q 'except' || { echo "FAIL: admission helper does not wrap the quota.py subprocess call in try/except (must fail open on crash/missing)"; fail=1; }
    echo "$body" | grep -Fq '"ok"' || { echo "FAIL: admission helper does not gate on state == \"ok\" (must fail open on unknown)"; fail=1; }
    if [ "$fail" -eq 1 ]; then
        echo "--- extracted _quota_admission_check() body ---"
        echo "$body"
        exit 1
    fi
    echo "PASS: static_fail_open_shape"
    ;;

  checkpoint_blocks_new_start_at_high_quota)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    write_mission "$mission" pending no
    write_mirror "$mirror" 95

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py checkpoint "$mission" --feature F1 --status in_progress 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -ne 0 ] || { echo "FAIL: checkpoint exited 0 at 95% used (>=85% default threshold); expected a nonzero refusal"; fail=1; }
    [ "$(feat_status "$mission")" = "pending" ] || { echo "FAIL: feature F1 status changed (expected to stay pending) after blocked checkpoint"; fail=1; }
    echo "$out" | grep -qi 'quota' || { echo "FAIL: refusal output does not mention quota"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- mission after checkpoint ---"; cat "$mission"
        echo "--- checkpoint output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: checkpoint_blocks_new_start_at_high_quota"
    ;;

  checkpoint_allows_new_start_when_quota_unknown)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/does_not_exist.json"
    write_mission "$mission" pending no

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py checkpoint "$mission" --feature F1 --status in_progress 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: checkpoint exited $exit_code with an unreadable (missing) quota mirror; must fail OPEN and allow"; fail=1; }
    [ "$(feat_status "$mission")" = "in_progress" ] || { echo "FAIL: feature status not advanced to in_progress despite fail-open expectation"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- mission after checkpoint ---"; cat "$mission"
        echo "--- checkpoint output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: checkpoint_allows_new_start_when_quota_unknown"
    ;;

  checkpoint_never_blocks_inflight_work)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    # F1 is already in_progress with started_at set -- i.e. already in flight.
    write_mission "$mission" in_progress yes
    write_mirror "$mirror" 99

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py checkpoint "$mission" --feature F1 --status done 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: checkpoint to 'done' on an already-in-flight feature was blocked at 99% used quota; finishing in-flight work must never be gated"; fail=1; }
    [ "$(feat_status "$mission")" = "done" ] || { echo "FAIL: feature status was not advanced to done"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- mission after checkpoint ---"; cat "$mission"
        echo "--- checkpoint output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: checkpoint_never_blocks_inflight_work"
    ;;

  static_close_out_never_gated)
    body="$(awk '/^def cmd_close_out\(/{p=1} p && /^def [a-zA-Z_]+\(/ && !/^def cmd_close_out\(/{p=0} p' execution/mission.py)"
    fail=0
    [ -n "$body" ] || { echo "FAIL: no cmd_close_out() function found in execution/mission.py"; fail=1; }
    echo "$body" | grep -q '_quota_admission_check' && { echo "FAIL: cmd_close_out() calls the admission check -- close-out/wrap-up must NEVER be gated by quota"; fail=1; }
    if [ "$fail" -eq 1 ]; then
        echo "--- extracted cmd_close_out() body ---"
        echo "$body"
        exit 1
    fi
    echo "PASS: static_close_out_never_gated"
    ;;

  checkpoint_ignore_quota_override_bypasses_block)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    write_mission "$mission" pending no
    write_mirror "$mirror" 95

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py checkpoint "$mission" --feature F1 --status in_progress --ignore-quota 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: checkpoint --ignore-quota exited $exit_code at 95% used; operator override must always work"; fail=1; }
    [ "$(feat_status "$mission")" = "in_progress" ] || { echo "FAIL: --ignore-quota did not allow the feature to start"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- mission after checkpoint ---"; cat "$mission"
        echo "--- checkpoint output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: checkpoint_ignore_quota_override_bypasses_block"
    ;;

  threshold_is_env_overridable)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    write_mission "$mission" pending no
    write_mirror "$mirror" 42

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" ATHANOR_QUOTA_ADMISSION_THRESHOLD=10 python3 execution/mission.py checkpoint "$mission" --feature F1 --status in_progress 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -ne 0 ] || { echo "FAIL: checkpoint exited 0 at 42% used with ATHANOR_QUOTA_ADMISSION_THRESHOLD=10; a lowered threshold must be honored"; fail=1; }
    [ "$(feat_status "$mission")" = "pending" ] || { echo "FAIL: feature advanced past pending despite the overridden low threshold"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- mission after checkpoint ---"; cat "$mission"
        echo "--- checkpoint output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: threshold_is_env_overridable"
    ;;

  resume_blocks_new_feature_suggestion_at_high_quota)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    write_mission "$mission" pending no
    write_mirror "$mirror" 90

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py resume "$mission" 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -ne 0 ] || { echo "FAIL: resume exited 0 while suggesting a brand-new feature start at 90% used quota"; fail=1; }
    echo "$out" | grep -qi 'RESUME: run /spec\|RESUME: dispatch @dev' && { echo "FAIL: resume still emitted a new-feature dispatch suggestion at 90% used quota"; fail=1; }
    echo "$out" | grep -qi 'quota' || { echo "FAIL: resume's refusal output does not mention quota"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- resume output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: resume_blocks_new_feature_suggestion_at_high_quota"
    ;;

  resume_never_blocks_gate_only_next_action)
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' EXIT
    mission="$tmpdir/mission.md"
    mirror="$tmpdir/mirror.json"
    # F1 already done -- the only remaining next-action is running the
    # milestone gate, not starting new work. Must never be blocked by quota.
    write_mission "$mission" done yes
    write_mirror "$mirror" 99

    set +e
    out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" python3 execution/mission.py resume "$mission" 2>&1)"
    exit_code=$?
    set -e

    fail=0
    [ "$exit_code" -eq 0 ] || { echo "FAIL: resume exited $exit_code suggesting the milestone gate at 99% used quota; finishing/gating must never be blocked"; fail=1; }
    echo "$out" | grep -qi 'gate' || { echo "FAIL: resume did not suggest running the milestone gate"; fail=1; }

    if [ "$fail" -eq 1 ]; then
        echo "--- resume output ---"; echo "$out"
        exit 1
    fi
    echo "PASS: resume_never_blocks_gate_only_next_action"
    ;;

  threshold_garbage_env_fails_open)
    # A garbage/malformed ATHANOR_QUOTA_ADMISSION_THRESHOLD must never crash
    # the admission check into a fail-CLOSED traceback -- it must fail OPEN
    # (allow) exactly like any other degraded quota signal. Uses a
    # well-formed, state="ok" mirror (used_pct below the numeric default of
    # 85) so the code path actually reaches _quota_admission_threshold();
    # a missing/unknown mirror would fail open before ever touching the
    # threshold parse and so would not exercise this defect.
    for bad_val in "abc" "" "   " "85x"; do
        tmpdir="$(mktemp -d)"
        mission="$tmpdir/mission.md"
        mirror="$tmpdir/mirror.json"
        write_mission "$mission" pending no
        write_mirror "$mirror" 10

        set +e
        out="$(ATHANOR_QUOTA_MIRROR_PATH="$mirror" ATHANOR_QUOTA_ADMISSION_THRESHOLD="$bad_val" python3 execution/mission.py checkpoint "$mission" --feature F1 --status in_progress 2>&1)"
        exit_code=$?
        set -e

        fail=0
        [ "$exit_code" -eq 0 ] || { echo "FAIL: checkpoint exited $exit_code with ATHANOR_QUOTA_ADMISSION_THRESHOLD='$bad_val'; a malformed threshold must fail OPEN, not crash"; fail=1; }
        echo "$out" | grep -qi 'Traceback' && { echo "FAIL: checkpoint printed a Python traceback to stderr with ATHANOR_QUOTA_ADMISSION_THRESHOLD='$bad_val'; malformed threshold must not crash the process"; fail=1; }
        [ "$(feat_status "$mission")" = "in_progress" ] || { echo "FAIL: feature F1 did not advance to in_progress with ATHANOR_QUOTA_ADMISSION_THRESHOLD='$bad_val' (fail-open must genuinely allow the start, not merely avoid a nonzero exit)"; fail=1; }

        if [ "$fail" -eq 1 ]; then
            echo "--- ATHANOR_QUOTA_ADMISSION_THRESHOLD='$bad_val' ---"
            echo "--- mission after checkpoint ---"; cat "$mission"
            echo "--- checkpoint output ---"; echo "$out"
            rm -rf "$tmpdir"
            exit 1
        fi
        rm -rf "$tmpdir"
    done
    echo "PASS: threshold_garbage_env_fails_open"
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: static_fail_open_shape, checkpoint_blocks_new_start_at_high_quota, checkpoint_allows_new_start_when_quota_unknown, checkpoint_never_blocks_inflight_work, static_close_out_never_gated, checkpoint_ignore_quota_override_bypasses_block, threshold_is_env_overridable, resume_blocks_new_feature_suggestion_at_high_quota, resume_never_blocks_gate_only_next_action, threshold_garbage_env_fails_open" >&2
    exit 1
    ;;
esac
