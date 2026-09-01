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

# --- Private per-invocation temp directory --------------------------------
# The helper scripts below used to be created with `mktemp /tmp/athanor_hook.XXXXXX.py`.
# BSD/macOS mktemp does NOT substitute an X-run that is not at the END of the
# template: three consecutive calls all returned the literal path
# `/tmp/athanor_hook.XXXXXX.py`, so every concurrent hook invocation on the
# machine shared one filename and `rm -f`'d the scripts the others were about
# to run (measured 2026-08-31: 3/30 mirror writes survived at 10-way
# concurrency, the failures swallowed by the suppressed stderr).
# `mktemp -d` with a TRAILING X-run behaves identically on BSD/macOS and GNU
# coreutils, so the helpers get fixed names inside a private directory instead.
# If the directory cannot be created, _TMPD is empty and EVERY helper block
# below is skipped outright -- none of them may fall through to `cat > ""` or
# to a path in the user's cwd. A temp-path failure that degrades silently is
# how this defect survived since 4f023c18; the guard is what makes the degrade
# a documented "?" instead of an invisible no-op.
_TMPD=$(mktemp -d "${TMPDIR:-/tmp}/athanor_hook.XXXXXX")
_cleanup_tmpd() { [ -n "$_TMPD" ] && [ -d "$_TMPD" ] && rm -rf "$_TMPD"; }
trap _cleanup_tmpd EXIT

# --- Read hook input from stdin ---
INPUT=$(cat)
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty')
SESSION_ID=$(printf '%s' "$INPUT" | jq -r '.session_id // empty')

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
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] && [ -n "$_TMPD" ]; then
  _PY="$_TMPD/context_window.py"
  _STDIN_JSON="$_TMPD/stdin.json"
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
# 1 only when RESETS_RAW parsed as a real timestamp. An unparseable value must
# never reach the checkpoint verbatim: F2's resume resolver has to treat it as
# ABSENT, and `"resets_at": "not-a-ts"` is indistinguishable from a good value
# until it is parsed too late to matter (QA R-5, 2026-08-31).
RESETS_OK=0
CACHE="${ATHANOR_QUOTA_CACHE_OVERRIDE:-$HOME/.claude/MEMORY/STATE/usage-cache.json}"
if [ "$CLAUDECODE" = "1" ] && [ -f "$CACHE" ]; then
  Q_PCT=$(jq -r '.five_hour.utilization | floor' "$CACHE")
  [ -z "$Q_PCT" ] || [ "$Q_PCT" = "null" ] && Q_PCT="?"
  RESETS_RAW=$(jq -r '.five_hour.resets_at // empty' "$CACHE")
  if [ -n "$_TMPD" ]; then
  _PY2="$_TMPD/resets_at.py"
  cat > "$_PY2" <<'PYEOF'
# Emits "<display>|<parsed>" -- parsed is 1 only when the raw value really is
# a timestamp, so the caller can tell "no reset time" from "unparseable".
import sys, datetime
raw = sys.stdin.read().strip()
if not raw:
    print("?|0")
    sys.exit(0)
try:
    s = raw.replace("Z", "+00:00")
    resets = datetime.datetime.fromisoformat(s)
    now = datetime.datetime.now(datetime.timezone.utc)
    hrs = (resets - now).total_seconds() / 3600.0
    if hrs < 0:
        print("0.0h|1")
    else:
        print(f"{round(hrs, 1)}h|1")
except Exception:
    print("?|0")
PYEOF
  _R_OUT=$(printf '%s' "$RESETS_RAW" | timeout 4 python3 "$_PY2")
  rm -f "$_PY2"
  R_HRS="${_R_OUT%%|*}"
  [ "${_R_OUT##*|}" = "1" ] && RESETS_OK=1
  [ -z "$R_HRS" ] && R_HRS="?"
  fi
fi

