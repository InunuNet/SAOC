#!/usr/bin/env bash
# quota_resume.sh — Pulse registry job: durable resume monitor for the quota
# pause/resume window (mission quota-aware-pause-resume F2).
#
# launchd (via the EXISTING com.athanor.pulse service, through
# execution/pulse_runner.sh) owns this timer -- NOT ScheduleWakeup, which
# dies with the session and cannot carry a multi-hour quota wait, and no new
# daemon is added. pulse_runner.sh only iterates EXECUTABLE scripts in this
# registry directory, so this file must stay chmod +x or it is silently
# never run.
#
# Drives both halves of the resume monitor, in order:
#   1. execution/quota_resume_notice.sh  [default ON,  zero spend]
#   2. execution/pulse_quota_resume.sh   [default OFF, spends tokens]
# Each half owns its own default and its own inertness; this job is a thin
# driver only -- it adds no gating logic of its own, and its own failure or
# either half's failure must never break the Pulse cycle.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

bash "$PROJECT_ROOT/execution/quota_resume_notice.sh"
bash "$PROJECT_ROOT/execution/pulse_quota_resume.sh"

exit 0
