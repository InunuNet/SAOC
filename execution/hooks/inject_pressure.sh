#!/usr/bin/env bash
# inject_pressure.sh — UserPromptSubmit hook
# Injects [context: X% (used, not remaining) | quota used: Y% (not remaining) | refresh: Zh] into every user turn so the
# agent can self-throttle without human intervention.
#
# Inputs (stdin JSON from Claude Code):
#   - transcript_path: path to current session transcript (JSONL)
# Reads (read-only):
#   - transcript_path → last assistant usage block for context %
#   - ~/.claude/MEMORY/STATE/usage-cache.json → quota % + refresh window
# Output (stdout JSON):
#   {"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[context: X% (used, not remaining) | quota used: Y% (not remaining) | refresh: Zh]"}}
#
# Hard rules:
#   - ALWAYS exit 0 (never block a user turn)
#   - Gracefully degrade to "?" when any data source is unavailable
#   - All stderr suppressed; timeout python work at <= 4s
set +e
exec 2>/dev/null

# --- Read hook input from stdin ---
INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')

# --- Context tokens + window resolution from transcript ---
# Resolution order (see goldens/window_resolution_spec.md): ATHANOR_CONTEXT_WINDOW env
# > .context_window.context_window_size on stdin > documented single-configuration
# windows (published fact, observed_max-backstopped) > candidate table narrowed by what
# the session has been OBSERVED holding > unresolved ("?", never a guessed number).
CTX_STATE="nodata"
CTX_TOKENS="0"
CTX_PCT="?"
CTX_WIN="?"
CTX_MODEL="?"
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  _PY=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  _STDIN_JSON=$(mktemp /tmp/athanor_hook.XXXXXX.json)
  printf '%s' "$INPUT" > "$_STDIN_JSON"
  cat > "$_PY" <<'PYEOF'
import json, os, re, sys

USAGE_FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
MIN_WINDOW = 1000  # no model ships a window this small; anything below is garbage input

# DOCUMENTED windows (spec 2a-doc, rank 3): single-configuration models only.
# Published fact, not inference -- every entry MUST carry a provenance citation
# comment containing `verified YYYY-MM-DD` (machine-checked, A26). Matching is
# EXACT, never prefix: the family id itself, or the family id + a dated suffix
# (-YYYYMMDD), inherits; a `[1m]` variant marker or a different model number
# falls through -- rank 3 asserts fact and must not extend it to identifiers
# nobody documented. Three anti-decay rules: (1) NO default -- a model absent
# here gets nothing and falls through to the candidate table, then to '?';
# (2) ambiguous families (opus-5, sonnet-5 -- shipped in >1 configuration) are
# FORBIDDEN here; (3) the observed_max backstop renders a documented window the
# session has observed past as exceeded ('% of >{win}'), never as a plain
# denominator. Promotion requires a statement that the smaller configuration
# does NOT exist -- a bare "1M" table row is insufficient (the same table gives
# 1M to opus-5/sonnet-5, which ship dual configs behind identical strings).
DOCUMENTED = [
    ("claude-haiku-4-5", 200_000),  # Anthropic model table, 200K, verified 2026-08-30
    ("claude-fable-5", 1_000_000),  # Anthropic model table: 1M, "the maximum is also the default" (explicit single-config statement); corpus-corroborated (peak 330,559 observed refutes 200k; compactions cluster ~33% of 1M), verified 2026-08-30
]

# Candidate windows per model family (spec 2a, rank 4), keyed by longest-prefix
# match on the lowercased model string. Reserved for families that are genuinely
# AMBIGUOUS -- shipped in more than one configuration the model string cannot
# distinguish. EVERY family carries >= 2 candidates -- a singleton is
# unfalsifiable (narrowing can only refute a candidate that is too SMALL;
# nothing can refute one that is too LARGE), so a too-large singleton would
# under-report silently, exactly this mission's original defect relocated into
# the table. And every candidate must be a REAL shipped configuration with a
# documented or observed basis -- never a hedge, margin, or inference (a phantom
# candidate can never be selected correctly; it can only withhold answers).
# Single-configuration facts go in DOCUMENTED with a citation, not here.
CANDIDATES = [
    ("claude-opus-5", {200_000, 1_000_000}),
    ("claude-sonnet-5", {200_000, 1_000_000}),
    ("claude-opus-4-8", {200_000, 1_000_000}),
    ("claude-opus-4-7", {200_000, 1_000_000}),
]


