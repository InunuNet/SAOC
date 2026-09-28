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
# Design (see DECISIONS.md + docs/harness/compaction-backstop.md):
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
#
# Known limitation (accepted, not fixed here): invoking this hook with file
# descriptor 0 closed hangs indefinitely on `INPUT=$(cat)` below. This is the
# classic bash command-substitution hazard (with fd 0 closed, the shell
# reassigns the substitution's own pipe to the lowest free descriptor and
# `cat` deadlocks reading it) — it reproduces identically in inject_pressure.sh
# and in a bare `bash -c 'X=$(cat)' <&-`, and no cheap fix exists that doesn't
# risk swallowing legitimate stdin content. Claude Code always supplies stdin
# in production, and the outer hook timeout in .claude/settings.json bounds
# it regardless. See docs/harness/compaction-backstop.md "Known limitations".
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
  local msg="$1"
  local json
  json=$(jq -nc --arg msg "$msg" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' 2>/dev/null)
  if [ -n "$json" ]; then
    printf '%s' "$json"
  else
    # jq itself failed -- never fall back to {} here, that would silently
    # suppress a real warning at exactly the moment it matters most, and
    # never fall back to plain text either: Claude Code only injects
    # hookSpecificOutput.additionalContext from a valid JSON envelope, so
    # plain text is exactly as silent to the agent as {}. This script
    # already hard-depends on python3 (it pipes to lib/context_window.py),
    # so use json.dumps for correct escaping instead of a hand-rolled
    # splice -- $msg embeds ${MODEL}, which is transcript-derived and can
    # contain control characters (newline/tab) or a mix of quote and
    # backslash, none of which a two-substitution hand escape covers.
    local escaped_json
    escaped_json=$(timeout 4 python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$msg" 2>/dev/null)
    if [ -n "$escaped_json" ]; then
      printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s}}' "$escaped_json"
    else
      # python3 itself failed -- unreachable in practice (see above), but
      # never emit invalid JSON: fall back to a fixed, non-interpolated
      # literal that cannot be broken by any input.
      printf '%s' '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"compaction_backstop: warning could not be formatted"}}'
    fi
  fi
  exit 0
}

# Failure fallback (Q4, guarantee 2): any internal failure — missing/unreadable
# transcript, missing lib module, non-zero/empty python output — must still
# exit 0 and say so attributably. Never {} on an actual failure; {} is
# reserved for decision 4's genuinely-healthy silence.
fail_fallback() {
  emit_message "compaction_backstop: context pressure could not be computed this turn (internal error) — if the session feels heavy, consider running /compact manually."
}

# num_ge: $1 >= $2, both already validated by the caller as ^[0-9]+$.
# Uses python3 (already a hard dependency below) instead of bash's native
# `-ge` arithmetic comparison, which throws "integer expected" and falls
# through toward silence on a number too large for it to hold (e.g. a
# 68-digit numeric string in a corrupted or adversarial transcript) — the
# same silent-on-failure bug this whole hook exists to prevent, via a
# different trigger. python's int() has no size limit, so this cannot
# overflow. On the (should-be-unreachable) chance this call itself errors
# or times out, return failure so the caller routes to fail_fallback —
# fail-safe-toward-warning, never fail-safe-toward-silent.
num_ge() {
  timeout 1 python3 -c '
import sys
try:
    a = int(sys.argv[1])
    b = int(sys.argv[2])
except Exception:
    sys.exit(2)
sys.exit(0 if a >= b else 1)
' "$1" "$2" 2>/dev/null
  local rc=$?
  # timeout(1) reports its own 124 on expiry; normalise every non-0/1
  # outcome (124 included) to 2 so callers can tell "false" from "error".
  if [ "$rc" != 0 ] && [ "$rc" != 1 ]; then
    return 2
  fi
  return "$rc"
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
      num_ge "$PCT" "$ESCALATE_THRESHOLD"; _RC_ESCALATE=$?
      if [ "$_RC_ESCALATE" -eq 0 ]; then
        emit_message "⚡ CONTEXT PRESSURE ${PCT}% of ${WINDOW} — WRAP UP: this is past the worst native auto-compact miss ever observed in this harness; run /compact now."
      elif [ "$_RC_ESCALATE" -eq 2 ]; then
        fail_fallback
      else
        num_ge "$PCT" "$BACKSTOP_THRESHOLD"; _RC_BACKSTOP=$?
        if [ "$_RC_BACKSTOP" -eq 0 ]; then
          emit_message "context pressure is ${PCT}% of ${WINDOW}, above the native auto-compact's observed operating range — if this session hasn't compacted yet, run /compact now."
        elif [ "$_RC_BACKSTOP" -eq 2 ]; then
          fail_fallback
        else
          emit_silent
        fi
      fi
    else
      fail_fallback
    fi
    ;;
  unresolved|nodata)
    if [[ "$TOKENS" =~ ^[0-9]+$ ]]; then
      num_ge "$TOKENS" "$UNRESOLVED_TOKEN_FLOOR"; _RC_FLOOR=$?
      if [ "$_RC_FLOOR" -eq 0 ]; then
        emit_message "context pressure cannot be verified — the context window could not be resolved for model '${MODEL}', but raw usage is already ${TOKENS} tokens. Check manually / consider /compact."
      elif [ "$_RC_FLOOR" -eq 2 ]; then
        fail_fallback
      else
        emit_silent
      fi
    else
      emit_silent
    fi
    ;;
  *)
    fail_fallback
    ;;
esac

exit 0