# --- Mirror quota status to a project-local file (additive, best-effort) ---
# Consumed by execution/quota.py status (F1). Never allowed to abort the turn
# or corrupt the additionalContext JSON below — all failures swallowed.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." 2>/dev/null && pwd)"
DEFAULT_MIRROR="${REPO_ROOT:-.}/.agent/memory/scratch/.quota_status.json"
MIRROR_PATH="${ATHANOR_QUOTA_MIRROR_OVERRIDE:-$DEFAULT_MIRROR}"
if [[ "$Q_PCT" =~ ^[0-9]+$ ]] && [ -n "$_TMPD" ]; then
  _PY3="$_TMPD/quota_mirror.py"
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

# --- Band thresholds: single-sourced from execution/quota.py --------------
# execution/quota.py owns BAND_TIGHT_PCT / BAND_CRITICAL_PCT / BAND_PAUSE_PCT
# as named module-level constants. They are PARSED out of it here rather than
# restated: the hook used to carry a second, independent copy of the literals
# 85/90/95, and nothing in the harness could detect the two copies drifting
# apart -- while the docs claim the thresholds live "in exactly one place"
# (QA R-3, 2026-08-31). If the oracle is unreadable, or any constant is not a
# plain integer, the hook reports band `unknown` and stays SILENT rather than
# guessing a threshold -- the same fail-open the oracle itself uses, and the
# reason no fallback literal is written here.
QUOTA_ORACLE="${SCRIPT_DIR:-.}/../quota.py"
_band_pct() {
  sed -n -E "s/^$1[[:space:]]*=[[:space:]]*([0-9]+)[[:space:]]*(#.*)?$/\1/p" \
    "$QUOTA_ORACLE" 2>/dev/null | head -1
}
BAND_TIGHT_PCT=""
BAND_CRITICAL_PCT=""
BAND_PAUSE_PCT=""
if [ -f "$QUOTA_ORACLE" ]; then
  BAND_TIGHT_PCT=$(_band_pct BAND_TIGHT_PCT)
  BAND_CRITICAL_PCT=$(_band_pct BAND_CRITICAL_PCT)
  BAND_PAUSE_PCT=$(_band_pct BAND_PAUSE_PCT)
fi
BANDS_OK=0
if [[ "$BAND_TIGHT_PCT" =~ ^[0-9]+$ ]] && [[ "$BAND_CRITICAL_PCT" =~ ^[0-9]+$ ]] \
   && [[ "$BAND_PAUSE_PCT" =~ ^[0-9]+$ ]]; then
  BANDS_OK=1
fi

# --- Band (mission quota-aware-pause-resume F1) ---------------------------
# Computed once, here, from Q_PCT alone. Agents branch on this WORD, never on
# 100-Q_PCT. Boundaries inclusive at the lower bound; unresolved Q_PCT ("?")
# fails open to "unknown", never a guessed "healthy".
Q_BAND="unknown"
if [ "$BANDS_OK" = "1" ] && [[ "$Q_PCT" =~ ^[0-9]+$ ]]; then
  if [ "$Q_PCT" -ge "$BAND_PAUSE_PCT" ]; then
    Q_BAND="pause"
  elif [ "$Q_PCT" -ge "$BAND_CRITICAL_PCT" ]; then
    Q_BAND="critical"
  elif [ "$Q_PCT" -ge "$BAND_TIGHT_PCT" ]; then
    Q_BAND="tight"
  else
    Q_BAND="healthy"
  fi
fi