def to_int(v):
    try:
        return max(0, int(v))
    except Exception:
        return 0


def candidates_for(model):
    model = (model or "").lower()
    best = None
    for prefix, cands in CANDIDATES:
        if model.startswith(prefix) and (best is None or len(prefix) > len(best[0])):
            best = (prefix, cands)
    return best[1] if best else set()


def documented_for(model):
    """Rank 3: a documented single-configuration window, or None. No default --
    absence yields nothing and the caller falls through to the candidate table.

    Matching is EXACT (spec 2a-doc), unlike the candidate table's deliberate
    prefix matching: the family id, or the family id + dated suffix (-YYYYMMDD),
    inherits; anything else -- notably a `[1m]` variant marker, the exact marker
    Claude Code uses for a DIFFERENT window configuration -- falls through."""
    model = (model or "").lower()
    for family, win in DOCUMENTED:
        if model == family or re.fullmatch(re.escape(family) + r"-[0-9]{8}", model):
            return win
    return None


def fmt_window(w):
    if w % 1_000_000 == 0:
        return f"{w // 1_000_000}M"
    return f"{w // 1000}k"


def valid_window_from_env(raw):
    """Rank 1 (env var, always a string). Integer >= MIN_WINDOW, else reject."""
    if raw is None:
        return None
    raw = raw.strip()
    if not raw:
        return None
    try:
        v = int(raw)
    except Exception:
        return None
    return v if v >= MIN_WINDOW else None


def valid_window_from_stdin(v):
    """Rank 2 (stdin JSON). Must already be an int type (bool excluded, floats
    and strings rejected rather than truncated/coerced), >= MIN_WINDOW."""
    if isinstance(v, bool) or not isinstance(v, int):
        return None
    return v if v >= MIN_WINDOW else None


def stdin_window(payload):
    cw = payload.get("context_window")
    if not isinstance(cw, dict):
        return None
    return valid_window_from_stdin(cw.get("context_window_size"))


def is_eligible(rec, msg, usage):
    """Section 1a: skip synthetic error records (API error, 529, session-limit,
    expired-login) for both the reading and the evidence -- never let one
    reset either."""
    if not isinstance(usage, dict):
        return False
    if (msg.get("model") or "") == "<synthetic>":
        return False
    if rec.get("isApiErrorMessage") is True:
        return False
    return sum(to_int(usage.get(f)) for f in USAGE_FIELDS) > 0


stdin_payload_path = sys.argv[1] if len(sys.argv) > 1 else None
payload = {}
if stdin_payload_path:
    try:
        loaded = json.loads(open(stdin_payload_path).read())
        if isinstance(loaded, dict):
            payload = loaded
    except Exception:
        payload = {}

# Whole-file scan for EVIDENCE (section 0): a turn that happened cannot
# un-happen, so evidence is never allowed to scroll out of view -- that is
# what makes resolution monotone as the session grows. The CURRENT reading
# (total, model) still comes from the last eligible record only. Cheap
# substring prefilter keeps this well inside the 4s budget even on huge
# transcripts (measured: 0.63s/122MB with it, 0.81s without).
# Iterate the BYTE stream and decode per line (section 1a, QA D9): a strict
# text-mode decode over the stream raises UnicodeDecodeError outside any
# per-line handling, so ONE invalid byte anywhere in the file would destroy
# the entire reading. Contained here, a corrupt line costs at most itself --
# skipped exactly like a line that is not valid JSON.
eligible = []  # [(model, total), ...] in file order
for raw in sys.stdin.buffer:
    if b'"usage"' not in raw:
        continue
    try:
        line = raw.decode("utf-8").strip()
    except Exception:
        continue
    if not line:
        continue
    try:
        rec = json.loads(line)
    except Exception:
        continue
    if not isinstance(rec, dict):
        continue
    msg = rec.get("message")
    if not isinstance(msg, dict):
        continue
    usage = msg.get("usage")
    if not is_eligible(rec, msg, usage):
        continue
    total = sum(to_int(usage.get(f)) for f in USAGE_FIELDS)
    eligible.append((msg.get("model") or "", total))

