#!/usr/bin/env bash
# post_compact_inject.sh — RETIRED no-op.
# Post-compaction context restore now fires through the SessionStart(compact) hook,
# which calls post_compact_restore.sh and injects orchestrator context into the
# model's next request — deterministically and keypress-free.
# This UserPromptSubmit relay is no longer needed. Kept as a harmless no-op so the
# settings.json reference never errors; remove once the SessionStart path is proven.
set -uo pipefail
echo "{}"
exit 0
