#!/usr/bin/env python3
"""verify_model_env_boot.py -- boot-time guard for mission model-tier-repair
F5 (#1332's residual risk: unset/invalid ANTHROPIC_DEFAULT_{HAIKU,SONNET,
OPUS}_MODEL overrides).

Feature under test: nothing in execution/ previously read these vars back
and validated them. F2/F4's verify_free_model_catalog.py validates
.agent/config/free_models.json (the ids execution/dispatch_free_model.py
uses for direct OpenRouter calls) -- a disjoint surface from the
ANTHROPIC_DEFAULT_*_MODEL vars Claude Code itself reads to resolve
model:haiku/sonnet/opus frontmatter for EVERY agent. docs/openrouter.md
already documents the live hazard in prose (an unexpanded self-referencing
literal in a settings env block breaks spawn for every model:haiku agent)
with zero mechanical enforcement before this script.

Three cases, config-vs-transient split:
  literal_unexpanded -- deterministic, no network. Scans the two settings
      JSON files' "env" blocks for a model var whose value is the literal
      self-referencing "$VARNAME" string (never shell-expanded by Claude
      Code). FAIL if found -- a config authoring mistake, never transient.
  empty_override -- deterministic, no network. Scans the live process
      environment (os.environ, not settings files) for those same vars set
      to an empty string. FAIL if found -- exported-but-empty is
      unambiguously broken.
  env_catalog_live -- the ONLY network-dependent case, and only attempted
      when ANTHROPIC_BASE_URL is OpenRouter-shaped AND at least one
      override is actually set and non-empty. Verifies the configured
      id(s) against OpenRouter's live catalog via the mandatory Alembic
      passthrough. Proxy unreachable -> SKIP (exit 77), never FAIL, mirrors
      verify_free_model_catalog.py's SKIP_CONNECTION doctrine verbatim.
      Catalog fetched and an id genuinely absent -> FAIL. Nothing
      configured to check -> trivial PASS with NO network attempt at all.
  boot_report -- runs all three together, for the full_boot.sh wiring.
      Always exits 0 regardless of sub-results: loud printing carries the
      signal at boot, not the exit code (full_boot.sh already wires this
      call non-fatally too, but boot_report is self-contained on this).

Do not hardcode any specific model id string in this file's executable
code or docstrings outside comment lines -- assert shape only (empty /
literal-unexpanded / absent-from-live-catalog), never a specific id. See
docs/openrouter.md for example ids if needed for reference.

All external fetching goes through the Alembic proxy (project mandate,
.claude/rules/alembic.md) -- default endpoint below is Alembic's
passthrough of OpenRouter's models endpoint, not a direct external call.

Usage: verify_model_env_boot.py <case> [--settings PATH]
       [--settings-local PATH] [--endpoint URL] [--timeout SECONDS]
Cases: literal_unexpanded, empty_override, env_catalog_live, boot_report
Exit codes: 0 pass, 1 fail, 2 invoked-wrong (argparse choices), 77 SKIP.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SETTINGS = REPO_ROOT / ".claude" / "settings.json"
DEFAULT_SETTINGS_LOCAL = REPO_ROOT / ".claude" / "settings.local.json"
DEFAULT_ENDPOINT = "http://localhost:7077/https://openrouter.ai/api/v1/models"
DEFAULT_TIMEOUT = 10.0

MODEL_VARS = (
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
)

SKIP_CONNECTION = "connection"  # proxy down/unreachable -- no response at all
SKIP_RESPONSE = "response"      # proxy answered, but the reply couldn't be used

# Set by warn() immediately before it returns, read by run_boot_report() right
# after each sequential sub-check call. The three boot_report sub-checks run
# strictly single-threaded, so a module-level flag is safe here -- this does
# not change warn()'s own return type/exit-code contract (still always 0).
_last_call_warned = False


def ok(msg: str) -> int:
    print(f"PASS: {msg}")
    return 0


def fail(msg: str) -> int:
    print(f"FAIL: {msg}")
    return 1


def skip(msg: str) -> int:
    # Exit 77 is the reserved autotools-convention skip signal
    # execution/contract.py:302 checks before comparing against expect_exit.
    # Mirrors verify_free_model_catalog.py's skip() doctrine verbatim.
    print(f"SKIP: {msg}")
    return 77


def warn(msg: str) -> int:
    # Advisory, not a failure -- always exits 0. Distinct prefix from PASS
    # so an OpenRouter-shaped-but-no-override steady state is visible
    # instead of blending into a quiet PASS line.
    global _last_call_warned
    _last_call_warned = True
    print(f"WARN: {msg}")
    return 0


def load_env_block(path: Path) -> dict:
    """Read the "env" object out of a Claude Code settings JSON file.
    Missing file, unparsable JSON, or a non-dict "env" all resolve to {}
    (nothing to check there) rather than an error -- settings.local.json in
    particular is commonly absent or empty on a native-Anthropic machine."""
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    env = data.get("env")
    if not isinstance(env, dict):
        return {}
    return env


def check_literal_unexpanded(settings_path: Path, settings_local_path: Path) -> int:
    problems = []
    for path in (settings_path, settings_local_path):
        env = load_env_block(path)
        for var in MODEL_VARS:
            value = env.get(var)
            if value == f"${var}":
                problems.append(f"{path}: env.{var} = '${var}' (unexpanded literal)")
    if problems:
        return fail(
            "self-referencing unexpanded env var literal(s) found -- Claude "
            "Code does not shell-expand settings env values, so this "
            "injects the literal string as the model id and breaks spawn "
            "for every agent using that tier (see docs/openrouter.md): "
            + "; ".join(problems)
        )
    return ok(
        f"no unexpanded self-referencing literals in {settings_path} / "
        f"{settings_local_path} env blocks"
    )


def check_empty_override() -> int:
    empty = []
    unexpanded = []
    for var in MODEL_VARS:
        value = os.environ.get(var, None)
        if value == "":
            empty.append(var)
        elif value is not None and value.startswith("$"):
            unexpanded.append(var)
    if empty or unexpanded:
        parts = []
        if empty:
            parts.append(
                f"env var(s) exported but set to an empty string: {empty} -- "
                "an empty override is unambiguously broken, not a valid "
                "'use the default' no-op"
            )
        if unexpanded:
            parts.append(
                f"env var(s) exported but holding an unexpanded literal "
                f"(starts with '$'): {unexpanded} -- Claude Code does not "
                "shell-expand live process env values, so this injects the "
                "literal string as the model id and breaks spawn for every "
                "agent using that tier (see docs/openrouter.md)"
            )
        return fail("; ".join(parts))
    return ok(
        "no ANTHROPIC_DEFAULT_*_MODEL var is set-but-empty or holding an "
        "unexpanded literal in the live process environment"
    )


def fetch_catalog(endpoint: str, timeout: float) -> tuple[list | None, str | None]:
    """Return (list_of_model_dicts, None) on success, or (None, skip_reason).
    Deliberately sends no Accept: application/json header -- see
    verify_free_model_catalog.py's fetch_catalog() for the documented
    reason (that header makes Alembic wrap the response in its own
    envelope instead of passing the catalog JSON through)."""
    req = urllib.request.Request(endpoint)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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


def check_env_catalog_live(endpoint: str, timeout: float) -> int:
    base_url = os.environ.get("ANTHROPIC_BASE_URL", "")
    overrides = {var: os.environ[var] for var in MODEL_VARS if os.environ.get(var)}

    if "openrouter" not in base_url.lower():
        # Native Anthropic -- nothing OpenRouter-shaped configured at all.
        # Must not touch the network at all in this branch (proven by the
        # wiring check's elapsed-time assertion).
        return ok(
            "native Anthropic config (ANTHROPIC_BASE_URL not OpenRouter-"
            "shaped) -- no network attempt made"
        )

    if not overrides:
        # OpenRouter-shaped base URL with no override set. This is the
        # normal post-setup_openrouter_config() steady state now that it no
        # longer writes ANTHROPIC_DEFAULT_*_MODEL -- advisory, not a
        # failure. Still must not touch the network in this branch.
        return warn(
            "OpenRouter-shaped ANTHROPIC_BASE_URL detected but no "
            "ANTHROPIC_DEFAULT_*_MODEL override is set -- fast-tier agents "
            "will fall back to Anthropic model ids against the OpenRouter "
            "endpoint unless you configure overrides manually (see "
            "docs/openrouter.md) -- no network attempt made"
        )

    models, skip_reason = fetch_catalog(endpoint, timeout)
    if models is None:
        if skip_reason == SKIP_RESPONSE:
            return skip(
                "Alembic proxy answered but the response could not be used "
                "as an OpenRouter catalog (non-JSON body, or missing/empty "
                "'data' list) -- catalog-liveness check skipped"
            )
        return skip(
            f"Alembic proxy not reachable at {endpoint} -- catalog-liveness "
            "check skipped (unknown, not stale). Start the Alembic proxy "
            "to get real coverage."
        )

    live_ids = {m.get("id") for m in models if isinstance(m, dict)}
    dead = [f"{var}={val!r}" for var, val in overrides.items() if val not in live_ids]
    if dead:
        return fail(
            "configured override id(s) absent from the live OpenRouter "
            "catalog: " + "; ".join(dead)
        )
    return ok(
        f"all {len(overrides)} configured ANTHROPIC_DEFAULT_*_MODEL "
        "override(s) verified present in the live catalog"
    )


def run_boot_report(
    settings_path: Path, settings_local_path: Path, endpoint: str, timeout: float
) -> int:
    """Runs all three cases for the full_boot.sh wiring. Always returns 0 --
    a genuine sub-case FAIL/SKIP is reported loudly (printed) but must never
    make the boot hook's own invocation nonzero; full_boot.sh wires this
    call non-fatally regardless, but boot_report is self-contained on this
    property so it behaves correctly even if invoked directly."""
    global _last_call_warned
    checks = (
        ("literal_unexpanded", lambda: check_literal_unexpanded(settings_path, settings_local_path)),
        ("empty_override", check_empty_override),
        ("env_catalog_live", lambda: check_env_catalog_live(endpoint, timeout)),
    )
    any_bad = False
    any_warn = False
    for name, run_check in checks:
        _last_call_warned = False
        rc = run_check()
        if _last_call_warned:
            any_warn = True
        if rc == 0:
            continue
        any_bad = True
        label = "SKIP" if rc == 77 else "FAIL"
        print(
            f"⛔ MODEL-ENV BOOT GUARD {label}: {name} -- see message "
            "above. ANTHROPIC_DEFAULT_*_MODEL may be misconfigured; see "
            "docs/openrouter.md."
        )
    if not any_bad and not any_warn:
        print("PASS: boot_report -- all model-env boot guard checks passed")
    elif not any_bad and any_warn:
        print(
            "WARN: boot_report -- model-env boot guard checks passed with "
            "warning(s); see WARN line(s) above"
        )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "case",
        choices=["literal_unexpanded", "empty_override", "env_catalog_live", "boot_report"],
    )
    parser.add_argument("--settings", default=str(DEFAULT_SETTINGS))
    parser.add_argument("--settings-local", default=str(DEFAULT_SETTINGS_LOCAL))
    parser.add_argument("--endpoint", default=DEFAULT_ENDPOINT)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    args = parser.parse_args()

    settings_path = Path(args.settings)
    settings_local_path = Path(args.settings_local)

    if args.case == "literal_unexpanded":
        return check_literal_unexpanded(settings_path, settings_local_path)
    if args.case == "empty_override":
        return check_empty_override()
    if args.case == "env_catalog_live":
        return check_env_catalog_live(args.endpoint, args.timeout)
    if args.case == "boot_report":
        return run_boot_report(settings_path, settings_local_path, args.endpoint, args.timeout)
    return 2  # unreachable -- argparse choices already rejects unknown cases


if __name__ == "__main__":
    sys.exit(main())