if not eligible:
    print("nodata|0|?|?|?")
    sys.exit(0)

last_model, total = eligible[-1]
model = last_model or "?"
# Evidence is restricted to the last eligible record's model, so a
# mid-session /model switch cannot contaminate the denominator.
observed_max = max(t for m, t in eligible if m == last_model)

# Rank 1: explicit operator override. Rank 2: the platform's own stated window.
window = valid_window_from_env(os.environ.get("ATHANOR_CONTEXT_WINDOW"))
if window is None:
    window = stdin_window(payload)

if window is not None:
    pct = round(100 * total / window)
    print(f"resolved|{total}|{pct}|{fmt_window(window)}|{model}")
    sys.exit(0)

# Rank 3: documented single-configuration windows -- published fact, no
# evidence needed. The observed_max backstop keeps every entry falsifiable in
# the direction that hides pressure: a documented window the session has
# observed PAST is refuted by data and rendered as exceeded ('% of >{win}'),
# never as a plain denominator the data disproved.
doc_window = documented_for(last_model)
if doc_window is not None:
    pct = round(100 * total / doc_window)
    state = "exceeded" if observed_max > doc_window else "resolved"
    print(f"{state}|{total}|{pct}|{fmt_window(doc_window)}|{model}")
    sys.exit(0)

# Rank 4: candidate table narrowed by observation. A candidate below the
# largest total this session has been observed holding (over the WHOLE file)
# is refuted by data and can never be selected.
candidates = candidates_for(last_model)
live = {w for w in candidates if w >= observed_max}
if len(live) == 1:
    w = next(iter(live))
    pct = round(100 * total / w)
    print(f"resolved|{total}|{pct}|{fmt_window(w)}|{model}")
elif len(live) > 1:
    # Rank 5: more than one candidate survives -- unresolved, not a guess.
    print(f"unresolved|{total}|?|?|{model}")
elif candidates:
    # Every candidate is refuted -- the observation exceeds the largest one.
    w = max(candidates)
    pct = round(100 * total / w)
    print(f"exceeded|{total}|{pct}|{fmt_window(w)}|{model}")
else:
    # Rank 5: no table entry for this family at all -- unresolved.
    print(f"unresolved|{total}|?|?|{model}")
PYEOF
  _PY_OUT=$(timeout 4 python3 "$_PY" "$_STDIN_JSON" < "$TRANSCRIPT")
  rm -f "$_PY" "$_STDIN_JSON"
  [ -z "$_PY_OUT" ] && _PY_OUT="nodata|0|?|?|?"
  CTX_STATE="${_PY_OUT%%|*}"
  _CTX_REST="${_PY_OUT#*|}"
  CTX_TOKENS="${_CTX_REST%%|*}"
  _CTX_REST="${_CTX_REST#*|}"
  CTX_PCT="${_CTX_REST%%|*}"
  _CTX_REST="${_CTX_REST#*|}"
  CTX_WIN="${_CTX_REST%%|*}"
  CTX_MODEL="${_CTX_REST#*|}"
  [ -z "$CTX_STATE" ]  && CTX_STATE="nodata"
  [ -z "$CTX_TOKENS" ] && CTX_TOKENS="0"
  [ -z "$CTX_PCT" ]    && CTX_PCT="?"
  [ -z "$CTX_WIN" ]    && CTX_WIN="?"
  [ -z "$CTX_MODEL" ]  && CTX_MODEL="?"
fi

