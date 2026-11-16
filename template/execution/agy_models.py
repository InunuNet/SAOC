#!/usr/bin/env python3
"""Resolve Antigravity models from the provider's model_map.

Usage: agy_models.py tier <tier> | check <model>
Config: <repo>/.agent/providers/antigravity.json, or $ATHANOR_AGY_PROVIDER_JSON.
Any failure prints a message on stderr, nothing on stdout, and exits 1.
"""
import json
import os
import sys
from pathlib import Path

ENV_OVERRIDE = "ATHANOR_AGY_PROVIDER_JSON"
REL_CONFIG = Path(".agent/providers/antigravity.json")
# The config may narrow this pair, never widen it (Brad 2026-11-15).
HARD_ALLOWED = frozenset({"gemini-4-hydrogen-high", "gemini-4-argon-high"})


class ModelError(Exception):
    pass


def load_config():
    override = os.environ.get(ENV_OVERRIDE)
    path = Path(override) if override else Path(__file__).resolve().parent.parent / REL_CONFIG
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ModelError(f"cannot read {path}: {type(exc).__name__}") from exc
    if not isinstance(cfg, dict):
        raise ModelError(f"{path}: top level is not an object")
    return cfg


def tier_model(cfg, tier):
    mapping = cfg.get("model_map")
    if not isinstance(mapping, dict):
        raise ModelError("model_map missing or malformed")
    model = mapping.get(tier)
    if not isinstance(model, str) or not model.strip():
        raise ModelError(f"unknown tier: {tier!r}")
    model = model.strip()
    if model not in HARD_ALLOWED:
        raise ModelError(f"tier {tier!r} maps to a model outside the allowed pair: {model!r}")
    check_model(cfg, model)
    return model


def check_model(cfg, model):
    allowed = cfg.get("allowed_models")
    if not isinstance(allowed, list):
        raise ModelError("allowed_models missing or malformed")
    if model not in allowed or model not in HARD_ALLOWED:
        raise ModelError(f"model not allowed: {model!r}")


def main(argv):
    if len(argv) != 2 or argv[0] not in ("tier", "check"):
        raise ModelError("usage: agy_models.py tier <tier> | check <model>")
    cfg = load_config()
    if argv[0] == "tier":
        print(tier_model(cfg, argv[1]))
    else:
        check_model(cfg, argv[1])
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv[1:]))
    except ModelError as err:
        print(f"agy_models.py: {err}", file=sys.stderr)
        sys.exit(1)