# --- High-water-mark / pause checkpoint: proactive, PRIMARY mechanism -----
# Independent of Claude Code's StopFailure payload contract -- depends only
# on this hook's own already-verified Q_PCT/Q_BAND. Same schema, same default
# path, as the reactive quota_death_checkpoint.sh StopFailure hook. Never
# fatal -- a UserPromptSubmit hook must always exit 0 and emit valid JSON on
# stdout.
#
# 90-94 keeps stop_reason=quota_high_water VERBATIM (compaction-threshold-truth
# A13 depends on it). >=95 is the NEW quota_pause branch (D-4). Both branches
# additionally carry resets_at/used_pct/band -- resets_at is load-bearing: the
# resume monitor has no other durable record of when the window reopens once
# the live mirror goes stale (see goldens/quota_bands_spec.md §5-6).
# CP_WRITTEN records whether the checkpoint is ACTUALLY on disk. The pause
# wording below is conditional on it: the injected line used to promise
# "checkpoint written" unconditionally, including on a read-only checkpoint
# directory, an unwritable root, or a path that is itself a directory -- and a
# pause banner that promises a checkpoint which does not exist is how work gets
# lost (QA R-1, 2026-08-31).
CP_WRITTEN=0
if [ "$BANDS_OK" = "1" ] && [[ "$Q_PCT" =~ ^[0-9]+$ ]] && [ "$Q_PCT" -ge "$BAND_CRITICAL_PCT" ]; then
  CHECKPOINT="${ATHANOR_QUOTA_DEATH_CHECKPOINT_PATH:-${REPO_ROOT:-.}/.agent/memory/scratch/.quota_death_checkpoint.json}"
  ACTIVE_MISSION_PATH="${ATHANOR_ACTIVE_MISSION_PATH:-${REPO_ROOT:-.}/.agent/memory/project/missions/active.json}"
  mkdir -p "$(dirname "$CHECKPOINT")" 2>/dev/null
  # A checkpoint path that already exists but is not a regular file (a directory,
  # most often) can never hold the checkpoint -- and `mv -f tmp dir` would
  # silently succeed by moving the temp file INSIDE it, leaving nothing at the
  # path and littering the directory. Refuse the whole write instead.
  if [ -d "$(dirname "$CHECKPOINT")" ] && { [ ! -e "$CHECKPOINT" ] || [ -f "$CHECKPOINT" ]; }; then
    CP_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    CP_MISSION="null"
    CP_CHECKPOINT="null"
    if [ -f "$ACTIVE_MISSION_PATH" ]; then
      CP_MISSION="$(jq -c '.mission // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
      CP_CHECKPOINT="$(jq -c '.checkpoint // null' "$ACTIVE_MISSION_PATH" 2>/dev/null || echo null)"
    fi
    if [ "$Q_BAND" = "pause" ]; then
      CP_REASON="quota_pause"
      CP_MSG="⚡ QUOTA PAUSE: quota reached ${Q_PCT}% at ${CP_TS}. Checkpoint written; wrap up and stop: python3 execution/mission.py pause <mission>. Resume: python3 execution/mission.py resume"
    else
      CP_REASON="quota_high_water"
      CP_MSG="⚡ QUOTA RECOVERY: quota reached ${Q_PCT}% at ${CP_TS} (high-water mark). Resume: python3 execution/mission.py resume"
    fi
    # Only a resets_at that actually PARSED is durable. An unparseable value is
    # written as null, matching the mirror path: the resume resolver must see
    # "absent", never "present and broken" (QA R-5).
    CP_RESETS_ARG="null"
    CP_RESETS_JQ_TYPE="--argjson"
    if [ -n "$RESETS_RAW" ] && [ "$RESETS_OK" = "1" ]; then
      CP_RESETS_ARG="$RESETS_RAW"
      CP_RESETS_JQ_TYPE="--arg"
    fi
    # Write to a temp file in the same directory, then rename into place, so the
    # checkpoint is only ever absent or complete -- never truncated by a mid-write kill.
    CHECKPOINT_TMP="${CHECKPOINT}.tmp.$$"
    jq -n \
      --arg ts "$CP_TS" \
      --arg reason "$CP_REASON" \
      --argjson mission "$CP_MISSION" \
      --argjson cp "$CP_CHECKPOINT" \
      --arg msg "$CP_MSG" \
      "$CP_RESETS_JQ_TYPE" resets_at "$CP_RESETS_ARG" \
      --argjson used_pct "$Q_PCT" \
      --arg band "$Q_BAND" \
      '{timestamp:$ts, stop_reason:$reason, active_mission:$mission, active_checkpoint:$cp, recovery_message:$msg, resets_at:$resets_at, used_pct:$used_pct, band:$band}' \
      > "$CHECKPOINT_TMP" 2>/dev/null
    if [ -s "$CHECKPOINT_TMP" ] && mv -f "$CHECKPOINT_TMP" "$CHECKPOINT" 2>/dev/null \
       && [ -s "$CHECKPOINT" ]; then
      CP_WRITTEN=1
    else
      rm -f "$CHECKPOINT_TMP" 2>/dev/null
    fi
  fi
fi