# --- Quota % + refresh from usage-cache.json ---
# Gated behind CLAUDECODE=1 (set by the real Claude Code CLI binary itself):
# non-Claude-Code sessions (e.g. Grok CLI, which fires this hook natively per
# contract-f2's finding) must never have the Anthropic cache read at all, so
# they can't surface a foreign/stale Claude quota % (GH #1368).
Q_PCT="?"
R_HRS="?"
RESETS_RAW=""
CACHE="${ATHANOR_QUOTA_CACHE_OVERRIDE:-$HOME/.claude/MEMORY/STATE/usage-cache.json}"
if [ "$CLAUDECODE" = "1" ] && [ -f "$CACHE" ]; then
  Q_PCT=$(jq -r '.five_hour.utilization | floor' "$CACHE")
  [ -z "$Q_PCT" ] || [ "$Q_PCT" = "null" ] && Q_PCT="?"
  RESETS_RAW=$(jq -r '.five_hour.resets_at // empty' "$CACHE")
  _PY2=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  cat > "$_PY2" <<'PYEOF'
import sys, datetime
raw = sys.stdin.read().strip()
if not raw:
    print("?")
    sys.exit(0)
try:
    s = raw.replace("Z", "+00:00")
    resets = datetime.datetime.fromisoformat(s)
    now = datetime.datetime.now(datetime.timezone.utc)
    hrs = (resets - now).total_seconds() / 3600.0
    if hrs < 0:
        print("0.0h")
    else:
        print(f"{round(hrs, 1)}h")
except Exception:
    print("?")
PYEOF
  R_HRS=$(printf '%s' "$RESETS_RAW" | timeout 4 python3 "$_PY2")
  rm -f "$_PY2"
  [ -z "$R_HRS" ] && R_HRS="?"
fi

# --- Mirror quota status to a project-local file (additive, best-effort) ---
# Consumed by execution/quota.py status (F1). Never allowed to abort the turn
# or corrupt the additionalContext JSON below — all failures swallowed.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_MIRROR="${REPO_ROOT:-.}/.agent/memory/scratch/.quota_status.json"
MIRROR_PATH="${ATHANOR_QUOTA_MIRROR_OVERRIDE:-$DEFAULT_MIRROR}"
if [[ "$Q_PCT" =~ ^[0-9]+$ ]]; then
  _PY3=$(mktemp /tmp/athanor_hook.XXXXXX.py)
  cat > "$_PY3" <<'PYEOF'
import datetime, json, os, sys

