#!/usr/bin/env bash
# Pulse job: autonomous mission loop for Athanor (Claude Code platform)
# Runs every Pulse cycle (~5 min). Resumes active mission or starts next from backlog.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/vetus"
cd /Users/vetus/ai/Athanor
bash execution/pulse_mission_loop.sh --platform claude 2>&1
