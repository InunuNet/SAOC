#!/usr/bin/env python3
"""Render structured Agent-tool dispatch names.

Format: {RoleAbbr}_{ModelAbbr}_M{n}-F{n}_{MissionPascal}
        (or {RoleAbbr}_{ModelAbbr}_{SlugPascal} outside a mission via --slug)
Always matches ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$.

The milestone/feature segment sits immediately after role/model (protected,
early) so fleet-view UIs that truncate long names with a tail ellipsis never
clip the "where in the flow" signal; the mission-slug segment moves to the
tail, where it remains the only segment ever truncated.
"""

import argparse
import re
import sys

MAX_NAME_LEN = 64

# Bounds the digit run kept from milestone/feature ids. role_abbr caps at 12
# chars and model_abbr at 12 chars (see render_role_abbr/render_model_abbr),
# so prefix = f"{role}_{model}_M{digits}-F{digits}_" is at most
# 12 + 1 + 12 + 1 + 1 + 8 + 1 + 1 + 8 + 1 = 46 chars, leaving budget >= 18 for
# mission_pascal — never negative, regardless of how oversized the raw
# milestone/feature id is.
MAX_ID_DIGITS = 8

ROLE_ABBR = {
    "lead": "Lead",
    "dev": "Dev",
    "dev-fast": "DevFast",
    "designer": "Designer",
    "analyst": "Analyst",
    "architect": "Arch",
    "architect-apex": "ArchApex",
    "qa": "QA",
    "qa-apex": "QAApex",
    "qa-fast": "QAFast",
    "docs": "Docs",
    "maintainer": "Maint",
}

MODEL_ABBR = {
    "sonnet5": "Son5",
    "claudesonnet5": "Son5",
    "opus5": "Opu5",
    "claudeopus5": "Opu5",
    "haiku45": "Hai45",
    "claudehaiku4520251001": "Hai45",
    "fable5": "Fab5",
    "claudefable5": "Fab5",
    "sonnet55": "Son55",
    "claudesonnet55": "Son55",
    "opus55": "Opu55",
    "claudeopus55": "Opu55",
    "haiku55": "Hai55",
    "claudehaiku55": "Hai55",
    "fable51": "Fab51",
    "claudefable51": "Fab51",
    "fable52": "Fab52",
    "claudefable52": "Fab52",
    "sonnet": "Son55",
    "opus": "Opu55",
    "haiku": "Hai55",
    "fable": "Fab52",
    "gpt6sol": "Sol6",
    "gpt6astra": "Ast6",
    "gpt6luna": "Lun6",
    "gemini4hydrogenhigh": "Hyd4",
    "gemini4hydrogen": "Hyd4",
    "gemini4argonhigh": "Arg4",
    "gemini4argon": "Arg4",
}


# Tokens that name a vendor or a release channel, never the model family.
VENDOR_TOKENS = {
    "claude", "anthropic", "openai", "google", "gemini", "gpt", "openrouter",
    "models", "free", "latest", "preview", "exp",
}

# Families with a three-letter tag in MODEL_ABBR; unmapped versions keep the stem.
KNOWN_FAMILIES = {"sonnet", "opus", "haiku", "fable", "sol", "astra", "luna", "hydrogen", "argon"}

# Reasoning effort suffixes. High is the fleet default (only Argon/Hydrogen high are
# allowed), so it adds nothing; anything else is visible in the tag.
EFFORT_SUFFIX = {"high": "", "low": "L", "medium": "M", "minimal": "Mn", "xhigh": "X", "max": "Mx"}

ESCALATION_LADDER = ["sonnet5", "opus5", "fable5"]

# The Agent tool's `model:` field takes bare aliases, not the ladder's tier ids.
AGENT_MODEL_ALIAS = {"sonnet5": "sonnet", "opus5": "opus", "fable5": "fable"}


def suggest_escalated_model(retry: int) -> str:
    """Advisory model tier for the Nth re-dispatch of the same feature+role (retry=0 is the first dispatch)."""
    try:
        retry = int(retry)
    except (TypeError, ValueError):
        retry = 0
    if retry < 0:
        retry = 0
    index = min(retry, len(ESCALATION_LADDER) - 1)
    return ESCALATION_LADDER[index]