# --- Turn timestamps (mission turn-timestamps F1): START line -------------
# Additive, independent channel from the additionalContext built below --
# NEVER touches Q_SEG/INJECT or anything derived from them (D-Mechanism,
# goldens/verify_scope_boundary.sh pins the additionalContext grammar
# untouched). Writes this session's START epoch to a session_id-keyed file
# (.agent/memory/scratch/.turn_ts_<session_id>.json -- session_id keying
# avoids the Pulse-label collision class, since many concurrent sessions can
# share one workspace) for turn_end_stamp.sh's Stop hook to read back later,
# and touches the cross-session .last_activity.json
# so full_boot.sh's next SessionStart can report how long the workspace was
# idle. Every failure here (missing lib, unwritable scratch, missing
# session_id) degrades to START_LINE staying empty -- never aborts the turn.
START_LINE=""
if [ -n "$_TMPD" ] && [ -f "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" ]; then
  _PY4="$_TMPD/turn_start.py"
  cat > "$_PY4" <<'PYEOF'
import os, sys, time

sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[1])))
import turn_timestamp as ts

session_id = sys.argv[2]
scratch_dir = sys.argv[3]
now = int(time.time())

try:
    if session_id:
        ts.write_last_start_epoch(ts.session_state_path(session_id, scratch_dir), now)
    ts.touch_last_activity(ts.last_activity_path(scratch_dir), now)
    print(ts.format_start_line(now))
except Exception:
    pass
PYEOF
  SCRATCH_DIR="${REPO_ROOT:-.}/.agent/memory/scratch"
  START_LINE=$(timeout 4 python3 "$_PY4" "${SCRIPT_DIR:-.}/lib/turn_timestamp.py" "$SESSION_ID" "$SCRATCH_DIR" 2>/dev/null)
  rm -f "$_PY4"
fi

# --- Build injection string ---
# Output grammar: goldens/window_resolution_spec.md section 3. CTX_STATE is one of
# resolved / exceeded (both carry a percentage and the window divided by) /
# unresolved (no percentage, names the model) / nodata (no usable transcript data).
Q_STR="${Q_PCT}%"
[ "$Q_PCT" = "?" ] && Q_STR="?"

# Band-aware wording (mission quota-aware-pause-resume F1,
# goldens/quota_bands_spec.md §3). `healthy` and `unknown` are SILENT --
# rationale (2026-08-31, Brad): agents were reading "quota used: 15%" as
# "nearly exhausted", inventing a crisis out of a healthy window, halting
# mid-mission and interrupting the user. Two prior mitigations
# ("(not remaining)" suffix, then blanket suppression below 85%) both failed
# or threw away information. The fix here is structural: the FIRST number in
# every visible band is REMAINING (a misread of it is benign), the band WORD
# leads (never a percentage an agent could invert), and `quota used: {pct}%`
# survives verbatim, but only inside a labelled parenthetical -- never first,
# never adjacent to the word REMAINING (G1-G5; compaction-threshold-truth A13
# depends on the exact substring surviving).
#
# The REMAINING figure is clamped to [0,100]: a utilization above 100 (which the
# upstream cache does emit) used to render as "-50% ... REMAINING", nonsense text
# at the moment of maximum pressure (QA R-2). Q_PCT itself is left truthful --
# the parenthetical reports what was actually read.
Q_SEG=""
if [[ "$Q_PCT" =~ ^[0-9]+$ ]]; then
  Q_REMAIN=$(( 100 - Q_PCT ))
  [ "$Q_REMAIN" -lt 0 ] && Q_REMAIN=0
  [ "$Q_REMAIN" -gt 100 ] && Q_REMAIN=100
  case "$Q_BAND" in
    tight)
      Q_SEG=" | quota: TIGHT — ${Q_REMAIN}% of this 5h window REMAINING — finish what is in flight; do not start a new feature (quota used: ${Q_STR}) | refresh: ${R_HRS}"
      ;;
    critical)
      Q_SEG=" | quota: CRITICAL — ${Q_REMAIN}% of this 5h window REMAINING — land and push in-flight work now, checkpoint immediately (quota used: ${Q_STR}) | refresh: ${R_HRS}"
      ;;
    pause)
      CP_CLAIM="checkpoint written"
      [ "$CP_WRITTEN" = "1" ] || CP_CLAIM="CHECKPOINT WRITE FAILED, save state by hand"
      Q_SEG=" | ⚡ QUOTA PAUSE — ${Q_REMAIN}% of this 5h window REMAINING — ${CP_CLAIM}; wrap up now and stop: python3 execution/mission.py pause <mission> (quota used: ${Q_STR}) | refresh: ${R_HRS}"
      ;;
  esac
