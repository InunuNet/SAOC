#!/usr/bin/env python3
"""autonomy.py — the ONE autonomy dialect (read side).

REQUIREMENTS.md section 6 names three levels at the read surface —
`interactive` / `autonomous` / `loop`. Five levels are already stored on disk
(`off/low/medium/high/loop`) by `.agent/autonomy_matrix.json`,
`execution/hooks/check_autonomy.sh`, `execution/sync_autonomy.py` and
`make set-autonomy`. Existing workspaces must keep booting, so a legacy value
NORMALISES here; the write path and the permission tiers are untouched.

Independent oracle for this module:
`.agent/memory/project/specs/boot-status-panel/goldens/autonomy_levels.md`.

Two rules this module exists to make structural rather than aspirational:

1. An unrecognised level NEVER resolves to a default. `normalize()` returns
   None and the caller reports a defect — the default IS the bug (D-AUT A-7).
2. There is exactly one ranking. `sync_autonomy.py` keeps a five-level rank of
   its own for the permission tiers; anything reading the THREE-level surface
   comes here so the boot panel and the mission driver cannot diverge.

Pure: no I/O, no environment reads, no side effects.
"""

# The only levels the panel and the mission driver may report, weakest first.
LEVELS = ("interactive", "autonomous", "loop")

# Legacy five-level vocabulary already on disk -> the three-level surface.
LEGACY_LEVEL_MAP = {
    "off": "interactive",
    "low": "interactive",
    "medium": "interactive",
    "high": "autonomous",
    "loop": "loop",
}

# Provider files ship the field misspelled. Readers accept both and prefer the
# correct spelling; writers emit only the correct one (D-AUT A-8).
CAP_KEY = "max_honorable_level"
CAP_KEY_LEGACY = "max_honerable_level"

# The FIVE-level permission vocabulary `.agent/autonomy_matrix.json` and
# `execution/hooks/check_autonomy.sh` consume. The read surface is three
# levels, but the write path still has to name a tier for the PreToolUse gate,
# and an unmapped three-level word reaching that gate falls through its
# case-arms to "allow everything" — so the projection lives here instead of
# being re-invented at each writer.
THREE_TO_TIER = {
    "interactive": "medium",
    "autonomous": "high",
    "loop": "loop",
}


def normalize(raw):
    """Return the three-level word for a stored value, or None if unrecognised.

    None is the honest answer for an empty, null, non-string or misspelled
    level. Callers must surface it as a failing check, never substitute a
    default.

    The match is EXACT — no case folding, no whitespace trimming. `HIGH` is not
    `high`. A stored level is a literal token written by `set_autonomy.py` or
    by a provider manifest, so a near-miss is a file somebody hand-edited
    wrongly; resolving it by guessing is the same silent defaulting this module
    exists to prevent, just with a smaller guess.
    """
    if not isinstance(raw, str):
        return None
    if raw in LEVELS:
        return raw
    return LEGACY_LEVEL_MAP.get(raw)


def rank(level):
    """Rank a three-level word, weakest first. Raises ValueError if unknown."""
    normalised = normalize(level)
    if normalised is None:
        raise ValueError(f"unrecognised autonomy level: {level!r}")
    return LEVELS.index(normalised)


def exceeds_cap(level, cap):
    """True when `level` is stronger than `cap`. Unknown either side -> False.

    Refusing to compare an unknown value is deliberate: an unrecognised level
    is reported as its own defect by the caller, and inventing an ordering for
    it would hide that defect behind a cap violation.
    """
    try:
        return rank(level) > rank(cap)
    except ValueError:
        return False


def provider_cap(provider_doc):
    """Read a provider file's declared cap, preferring the correct spelling.

    Accepts the field nested under `autonomy` (the shipped shape) or at the top
    level. Returns the RAW stored value, so the caller can report both what was
    stored and what it normalises to.
    """
    if not isinstance(provider_doc, dict):
        return None
    scopes = []
    nested = provider_doc.get("autonomy")
    if isinstance(nested, dict):
        scopes.append(nested)
    scopes.append(provider_doc)
    for scope in scopes:
        for key in (CAP_KEY, CAP_KEY_LEGACY):
            if scope.get(key) is not None:
                return scope[key]
    return None


def permission_tier(level):
    """The five-level permission tier for a stored level, or None if unknown.

    A value already IN the five-level vocabulary is returned unchanged, so
    `off` and `low` keep their own tiers rather than being widened to the
    `medium` that both normalise to on the three-level read surface.
    """
    if isinstance(level, str) and level in LEGACY_LEVEL_MAP:
        return level
    normalised = normalize(level)
    return THREE_TO_TIER.get(normalised) if normalised else None
