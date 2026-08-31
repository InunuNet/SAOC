#!/usr/bin/env python3
"""Importable window-resolution module — shared by hooks that need to know a
session's context-window pressure (current eligible tokens / resolved window).

Extracted from execution/hooks/inject_pressure.sh's inline resolution script
(that file's own copy is left untouched, per the autocompact-inert F3
dispatch — it is free to adopt this shared module in a future refactor, out
of scope here). Same resolution order, same anti-decay rules: no defaults,
exact-match DOCUMENTED, prefix-match CANDIDATES, observed-max backstop. See
.agent/memory/project/specs/autocompact-inert/goldens/compaction_backstop_spec.md
and inject_pressure.sh's own header comment for the wire vocabulary this
module preserves (resolved / exceeded / unresolved / nodata).

Usable both as an importable module:
    from context_window import resolve_from_transcript
and as a CLI:
    python3 context_window.py <payload_json_path|-> <transcript_path>
which prints "state|tokens|pct|window|model" to stdout — the same
pipe-delimited wire format inject_pressure.sh already uses internally. A
payload path of "-" reads the payload JSON from stdin, so callers never need
to round-trip it through a shared temp file (which is not concurrency-safe).

Exit status is part of the CLI contract: 0 means the printed line is a real
reading; non-zero means the reading could not be taken at all (e.g. the
transcript exists but cannot be read) and the caller must treat that as a
failure, NOT as healthy silence.
"""
import json
import os
import re
import sys

USAGE_FIELDS = ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")
MIN_WINDOW = 1000  # no model ships a window this small; anything below is garbage input

# DOCUMENTED windows (rank 3): single-configuration models only. Published
# fact, not inference. Matching is EXACT (family id, or family id + a dated
# -YYYYMMDD suffix); a `[1m]` variant marker or different model number falls
# through to the candidate table, then to unresolved. No default for a model
# absent here. See inject_pressure.sh's inline copy for the full anti-decay
# rationale (kept in sync manually — this module is the extraction target for
# a future refactor of that copy, not a divergent redesign of it).
DOCUMENTED = [
    ("claude-haiku-4-5", 200_000),  # Anthropic model table, 200K, verified 2026-08-30
    ("claude-fable-5", 1_000_000),  # Anthropic model table: 1M single-config, verified 2026-08-30
]

# Candidate windows per model family (rank 4), keyed by longest-prefix match
# on the lowercased model string. Reserved for genuinely ambiguous families
# (shipped in more than one configuration the model string cannot
# distinguish). Every family carries >= 2 candidates deliberately — see
# inject_pressure.sh's inline copy for why a singleton candidate would be
# unfalsifiable.
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
    """Rank 3: a documented single-configuration window, or None. Matching is
    EXACT, never prefix — the family id itself, or the family id + a dated
    suffix (-YYYYMMDD), inherits; anything else falls through."""
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
    """Rank 1 (env var override). Integer >= MIN_WINDOW, else reject."""
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
    """Rank 2 (stdin JSON). Must already be an int type (bool excluded,
    floats/strings rejected rather than coerced), >= MIN_WINDOW."""
    if isinstance(v, bool) or not isinstance(v, int):
        return None
    return v if v >= MIN_WINDOW else None


def stdin_window(payload):
    cw = payload.get("context_window")
    if not isinstance(cw, dict):
        return None
    return valid_window_from_stdin(cw.get("context_window_size"))


def is_eligible(rec, msg, usage):
    """Skip synthetic error records (API error, 529, session-limit, expired
    login) for both the reading and the evidence — never let one reset
    either."""
    if not isinstance(usage, dict):
        return False
    if (msg.get("model") or "") == "<synthetic>":
        return False
    if rec.get("isApiErrorMessage") is True:
        return False
    return sum(to_int(usage.get(f)) for f in USAGE_FIELDS) > 0


def scan_transcript(fileobj):
    """Whole-file scan over a binary-mode file object. Returns
    [(model, total), ...] in file order for eligible records only. A corrupt
    line or invalid byte costs at most itself — never the whole reading."""
    eligible = []
    for raw in fileobj:
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
    return eligible


