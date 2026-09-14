#!/usr/bin/env python3
"""verify_free_model_catalog.py -- durable catalog-churn guardrail for mission
model-tier-repair F2 (RC-B, dead free-tier model ids).

Feature under test:
  .agent/config/free_models.json        (single source of truth for ids)

Problem this exists to fix (SPEC.md §2, "prose-only rule"): rules.md already
mandates re-verifying free-tier model ids against OpenRouter's live catalog
"at each mission start" -- but nothing ever called that rule. Ids drifted
dead (4 of 5 configured ids were dead as of 2026-08-14/15) with no check to
catch it. This script is the mechanical enforcement of that prose rule.

Durability design (do not regress this if you touch the file later):
  - Ids are DISCOVERED by reading .agent/config/free_models.json, never
    hand-listed in this script. The only thing hardcoded here is the
    CONFIG'S SHAPE (which keys must exist), not any model id string. A
    hardcoded id list is exactly what let the dead ids rot unnoticed --
    see SPEC.md §2 -- so this script must never grow one.
  - Assertions are shape-based ("every id in config is present in the live
    catalog with pricing 0/0 and tools support"), not "the id is X". This
    contract must survive every future OpenRouter catalog change untouched.
  - Network/proxy-unavailable is SKIP, not FAIL, mirroring the doctrine in
    verify_skill_drift.py: a check that fails whenever the network happens
    to be down gets disabled within a week, and a disabled check is worse
    than no check -- it looks like coverage it doesn't provide. SKIP is
    split by cause (proxy unreachable vs. proxy answered something unusable)
    for the same reason verify_skill_drift.py splits it: so debugging isn't
    misdirected.
  - Only genuinely-fetched, genuinely-absent (or priced, or tool-less) ids
    FAIL. A catalog that was successfully fetched and simply does not
    contain a configured id is real signal, not a network hiccup.
  - This script never re-implements or caches a copy of the catalog. Each
    run is a live fetch; nothing here can itself go stale the way the
    dead ids did.

All external fetching goes through the Alembic proxy (project mandate,
.claude/rules/alembic.md) -- default endpoint below is Alembic's
passthrough of OpenRouter's models endpoint, not a direct external call.

Usage: verify_free_model_catalog.py <case> [--config PATH] [--endpoint URL]
Cases: config_shape, vendor_distinct, catalog_live
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = REPO_ROOT / ".agent" / "config" / "free_models.json"
DEFAULT_ENDPOINT = "http://localhost:7077/https://openrouter.ai/api/v1/models"
TIMEOUT_SECONDS = 10.0

REQUIRED_ROLES = ("dev_fast", "qa_fast")
REQUIRED_SLOTS = ("default", "fallback")

SKIP_CONNECTION = "connection"  # proxy down/unreachable -- no response at all
SKIP_RESPONSE = "response"      # proxy answered, but the reply couldn't be used


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def skip(msg: str) -> None:
    # Exit 77 is the reserved autotools-convention skip signal
    # execution/contract.py:302 checks BEFORE comparing against expect_exit
    # -- it classifies verdict=skip distinctly from pass/fail (own summary
    # column, blocks the gate unless --allow-skips, hard-fails regardless
    # when the assertion is required:true). Exit 0 would instead be
    # silently counted as a PASS by contract.py -- migrated from exit 0
    # 2026-08-15 (mission model-tier-repair F3 amendment) after the same
    # false-PASS defect was found and fixed in verify_f3_dispatch_wiring.py.
    # This is a genuine behavior change for contract-f2's catalog_live
    # assertion, which is required:true: a skip there now hard-fails the
    # gate instead of silently passing (contract.py's own documented
    # required:true-overrides-skip semantics) -- see the golden for the
    # tradeoff this exposes.
    print(f"SKIP: {msg}")
    sys.exit(77)


def load_config(config_path: Path) -> dict:
    """Load + shape-validate the config. Returns the parsed dict. Calls
    fail() (exit 1) on any shape problem -- config existing with the right
    shape is a real precondition, not a network concern, so this is never a
    SKIP path."""
    if not config_path.exists():
        fail(
            f"{config_path} does not exist -- this is the single source of "
            f"truth for @dev-fast/@qa-fast free-tier model ids; every "
            f"routing doc (agent frontmatter prose, rules.md, "
            f"docs/openrouter.md) should be updated to match values read "
            f"from this file, not hand-copy ids into multiple places."
        )
    try:
        data = json.loads(config_path.read_text())
    except json.JSONDecodeError as exc:
        fail(f"{config_path} is not valid JSON: {exc}")
    if not isinstance(data, dict):
        fail(f"{config_path} top level must be a JSON object")
    for role in REQUIRED_ROLES:
        role_obj = data.get(role)
        if not isinstance(role_obj, dict):
            fail(f"{config_path} missing required object key '{role}'")
        for slot in REQUIRED_SLOTS:
            value = role_obj.get(slot)
            if not isinstance(value, str) or not value.strip():
                fail(
                    f"{config_path} '{role}.{slot}' must be a non-empty "
                    f"string (an OpenRouter model id), got {value!r}"
                )
            if "/" not in value:
                fail(
                    f"{config_path} '{role}.{slot}' = {value!r} does not "
                    f"look like an OpenRouter model id (expected "
                    f"'<vendor>/<model>[:free]' shape, e.g. "
                    f"'cohere/north-mini-code:free')"
                )
    return data


def all_configured_ids(data: dict) -> dict:
    """Return {id: 'role.slot'} for every id in the config -- discovery, not
    a hand-list. Iterating REQUIRED_ROLES/REQUIRED_SLOTS (key names) is not
    the same defect as hand-listing model ids: adding a new role/slot to the
    schema is a deliberate, reviewed change to what's tracked, whereas the
    dead-id rot came from ids themselves being copy-pasted and forgotten."""
    out = {}
    for role in REQUIRED_ROLES:
        for slot in REQUIRED_SLOTS:
            out[data[role][slot]] = f"{role}.{slot}"
    return out


def check_config_shape(config_path: Path) -> None:
    load_config(config_path)
    print(f"PASS: {config_path} has valid shape (dev_fast/qa_fast each "
          f"have default+fallback ids)")


def check_vendor_distinct(config_path: Path) -> None:
    """Preserve the deliberate cross-vendor QA design already documented in
    rules.md ('@qa-fast intentionally uses a different vendor than
    @dev-fast so QA reviews code with a distinct model family'). Shape
    check on the vendor prefix (text before the first '/'), not on which
    vendors specifically -- survives catalog churn same as the other checks."""
    data = load_config(config_path)
    dev_vendor = data["dev_fast"]["default"].split("/", 1)[0]
    qa_vendor = data["qa_fast"]["default"].split("/", 1)[0]
    if dev_vendor == qa_vendor:
        fail(
            f"dev_fast.default and qa_fast.default are both vendor "
            f"'{dev_vendor}' -- rules.md's cross-vendor QA design requires "
            f"@qa-fast to run a different model family than @dev-fast so "
            f"review is not self-review. Pick a qa_fast.default from a "
            f"different vendor prefix."
        )
    print(f"PASS: dev_fast default vendor ({dev_vendor!r}) and qa_fast "
          f"default vendor ({qa_vendor!r}) are distinct")


def fetch_catalog(endpoint: str) -> tuple[list | None, str | None]:
    """Return (list_of_model_dicts, None) on success, or (None, skip_reason).
    Alembic itself answers HTTP 200 even when the upstream fetch failed
    (upstream errors surface inside the JSON body, e.g. {"error": {...}}),
    so SKIP_RESPONSE covers both a non-JSON body and a JSON body that lacks
    a usable "data" list -- not just transport-level failures.

    Deliberately sends no `Accept: application/json` header: Alembic's
    default (no Accept override) passes the fetched page through as plain
    text with a leading "# API Response: <url>" comment line before the
    JSON body. Sending `Accept: application/json` instead makes Alembic
    wrap the response in ITS OWN envelope ({"title", "content", "metadata",
    ...} with the real payload serialized as a string inside "content") --
    a different, nested shape that this parser does not (and should not)
    special-case. Verified live 2026-08-15: identical request differing
    only in that header returns two structurally different bodies."""
    req = urllib.request.Request(endpoint)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = resp.read()
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
        return None, SKIP_CONNECTION

    text = raw.decode("utf-8", errors="replace")
    brace = text.find("{")
    if brace == -1:
        return None, SKIP_RESPONSE
    try:
        parsed = json.loads(text[brace:])
    except json.JSONDecodeError:
        return None, SKIP_RESPONSE
    if not isinstance(parsed, dict):
        return None, SKIP_RESPONSE
    models = parsed.get("data")
    if not isinstance(models, list) or not models:
        return None, SKIP_RESPONSE
    return models, None


def check_catalog_live(config_path: Path, endpoint: str) -> None:
    data = load_config(config_path)
    wanted = all_configured_ids(data)  # {id: "role.slot"} -- from config only

    models, skip_reason = fetch_catalog(endpoint)
    if models is None:
        if skip_reason == SKIP_RESPONSE:
            skip(
                "Alembic proxy answered but the response could not be used "
                "as an OpenRouter catalog (non-JSON body, or missing/empty "
                "'data' list) -- catalog-liveness check skipped (unknown, "
                "not stale)."
            )
        else:
            skip(
                "Alembic proxy not reachable at "
                f"{endpoint.split('/https://', 1)[0]} -- catalog-liveness "
                "check skipped (unknown, not stale). Start the Alembic "
                "proxy to get real coverage."
            )
        return  # unreachable in practice (skip() exits), kept for clarity

    by_id = {m.get("id"): m for m in models if isinstance(m, dict)}
    dead, priced, no_tools = [], [], []
    for model_id, where in wanted.items():
        entry = by_id.get(model_id)
        if entry is None:
            dead.append(f"{model_id} ({where})")
            continue
        pricing = entry.get("pricing") or {}
        prompt_price = pricing.get("prompt")
        completion_price = pricing.get("completion")
        if str(prompt_price) not in ("0", "0.0") or str(completion_price) not in ("0", "0.0"):
            priced.append(f"{model_id} ({where}) pricing={pricing!r}")
            continue
        supported = entry.get("supported_parameters") or []
        if "tools" not in supported:
            no_tools.append(f"{model_id} ({where})")

    problems = []
    if dead:
        problems.append(f"absent from live catalog: {dead}")
    if priced:
        problems.append(f"no longer free (pricing != 0/0): {priced}")
    if no_tools:
        problems.append(f"no longer support tool calls: {no_tools}")

    if problems:
        fail(
            "configured free-tier model id(s) failed live-catalog "
            "verification -- " + "; ".join(problems) + ". Re-verify "
            f"https://openrouter.ai/api/v1/models (via Alembic) and update "
            f"{config_path}, per rules.md § Catalog Churn."
        )
    print(
        f"PASS: all {len(wanted)} configured free-tier model id(s) "
        f"(discovered from {config_path}) are live, free, and tool-capable"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "case",
        choices=["config_shape", "vendor_distinct", "catalog_live"],
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    args = parser.parse_args()

    config_path = Path(args.config)
    if args.case == "config_shape":
        check_config_shape(config_path)
    elif args.case == "vendor_distinct":
        check_vendor_distinct(config_path)
    elif args.case == "catalog_live":
        check_catalog_live(config_path, args.endpoint)
    return 0


if __name__ == "__main__":
    sys.exit(main())