def _sanitize_alnum(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", text or "")


def _pascal_case(text: str, fallback: str) -> str:
    segments = re.split(r"[^A-Za-z0-9]+", text or "")
    parts = [seg[0].upper() + seg[1:] for seg in segments if seg]
    result = "".join(parts)
    return result if result else fallback


def render_role_abbr(role: str) -> str:
    key = (role or "").strip().lower()
    if key in ROLE_ABBR:
        return ROLE_ABBR[key]
    return _pascal_case(role, "Role")[:12]


def render_model_abbr(model: str) -> str:
    key = _sanitize_alnum(model).lower()
    if key in MODEL_ABBR:
        return MODEL_ABBR[key]
    if not key:
        return "Model"
    return _fallback_model_abbr(model)


def _fallback_model_abbr(model: str) -> str:
    """Distinct tag for an unmapped model: family letters + version digits + effort.

    Vendor and path prefixes are dropped (openrouter/qwen/qwen3-coder:free -> Qwen3),
    a known family keeps three letters (claude-opus-4-6 -> Opu46), an unknown one
    fills six characters with the version (qwen-2.5-coder-32b-free -> Qwen25), and a
    non-high reasoning effort is suffixed (gemini-4-hydrogen-low -> Hyd4L).
    """
    text = (model or "").strip().lower().split("/")[-1].split(":")[0]
    # Parameter counts (32b, 70b, 7.5m) are sizes, not versions.
    text = re.sub(r"(?<![a-z0-9.])\d+(?:\.\d+)?[bmk](?![a-z0-9])", " ", text)
    pieces = re.findall(r"[a-z]+|[0-9]+", text)
    effort = ""
    family = ""
    version = ""
    past_family = False
    for piece in pieces:
        if piece in EFFORT_SUFFIX:
            effort = EFFORT_SUFFIX[piece]
        elif piece.isdigit():
            if len(piece) <= 2 and not past_family:
                version += piece
        elif piece in VENDOR_TOKENS:
            continue
        elif not family:
            family = piece
        else:
            past_family = True
    if not family:
        letters = re.findall(r"[a-z]+", text)
        family = letters[-1] if letters else "model"
    if family in KNOWN_FAMILIES:
        stem = family[:3]
    else:
        stem = family[: max(3, 6 - len(version))]
    return stem[0].upper() + stem[1:] + version[:4] + effort


def render_mission_pascal(mission_slug: str) -> str:
    return _pascal_case(mission_slug, "Mission")


def render_milestone_id(milestone_id) -> str:
    digits = re.sub(r"[^0-9]", "", str(milestone_id or ""))[:MAX_ID_DIGITS]
    return f"M{digits}"


def render_feature_id(feature_id) -> str:
    digits = re.sub(r"[^0-9]", "", str(feature_id or ""))[:MAX_ID_DIGITS]
    return f"F{digits}"


def render_dispatch_name(
    role: str,
    model: str,
    mission_slug: str = None,
    milestone_id=None,
    feature_id=None,
    slug: str = None,
) -> str:
    role_abbr = render_role_abbr(role)
    model_abbr = render_model_abbr(model)

    if mission_slug is not None:
        tail = render_mission_pascal(mission_slug)
        if milestone_id is not None or feature_id is not None:
            milestone = render_milestone_id(milestone_id)
            feature = render_feature_id(feature_id)
            prefix = f"{role_abbr}_{model_abbr}_{milestone}-{feature}_"
        else:
            prefix = f"{role_abbr}_{model_abbr}_"
    else:
        tail = _pascal_case(slug or "", "Slug")
        prefix = f"{role_abbr}_{model_abbr}_"

    budget = MAX_NAME_LEN - len(prefix)
    if budget < 0:
        budget = 0
    if len(tail) > budget:
        tail = tail[:budget]

    return f"{prefix}{tail}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Render an Agent-tool dispatch name")
    parser.add_argument("--role", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--mission")
    parser.add_argument("--milestone")
    parser.add_argument("--feature")
    parser.add_argument("--slug")
    parser.add_argument("--retry", type=int, default=0)
    args = parser.parse_args()

    if not args.mission and not args.slug:
        parser.error("either --mission or --slug is required")

    name = render_dispatch_name(
        args.role,
        args.model,
        args.mission if args.mission else None,
        args.milestone,
        args.feature,
        slug=args.slug,
    )
    print(name)
    if args.retry > 0:
        suggested = suggest_escalated_model(args.retry)
        alias = AGENT_MODEL_ALIAS.get(suggested, suggested)
        print(
            f"# escalation suggestion: retry {args.retry} -> recommended model tier '{suggested}'"
            f" (Agent tool model: {alias})",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