def resolve(payload, eligible):
    """Core resolution. `payload` is the stdin JSON dict (may carry
    `context_window.context_window_size`); `eligible` is the
    [(model, total), ...] list from scan_transcript, in file order. Returns
    {state, tokens, pct, window, model} — state is one of resolved, exceeded,
    unresolved, nodata (identical vocabulary to inject_pressure.sh's
    CTX_STATE). `pct`/`window` are None unless state is resolved/exceeded."""
    if not eligible:
        return {"state": "nodata", "tokens": 0, "pct": None, "window": None, "model": None}

    last_model, total = eligible[-1]
    model = last_model or None
    # Evidence restricted to the last eligible record's model, so a
    # mid-session /model switch cannot contaminate the denominator.
    observed_max = max(t for m, t in eligible if m == last_model)

    # Rank 1: explicit operator override. Rank 2: the platform's own stated window.
    window = valid_window_from_env(os.environ.get("ATHANOR_CONTEXT_WINDOW"))
    if window is None:
        window = stdin_window(payload)

    if window is not None:
        pct = round(100 * total / window)
        return {"state": "resolved", "tokens": total, "pct": pct, "window": window, "model": model}

    # Rank 3: documented single-configuration windows.
    doc_window = documented_for(last_model)
    if doc_window is not None:
        pct = round(100 * total / doc_window)
        state = "exceeded" if observed_max > doc_window else "resolved"
        return {"state": state, "tokens": total, "pct": pct, "window": doc_window, "model": model}

    # Rank 4: candidate table narrowed by observation.
    candidates = candidates_for(last_model)
    live = {w for w in candidates if w >= observed_max}
    if len(live) == 1:
        w = next(iter(live))
        pct = round(100 * total / w)
        return {"state": "resolved", "tokens": total, "pct": pct, "window": w, "model": model}
    elif len(live) > 1:
        # Rank 5: more than one candidate survives — unresolved, not a guess.
        return {"state": "unresolved", "tokens": total, "pct": None, "window": None, "model": model}
    elif candidates:
        # Every candidate is refuted — the observation exceeds the largest one.
        w = max(candidates)
        pct = round(100 * total / w)
        return {"state": "exceeded", "tokens": total, "pct": pct, "window": w, "model": model}
    else:
        # Rank 5: no table entry for this family at all — unresolved.
        return {"state": "unresolved", "tokens": total, "pct": None, "window": None, "model": model}


def resolve_from_transcript(payload, transcript_path):
    """Convenience wrapper: open transcript_path (binary, read-only) and
    resolve. Raises on an unreadable path — callers that want a graceful
    fallback should catch around this, as the CLI entry point below does."""
    with open(transcript_path, "rb") as f:
        eligible = scan_transcript(f)
    return resolve(payload, eligible)


def main():
    if len(sys.argv) != 3:
        print("nodata|0|?|?|?")
        return 0
    payload_path, transcript_path = sys.argv[1], sys.argv[2]
    payload = {}
    try:
        raw = sys.stdin.read() if payload_path == "-" else open(payload_path).read()
        loaded = json.loads(raw)
        if isinstance(loaded, dict):
            payload = loaded
    except (OSError, ValueError):
        # An absent/malformed payload only costs the rank-2 window hint; the
        # transcript reading below still stands on its own.
        payload = {}
    try:
        result = resolve_from_transcript(payload, transcript_path)
    except OSError:
        # The transcript exists but could not be read (permission denied, I/O
        # error). That is a genuine failure and must NOT be flattened into the
        # same "nodata" wire output a legitimately empty transcript produces —
        # callers rely on the exit status to tell failure from health.
        return 1
    # Any other exception is unexpected: let it propagate rather than absorbing
    # it into a healthy-looking reading.
    state = result["state"]
    tokens = result["tokens"]
    pct = result["pct"] if result["pct"] is not None else "?"
    window = fmt_window(result["window"]) if result["window"] is not None else "?"
    model = result["model"] or "?"
    print(f"{state}|{tokens}|{pct}|{window}|{model}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
