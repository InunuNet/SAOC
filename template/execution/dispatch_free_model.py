#!/usr/bin/env python3
"""dispatch_free_model.py -- real, invocable dispatch mechanism for the
free-tier model tiers configured in .agent/config/free_models.json.

Problem this exists to fix (mission model-tier-repair F3, see
.agent/memory/project/specs/model-tier-repair/goldens/
f3_install_drift_and_dispatch_wiring.md): free_models.json (F2) is a
CONVENTION, not a MECHANISM -- nothing under execution/ read it at dispatch
time, so reaching a free-tier model meant hand-transcribing an id out of the
config into a manually-typed curl call, with no fallback-on-failure behavior.

This module turns that convention into a mechanism: dispatch(tier, prompt)
reads the tier's `default` id from free_models.json, calls it via
call_openrouter(), and on DispatchError automatically retries the tier's
`fallback` id before re-raising if both fail. No model id is ever hardcoded
here -- both are discovered from config at call time (same discipline F2
already enforces in verify_free_model_catalog.py).

Mechanism (rules.md § Two Routing Mechanisms, mechanism 1 -- direct API call):
non-Claude free models are dispatched via a direct call to OpenRouter's
Anthropic-compatible messages endpoint (https://openrouter.ai/api/v1/messages),
never through the Claude Code Agent tool's `model` param (which only accepts
the Claude enum sonnet/opus/haiku/fable and rejects OpenRouter ids client-side).

This is a direct, authenticated API call carrying a bearer secret to invoke a
model -- not a URL/content fetch -- so it deliberately does NOT go through the
Alembic proxy (.claude/rules/alembic.md covers GET/content retrieval, not
authenticated tool-call POSTs).

CLI usage:
    python3 execution/dispatch_free_model.py <dev_fast|qa_fast> "<prompt>" [--max-tokens N]

Reads OPENROUTER_API_KEY from the environment (never hardcoded, never logged).
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / ".agent" / "config" / "free_models.json"
OPENROUTER_MESSAGES_URL = "https://openrouter.ai/api/v1/messages"
DEFAULT_MAX_TOKENS = 1024
REQUEST_TIMEOUT_SECONDS = 60


class DispatchError(Exception):
    """Raised when a call to a single OpenRouter model id fails."""


def load_config(config_path: Path = DEFAULT_CONFIG_PATH) -> dict:
    """Read the tier -> {default, fallback} id mapping from free_models.json.

    Fails fast: a missing or malformed config file is a real defect, not
    something to silently paper over.
    """
    if not config_path.exists():
        raise DispatchError(f"config file not found: {config_path}")
    try:
        return json.loads(config_path.read_text())
    except json.JSONDecodeError as e:
        raise DispatchError(f"config file {config_path} is not valid JSON: {e}") from e


def call_openrouter(
    model_id: str,
    prompt: str,
    max_tokens: int,
    api_key: str,
) -> str:
    """Call OpenRouter's Anthropic-compatible messages endpoint for a single
    model id and return the response text.

    Raises DispatchError on any transport failure, non-2xx response, or a
    response shape we cannot extract text from -- dispatch() relies on this
    exception type to decide whether to retry the tier's fallback id.
    """
    payload = {
        "model": model_id,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        OPENROUTER_MESSAGES_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    # Everything from the network call through text extraction is one failure
    # domain: any of it failing means "this id didn't work, try the fallback."
    # The broad `except Exception` at the end is deliberate -- it converts the
    # *general property* "no exception but DispatchError may escape this
    # function" rather than an enumerated list of exception types, so a parse
    # failure mode nobody has named yet (a third malformed-response shape,
    # say) still degrades to a clean retry instead of an uncaught crash that
    # skips the fallback id entirely.
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            raw_body = response.read()
        body = json.loads(raw_body.decode("utf-8"))
        blocks = body["content"]
        text = "".join(block["text"] for block in blocks if block.get("type") == "text")
        if not text:
            raise DispatchError(f"OpenRouter call to {model_id} returned no text content")
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise DispatchError(f"OpenRouter call to {model_id} failed: HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise DispatchError(f"OpenRouter call to {model_id} failed: {e.reason}") from e
    except DispatchError:
        raise
    except Exception as e:
        raise DispatchError(
            f"OpenRouter call to {model_id} failed: {type(e).__name__}: {e}"
        ) from e
    return text


def dispatch(
    tier: str,
    prompt: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    config_path: Path = DEFAULT_CONFIG_PATH,
    api_key: Optional[str] = None,
) -> str:
    """Dispatch a prompt to a free-tier model, trying `default` first and
    automatically retrying `fallback` on DispatchError before re-raising.

    tier: a key in free_models.json, e.g. "dev_fast" or "qa_fast".
    api_key: OpenRouter API key. Required -- never read from environment
        implicitly inside this function, so callers control secret handling.
    """
    if not api_key:
        raise DispatchError("api_key is required (pass OPENROUTER_API_KEY)")

    config = load_config(config_path)
    if tier not in config:
        raise DispatchError(f"unknown tier {tier!r} -- not present in {config_path}")

    slots = config[tier]
    last_error: Optional[DispatchError] = None
    for slot in ("default", "fallback"):
        if slot not in slots:
            continue
        model_id = slots[slot]
        try:
            return call_openrouter(model_id, prompt, max_tokens, api_key)
        except DispatchError as e:
            last_error = e

    raise DispatchError(f"all slots failed for tier {tier!r}: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Dispatch a prompt to a free-tier OpenRouter model, "
        "with automatic fallback."
    )
    parser.add_argument("tier", choices=["dev_fast", "qa_fast"], help="Model tier to dispatch to")
    parser.add_argument("prompt", help="Prompt text to send")
    parser.add_argument(
        "--max-tokens", type=int, default=DEFAULT_MAX_TOKENS, help="Max response tokens"
    )
    args = parser.parse_args()

    import os

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("ERROR: OPENROUTER_API_KEY is not set", file=sys.stderr)
        return 1

    try:
        result = dispatch(args.tier, args.prompt, max_tokens=args.max_tokens, api_key=api_key)
    except DispatchError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