used_pct = int(sys.argv[1])
resets_raw = sys.argv[2]
mirror_path = sys.argv[3]
try:
    now = datetime.datetime.now(datetime.timezone.utc)
    resets_at = None
    seconds_to_reset = None
    if resets_raw:
        try:
            resets = datetime.datetime.fromisoformat(resets_raw.replace("Z", "+00:00"))
            resets_at = resets.isoformat()
            seconds_to_reset = (resets - now).total_seconds()
        except Exception:
            resets_at = None
            seconds_to_reset = None
    data = {
        "used_pct": used_pct,
        "resets_at": resets_at,
        "seconds_to_reset": seconds_to_reset,
        "captured_at": now.isoformat(),
    }
    parent = os.path.dirname(mirror_path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    tmp_path = f"{mirror_path}.tmp.{os.getpid()}"
    with open(tmp_path, "w") as f:
        json.dump(data, f)
    os.replace(tmp_path, mirror_path)
except Exception:
    pass
PYEOF
  timeout 4 python3 "$_PY3" "$Q_PCT" "$RESETS_RAW" "$MIRROR_PATH" >/dev/null 2>&1
  rm -f "$_PY3"
fi

# --- High-water-mark checkpoint: proactive, PRIMARY mechanism -------------
# Independent of Claude Code's StopFailure payload contract -- depends only
# on this hook's own already-verified Q_PCT. Same schema, same default path,
# as the reactive quota_death_checkpoint.sh StopFailure hook. Never fatal --
# a UserPromptSubmit hook must always exit 0 and emit valid JSON on stdout.
if [[ "$Q_PCT" =~ ^[0-9]+$ ]] && [ "$Q_PCT" -ge 90 ]; then
  CHECKPOINT="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-${REPO_ROOT:-.}/.agent/memory/scratch/.quota_death_checkpoint.json}"
  ACTIVE_MISSION_PATH="${ATHANOR_ACTIVE_MISSION_PATH:-${REPO_ROOT:-.}/.agent/memory/project/missions/active.json}"
  mkdir -p "$(dirname "$CHECKPOINT")" 2>/dev/null
  if [ -d "$(dirname "$CHECKPOINT")" ]; then
    CP_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    CP_MISSION="null"
    CP_CHECKPOINT="null"
    if [ -f "$ACTIVE_MISSION_PATH" ]; then
      CP_MISSION="$(jq -c '.mission // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
      CP_CHECKPOINT="$(jq -c '.checkpoint // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
    fi
    CP_MSG="⚡ QUOTA RECOVERY: quota reached ${Q_PCT}% at ${CP_TS} (high-water mark). Resume: python3 execution/mission.py resume"
    # Write to a temp file in the same directory, then rename into place, so the
    # checkpoint is only ever absent or complete -- never truncated by a mid-write kill.
    CHECKPOINT_TMP="${CHECKPOINT}.tmp.$$"
    jq -n \
      --arg ts "$CP_TS" \
      --arg reason "quota_high_water" \
      --argjson mission "$CP_MISSION" \
      --argjson cp "$CP_CHECKPOINT" \
      --arg msg "$CP_MSG" \
      '{timestamp:$ts, stop_reason:$reason, active_mission:$mission, active_checkpoint:$cp, recovery_message:$msg}' \
      > "$CHECKPOINT_TMP" 2>/dev/null \
      && mv -f "$CHECKPOINT_TMP" "$CHECKPOINT" 2>/dev/null \
      || rm -f "$CHECKPOINT_TMP" 2>/dev/null
  fi
fi

# --- Build injection string ---
# Output grammar: goldens/window_resolution_spec.md section 3. CTX_STATE is one of
# resolved / exceeded (both carry a percentage and the window divided by) /
# unresolved (no percentage, names the model) / nodata (no usable transcript data).
Q_STR="${Q_PCT}%"
[ "$Q_PCT" = "?" ] && Q_STR="?"

HIGH_FIRES=0
if [[ "$CTX_TOKENS" =~ ^[0-9]+$ ]] && [ "$CTX_TOKENS" -ge 100000 ]; then
  HIGH_FIRES=1
fi
CTX_K=0
[[ "$CTX_TOKENS" =~ ^[0-9]+$ ]] && CTX_K=$(( CTX_TOKENS / 1000 ))

WIN_DISP="$CTX_WIN"
[ "$CTX_STATE" = "exceeded" ] && WIN_DISP=">${CTX_WIN}"

case "$CTX_STATE" in
  resolved|exceeded)
    if [ "$HIGH_FIRES" = "1" ]; then
      INJECT="⚡ CONTEXT HIGH (${CTX_K}k tokens / ${CTX_PCT}% of ${WIN_DISP}) — WRAP UP: brain.py wrap-up + commit mission to disk + /compact | quota used: ${Q_STR} | refresh: ${R_HRS}"
    else
      INJECT="[context: ${CTX_PCT}% of ${WIN_DISP} (${CTX_K}k tokens, used not remaining) | quota used: ${Q_STR} (not remaining) | refresh: ${R_HRS}]"
    fi
    ;;
  unresolved)
    if [ "$HIGH_FIRES" = "1" ]; then
      INJECT="⚡ CONTEXT HIGH (${CTX_K}k tokens / window unresolved) — WRAP UP: brain.py wrap-up + commit mission to disk + /compact | quota used: ${Q_STR} | refresh: ${R_HRS}"
    else
      INJECT="[context: ? (${CTX_K}k tokens; window unresolved for model '${CTX_MODEL}', used not remaining) | quota used: ${Q_STR} (not remaining) | refresh: ${R_HRS}]"
    fi
    ;;
  *)
    INJECT="[context: ? (used, not remaining) | quota used: ${Q_STR} (not remaining) | refresh: ${R_HRS}]"
    ;;
esac

# --- Emit JSON via jq to avoid quoting issues ---
jq -nc --arg msg "$INJECT" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' \
  || echo '{}'

exit 0
