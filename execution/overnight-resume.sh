#!/bin/bash
# One-shot overnight resume launcher.
#
# Created 2026-08-11 at Brad's request: "if we run out of quota, make sure you've got a
# relaunch continue mechanism in place to pick up at 10 to 3 a.m."
#
# This is a ONE-SHOT, not a standing autonomous routine — the backlog records that permanent
# nightly autonomy was retired 2026-07-28. The crontab entry that invokes this script removes
# itself on first run (see self-eviction at the bottom).
#
# Safety: refuses to start if another Claude Code process is already working in this repo,
# so it cannot collide with a session that survived the night.

set -uo pipefail

REPO="/Users/vetus/ai/SAOC"
LOCK="$REPO/.agent/overnight-resume.lock"
LOG_DIR="$REPO/.agent/memory/scratch"
LOG="$LOG_DIR/overnight-resume-$(date +%Y%m%d-%H%M).log"

cd "$REPO" || exit 1
mkdir -p "$LOG_DIR"

# Refuse to double-run: another claude process already active in this repo.
if pgrep -f "claude" >/dev/null 2>&1; then
  echo "$(date -u +%FT%TZ) SKIP: a claude process is already running; not launching a second." >> "$LOG"
  exit 0
fi

# Refuse to double-run: a prior invocation is still holding the lock.
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date -u +%FT%TZ) SKIP: lock held at $LOCK" >> "$LOG"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

echo "$(date -u +%FT%TZ) START overnight resume" >> "$LOG"

read -r -d '' RESUME_PROMPT <<'PROMPT'
Overnight autonomous resume. Brad is asleep — do not block on questions, and do not wait for
confirmation between chain steps. Log anything that genuinely needs a human decision to
.agent/memory/project/needs-human.md and keep working.

FIRST: read .agent/memory/project/reboot.md in full. It is the authoritative handover and names
every in-flight stream, its contract path, and its next step. Then run
`python3 execution/mission.py resume`.

Three parallel workstreams were in flight when the previous session ended:
  Stream A — ticketing security hardening, contracts/contract-ticketing-hardening.yaml
  Stream B — mission show-visitor-info, contracts/contract-show-visitor-info.yaml
  Stream C — CMS wiring cleanup, contracts/contract-cms-wiring-cleanup.yaml
  Stream D — mission show-exhibitor-info, queued behind B.

For each stream, VERIFY STATE ON DISK before continuing it — does the contract exist, do the
check scripts exist, has @dev run, does the gate actually pass. Do not trust any agent's claim of
completion; this project has a documented history of agents reporting green against assertions
that could not go red. Then continue the chain from wherever the stream actually is:
@architect -> @dev -> @qa -> @docs -> contract gate -> @maintainer -> commit.

Hard constraints: dev server is on port 3333, not 3000. Assert behaviour over real HTTP
round-trips, never source greps, for anything security- or money-relevant. Never modify
app/api/tickets/itn/route.ts. Never print or log secret values. Seed create-if-absent only, never
createOrReplace. No new brand assets, colours or fonts. Do not deploy and do not touch DNS.

Finish by committing completed work and running the @maintainer wrap-up.
PROMPT

claude -p "$RESUME_PROMPT" \
  --permission-mode acceptEdits \
  >> "$LOG" 2>&1

echo "$(date -u +%FT%TZ) END overnight resume (exit $?)" >> "$LOG"

# Self-evict: strip this job from the crontab so it never fires a second night.
crontab -l 2>/dev/null | grep -v 'overnight-resume.sh' | crontab - 2>/dev/null
echo "$(date -u +%FT%TZ) crontab entry removed (one-shot)" >> "$LOG"
