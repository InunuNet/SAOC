#!/usr/bin/env python3
"""Render structured Agent-tool dispatch names.

Format: {RoleAbbr}_{ModelAbbr}_M{n}-F{n}_{MissionPascal}
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
# chars and model_abbr at 6 chars (see render_role_abbr/render_model_abbr),
# so prefix = f"{role}_{model}_M{digits}-F{digits}_" is at most
# 12 + 1 + 6 + 1 + 1 + 8 + 1 + 1 + 8 + 1 = 40 chars, leaving budget >= 24 for
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
}


ESCALATION_LADDER = ["sonnet5", "opus5", "fable5"]


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
    abbr = key[:6]
    if not abbr:
        return "Model"
    return abbr[0].upper() + abbr[1:]


def render_mission_pascal(mission_slug: str) -> str:
    return _pascal_case(mission_slug, "Mission")


def render_milestone_id(milestone_id) -> str:
    digits = re.sub(r"[^0-9]", "", str(milestone_id or ""))[:MAX_ID_DIGITS]
    return f"M{digits}"


def render_feature_id(feature_id) -> str:
    digits = re.sub(r"[^0-9]", "", str(feature_id or ""))[:MAX_ID_DIGITS]
    return f"F{digits}"


def render_dispatch_name(role: str, model: str, mission_slug: str, milestone_id, feature_id) -> str:
    role_abbr = render_role_abbr(role)
    model_abbr = render_model_abbr(model)
    mission_pascal = render_mission_pascal(mission_slug)
    milestone = render_milestone_id(milestone_id)
    feature = render_feature_id(feature_id)

    prefix = f"{role_abbr}_{model_abbr}_{milestone}-{feature}_"

    budget = MAX_NAME_LEN - len(prefix)
    if budget < 0:
        budget = 0
    if len(mission_pascal) > budget:
        mission_pascal = mission_pascal[:budget]

    return f"{prefix}{mission_pascal}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Render an Agent-tool dispatch name")
    parser.add_argument("--role", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--mission", required=True)
    parser.add_argument("--milestone", required=True)
    parser.add_argument("--feature", required=True)
    parser.add_argument("--retry", type=int, default=0)
    args = parser.parse_args()

    name = render_dispatch_name(args.role, args.model, args.mission, args.milestone, args.feature)
    print(name)
    if args.retry > 0:
        suggested = suggest_escalated_model(args.retry)
        print(f"# escalation suggestion: retry {args.retry} -> recommended model tier '{suggested}'", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
