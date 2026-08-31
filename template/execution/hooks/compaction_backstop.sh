#!/usr/bin/env bash
# compaction_backstop.sh — UserPromptSubmit hook
#
# Harness-owned backstop for the silent-gap failure mode found by the
# autocompact-inert mission: native auto-compaction is intermittent, not
# absent (see .agent/memory/project/specs/autocompact-inert/DECISIONS.md).
# When it misses, a session has been observed running unchecked to 61.9% of
# its window before a human ran /compact. This hook cannot cause a
# compaction — no hook event or tool can (DECISIONS.md Q1, established, not
# assumed). It can only inject an increasingly urgent instruction, on every
# turn a session sits above threshold, for the agent to run /compact itself.
# Wired alongside (not replacing) inject_pressure.sh and compaction_nudge.sh.
#
# Design (see DECISIONS.md + goldens/compaction_backstop_spec.md):
#   - Two tiers, purely by PERCENTAGE of the resolved window (never a raw
#     token count — that was inject_pressure.sh's HIGH_FIRES alarm-fatigue
#     bug; this hook must not repeat it).
#   - No persisted state. The decision is a pure function of the current
#     turn's last eligible transcript record, recomputed fresh every
#     UserPromptSubmit. This makes it idempotent and self-healing by
#     construction: once any compaction succeeds, the next reading drops
#     below threshold and the hook goes quiet on its own — no flag file, no
#     cache, no lock.
#   - Never silent on failure. `{}` is reserved for the one case where
#     silence is correct (below threshold, resolved, healthy). An
#     unresolvable window at dangerously high raw tokens, or an outright
#     internal failure, must say so out loud instead.
#
# Inputs (stdin JSON from Claude Code):
#   - transcript_path: path to current session transcript (JSONL)
#   - context_window.context_window_size: optional platform-stated window
# Reads (read-only): transcript_path only. Never writes to it, never mutates
# any repo file.
# Output (stdout JSON):
#   Silent:  {}
#   Non-silent: {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"<message>"}}
#
# Hard rules:
#   - ALWAYS exit 0 (never block a user turn)
#   - Read-only: no writes to the transcript, no persisted state of any kind
#   - All stderr suppressed; timeout python work at <= 4s
set +e
exec 2>/dev/null

# Named constants (see DECISIONS.md Q3/Q4 for the corpus evidence behind
# these numbers — never scatter them as literals below).
BACKSTOP_THRESHOLD=45      # pct, inclusive — Tier 1 begins here
ESCALATE_THRESHOLD=55      # pct, inclusive — Tier 2 begins here
UNRESOLVED_TOKEN_FLOOR=450000  # raw eligible tokens — Q4 unresolved-window floor

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
LIB="$SCRIPT_DIR/lib/context_window.py"

INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')

emit_silent() {
  printf '%s' '{}'
  exit 0
}

emit_message() {
  jq -nc --arg msg "$1" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' \
    || printf '%s' '{}'
  exit 0
}

# Failure fallback (Q4, guarantee 2): any internal failure — missing/unreadable
# transcript, missing lib module, non-zero/empty python output — must still
# exit 0 and say so attributably. Never {} on an actual failure; {} is
# reserved for decision 4's genuinely-healthy silence.
fail_fallback() {
  emit_message "compaction_backstop: context pressure could not be computed this turn (internal error) — if the session feels heavy, consider running /compact manually."
}

# -r as well as -f: an existing regular file we cannot READ is a failure, not
# a healthy empty session (Q4 guarantee 2). `[ -f ]` alone tests file type
# only, so a chmod-000 transcript would otherwise reach python and come back
# indistinguishable from "nothing logged yet".
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ] || [ ! -r "$TRANSCRIPT" ]; then
  fail_fallback
fi

if [ ! -f "$LIB" ]; then
  fail_fallback
fi

# Payload goes to the module over stdin ("-"), never through a temp file.
# A shared /tmp path is not concurrency-safe — this machine routinely runs a
# dozen sessions at once, and every one of them fires this hook on every
# prompt — and a temp file would also contradict this hook's own no-persisted-
# state design. Mirrors how inject_pressure.sh feeds its own python over stdin.
_OUT=$(printf '%s' "$INPUT" | timeout 4 python3 "$LIB" - "$TRANSCRIPT")
_RC=$?

if [ $_RC -ne 0 ] || [ -z "$_OUT" ]; then
  fail_fallback
fi

# Wire format from context_window.py: state|tokens|pct|window|model
STATE="${_OUT%%|*}"
_REST="${_OUT#*|}"
TOKENS="${_REST%%|*}"
_REST="${_REST#*|}"
PCT="${_REST%%|*}"
_REST="${_REST#*|}"
WINDOW="${_REST%%|*}"
MODEL="${_REST#*|}"

[ -z "$STATE" ] && fail_fallback

case "$STATE" in
  resolved|exceeded)
    if [[ "$PCT" =~ ^[0-9]+$ ]]; then
      if [ "$PCT" -ge "$ESCALATE_THRESHOLD" ]; then
        emit_message "⚡ CONTEXT PRESSURE ${PCT}% of ${WINDOW} — WRAP UP: this is past the worst native auto-compact miss ever observed in this harness; run /compact now."
      elif [ "$PCT" -ge "$BACKSTOP_THRESHOLD" ]; then
        emit_message "context pressure is ${PCT}% of ${WINDOW}, above the native auto-compact's observed operating range — if this session hasn't compacted yet, run /compact now."
      else
        emit_silent
      fi
    else
      fail_fallback
    fi
    ;;
  unresolved|nodata)
    if [[ "$TOKENS" =~ ^[0-9]+$ ]] && [ "$TOKENS" -ge "$UNRESOLVED_TOKEN_FLOOR" ]; then
      emit_message "context pressure cannot be verified — the context window could not be resolved for model '${MODEL}', but raw usage is already ${TOKENS} tokens. Check manually / consider /compact."
    else
      emit_silent
    fi
    ;;
  *)
    fail_fallback
    ;;
esac

exit 0