fi

HIGH_FIRES=0
if [[ "$CTX_TOKENS" =~ ^[0-9]+$ ]] && [ "$CTX_TOKENS" -ge 100000 ]; then
  HIGH_FIRES=1
fi
CTX_K=0
[[ "$CTX_TOKENS" =~ ^[0-9]+$ ]] && CTX_K=$(( CTX_TOKENS / 1000 ))

# --- Blocker-status-line F1: additive-only context mirror + transcript-
# signal self-clear (SPEC.md D3). Never touches Q_SEG/INJECT or anything
# derived from them (goldens/verify_scope_boundary.sh pins the
# additionalContext grammar built below untouched). Both calls are
# best-effort via the blocker_status.py CLI -- never allowed to slow or
# abort this turn.
BLOCKER_STATUS="${SCRIPT_DIR:-.}/../blocker_status.py"
if [ -f "$BLOCKER_STATUS" ]; then
  CONTEXT_MIRROR="${REPO_ROOT:-.}/.agent/memory/scratch/.context_status.json"
  timeout 4 python3 "$BLOCKER_STATUS" write-context-mirror \
    --tokens "$CTX_TOKENS" --pct "$CTX_PCT" --window "$CTX_WIN" \
    --mirror-path "$CONTEXT_MIRROR" >/dev/null 2>&1
  if [ -n "$SESSION_ID" ]; then
    timeout 4 python3 "$BLOCKER_STATUS" clear-transcript-signal \
      --session-id "$SESSION_ID" --scratch-dir "${REPO_ROOT:-.}/.agent/memory/scratch" >/dev/null 2>&1
  fi
fi

WIN_DISP="$CTX_WIN"
[ "$CTX_STATE" = "exceeded" ] && WIN_DISP=">${CTX_WIN}"

case "$CTX_STATE" in
  resolved|exceeded)
    if [ "$HIGH_FIRES" = "1" ]; then
      INJECT="⚡ CONTEXT HIGH (${CTX_K}k tokens / ${CTX_PCT}% of ${WIN_DISP}) — WRAP UP: brain.py wrap-up + commit mission to disk + /compact${Q_SEG}"
    else
      INJECT="[context: ${CTX_PCT}% of ${WIN_DISP} (${CTX_K}k tokens, used not remaining)${Q_SEG}]"
    fi
    ;;
  unresolved)
    if [ "$HIGH_FIRES" = "1" ]; then
      INJECT="⚡ CONTEXT HIGH (${CTX_K}k tokens / window unresolved) — WRAP UP: brain.py wrap-up + commit mission to disk + /compact${Q_SEG}"
    else
      INJECT="[context: ? (${CTX_K}k tokens; window unresolved for model '${CTX_MODEL}', used not remaining)${Q_SEG}]"
    fi
    ;;
  *)
    INJECT="[context: ? (used, not remaining)${Q_SEG}]"
    ;;
esac

# --- Emit JSON via jq to avoid quoting issues ---
# systemMessage (START_LINE) is a SEPARATE, additive, top-level field --
# user-facing, independent of hookSpecificOutput.additionalContext (model-
# only). Omitted entirely when empty (lib missing, write failed, etc.) --
# never emitted blank.
if [ -n "$START_LINE" ]; then
  jq -nc --arg msg "$INJECT" --arg sysmsg "$START_LINE" \
    '{"systemMessage":$sysmsg, hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' \
    || echo '{}'
else
  jq -nc --arg msg "$INJECT" '{hookSpecificOutput:{hookEventName:"UserPromptSubmit",additionalContext:$msg}}' \
    || echo '{}'
fi

exit 0
