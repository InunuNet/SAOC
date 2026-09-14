#!/usr/bin/env python3
"""verify_f3_dispatch_wiring.py -- checks for mission model-tier-repair F3.

F3 problem (see .agent/memory/project/specs/model-tier-repair/goldens/
f3_install_drift_and_dispatch_wiring.md for full reasoning):

  1. INSTALL DRIFT IS STILL LIVE, TODAY. F1 fixed the impossible
     Agent(model="<non-Claude id>", ...) dispatch pattern in CANONICAL
     .agent/agents/dev-fast.md / qa-fast.md. execution/sync_agents.sh skips
     regenerating a provider file that already exists (#1331), so that fix
     never reached the INSTALLED, actually-dispatched copies --
     .claude/agents/dev-fast.md / qa-fast.md still say (verified live at
     spec time): "Default model: `qwen/qwen3-coder:free` ... Dispatch via
     Agent tool with `model='qwen/qwen3-coder:free'`" -- the exact
     client-rejected form F1 removed from canonical. No existing check
     catches this: verify_f1_dispatch_docs.py only ever reads
     .agent/agents/*.md.

  2. free_models.json (F2) is a CONVENTION, NOT A MECHANISM -- nothing in
     execution/ reads it at dispatch time; a human must still hand-transcribe
     an id out of it into a curl/httpx call every time. F3 turns that
     convention into a real, invocable mechanism:
     execution/dispatch_free_model.py.

Cases in this file, in two groups:

  A. Static doc-shape checks against the INSTALLED files (mirrors
     verify_f1_dispatch_docs.py's approach, retargeted + extended):
       installed_impossible_pattern_gone_dev_fast
       installed_impossible_pattern_gone_qa_fast
       installed_consistent_with_rules_dev_fast
       installed_consistent_with_rules_qa_fast
       installed_references_dispatch_script_dev_fast
       installed_references_dispatch_script_qa_fast

  B. Checks against the new dispatch mechanism itself:
       dispatch_module_shape
       dispatch_module_fallback_behavior
       dispatch_fallback_discrimination_selftest   (runs now, no dependency
         on the module existing -- proves the harness in group B actually
         discriminates working fallback logic from broken fallback logic,
         using two tmp-dir reference implementations, never files in the
         repo)
       live_dispatch_smoke   (opt-in, exits 77 -- SKIP, not a false PASS --
         unless OPENROUTER_API_KEY is set; the M1 milestone-gate real-
         dispatch proof; costs one live free-tier OpenRouter call when it
         runs for real)
       live_dispatch_smoke_skip_is_reported_as_skip   (regression check:
         drives the REAL execution/contract.py against a sandboxed synthetic
         fixture to prove a live_dispatch_smoke skip is classified verdict
         "skip" and excluded from the pass count, not silently counted as a
         pass -- see AMENDMENT 2026-08-15 in the golden)

All SKIP paths in this file exit 77 (the autotools-convention skip signal
execution/contract.py:302 recognizes), never exit 0. Exit 0 would be
silently counted as PASS by contract.py -- this checker previously did
exactly that for live_dispatch_smoke and it was a real, reported bug, not a
style preference. Do not reintroduce "exit 0 for skip" here.

Usage: verify_f3_dispatch_wiring.py <case>
"""
import importlib.util
import json
import re
import sys
import tempfile
import textwrap
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RULES_MD = REPO_ROOT / ".agent" / "memory" / "project" / "rules.md"
INSTALLED_DEV_FAST_MD = REPO_ROOT / ".claude" / "agents" / "dev-fast.md"
INSTALLED_QA_FAST_MD = REPO_ROOT / ".claude" / "agents" / "qa-fast.md"
DISPATCH_MODULE = REPO_ROOT / "execution" / "dispatch_free_model.py"
DISPATCH_MODULE_REL = "execution/dispatch_free_model.py"
CONFIG_FILE = REPO_ROOT / ".agent" / "config" / "free_models.json"

CLAUDE_ENUM = {"sonnet", "opus", "haiku", "fable"}

AGENT_CALL_MODEL_RE = re.compile(
    r"Agent\([^)]*?model\s*=\s*['\"]([^'\"]+)['\"]", re.DOTALL
)
FENCED_CODE_RE = re.compile(r"```.*?```", re.DOTALL)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def skip(msg: str) -> None:
    # Exit 77 is the reserved autotools-convention skip signal execution/
    # contract.py:302 checks BEFORE comparing against expect_exit -- it
    # classifies verdict=skip distinctly from pass/fail (own summary column,
    # blocks the gate unless --allow-skips, hard-fails regardless when the
    # assertion is required:true). Exit 0 would instead be silently counted
    # as a PASS by contract.py -- exactly the false-positive @qa/the
    # orchestrator caught in this checker's first draft (contract-f3
    # AMENDMENT 2026-08-15, see the golden). Do not revert this to exit 0.
    print(f"SKIP: {msg}")
    sys.exit(77)


def ok(msg: str) -> None:
    print(f"PASS: {msg}")


def read(path: Path) -> str:
    if not path.exists():
        fail(f"{path} does not exist")
    return path.read_text()


def routing_section(doc_text: str, doc_path: Path) -> str:
    m = re.search(r"^## Routing\b(.*?)(?=^## |\Z)", doc_text, re.DOTALL | re.MULTILINE)
    if not m:
        fail(f"{doc_path} has no '## Routing' section to check")
    return m.group(1)


def find_impossible_dispatch_calls(section_text: str) -> list[str]:
    return [v for v in AGENT_CALL_MODEL_RE.findall(section_text) if v not in CLAUDE_ENUM]


# ---------------------------------------------------------------------------
# Group A: installed-file doc checks
# ---------------------------------------------------------------------------

def check_installed_impossible_pattern_gone(doc_path: Path) -> None:
    """RED today: installed dev-fast.md/qa-fast.md still document the
    Agent(model="<non-Claude id>", ...) form AND a "Default model: `<id>`"
    prose claim above Routing -- both the exact shapes F1 removed from
    canonical, never propagated here (#1331)."""
    text = read(doc_path)
    section = routing_section(text, doc_path)
    bad_calls = find_impossible_dispatch_calls(section)

    body_no_fence = FENCED_CODE_RE.sub("", text)
    prose_claim = re.search(
        r"Default model:\s*`([\w.\-]+/[\w.\-]+(?::[\w.\-]+)?)`", body_no_fence
    )
    bad_prose = (
        [prose_claim.group(1)]
        if prose_claim and prose_claim.group(1) not in CLAUDE_ENUM
        else []
    )

    if bad_calls or bad_prose:
        fail(
            f"{doc_path} (INSTALLED, authoritative copy) still documents an "
            f"impossible dispatch -- Agent(...) model={bad_calls!r}, prose "
            f"default-model claim={bad_prose!r}. This is the exact pattern "
            f"F1 already removed from the CANONICAL .agent/agents/{doc_path.name}; "
            f"it never propagated here because execution/sync_agents.sh "
            f"skips regenerating a provider file that already exists (#1331). "
            f"Fix the INSTALLED file directly -- do not rely on sync_agents.sh."
        )
    ok(f"{doc_path.name} (installed) contains no impossible Agent(...)/prose "
       f"dispatch claim")


def two_routing_mechanisms_section(rules_text: str) -> str:
    m = re.search(
        r"^### Two Routing Mechanisms\b(.*?)(?=^### |\Z)",
        rules_text, re.DOTALL | re.MULTILINE,
    )
    if not m:
        fail(f"{RULES_MD} has no '### Two Routing Mechanisms' section")
    return m.group(1)


def derive_valid_mechanism_markers(mechanisms_text: str) -> dict:
    api_url = re.search(r"https://openrouter\.ai/api/[\w/./-]*", mechanisms_text)
    has_curl = "curl" in mechanisms_text
    has_subprocess = "claude -p" in mechanisms_text and "--model" in mechanisms_text
    if not (api_url and has_curl):
        fail(f"{RULES_MD} § Two Routing Mechanisms does not describe the "
             "direct-API mechanism -- cannot derive marker")
    if not has_subprocess:
        fail(f"{RULES_MD} § Two Routing Mechanisms does not describe the "
             "subprocess mechanism -- cannot derive marker")
    return {"api_host": "openrouter.ai/api", "mech2_tokens": ("claude -p", "--model")}


def doc_references_a_valid_mechanism(section_text: str, markers: dict) -> bool:
    for block in FENCED_CODE_RE.findall(section_text):
        mech1 = markers["api_host"] in block and "curl" in block
        mech2 = all(tok in block for tok in markers["mech2_tokens"])
        if mech1 or mech2:
            return True
    return False


def check_installed_consistent_with_rules(doc_path: Path) -> None:
    rules_text = read(RULES_MD)
    markers = derive_valid_mechanism_markers(two_routing_mechanisms_section(rules_text))
    doc_text = read(doc_path)
    section = routing_section(doc_text, doc_path)

    bad = find_impossible_dispatch_calls(section)
    if bad:
        fail(f"{doc_path} (installed) § Routing still instructs the "
             f"impossible Agent(...) form (model={bad!r})")
    if not doc_references_a_valid_mechanism(section, markers):
        fail(f"{doc_path} (installed) § Routing does not reference either "
             f"mechanism rules.md documents as working")
    ok(f"{doc_path.name} (installed) § Routing is consistent with rules.md")


def check_installed_references_dispatch_script(doc_path: Path) -> None:
    """The install-drift fix must not just restate 'do a curl by hand' (that
    is F1's fix, already insufficient per the golden's 'convention vs
    mechanism' finding) -- it must point at the real, existing, invocable
    mechanism this feature adds: execution/dispatch_free_model.py. RED today:
    the file doesn't exist and nothing references it."""
    if not DISPATCH_MODULE.exists():
        fail(f"{DISPATCH_MODULE} does not exist yet -- cannot be referenced")
    text = read(doc_path)
    if DISPATCH_MODULE_REL not in text:
        fail(f"{doc_path} (installed) § Routing (or body) does not reference "
             f"'{DISPATCH_MODULE_REL}' -- the wired dispatch mechanism this "
             f"feature adds. A doc that only re-describes a hand-typed curl "
             f"command still leaves free_models.json a convention, not a "
             f"mechanism (F2's own stated limitation).")
    ok(f"{doc_path.name} (installed) references {DISPATCH_MODULE_REL}")


# ---------------------------------------------------------------------------
# Group B: the dispatch module itself
# ---------------------------------------------------------------------------

REQUIRED_SYMBOLS = ("dispatch", "call_openrouter", "DispatchError")


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[union-attr]
    return module


def check_dispatch_module_shape() -> None:
    """Shape check, not a live call: the module must exist, be importable,
    and expose the interface the golden specifies -- dispatch(tier, prompt,
    ...) that tries config[tier]['default'] then falls back to
    config[tier]['fallback'] via call_openrouter(), raising DispatchError on
    total failure. RED today: file does not exist."""
    if not DISPATCH_MODULE.exists():
        fail(f"{DISPATCH_MODULE} does not exist")
    module = load_module(DISPATCH_MODULE, "dispatch_free_model_shapecheck")
    missing = [s for s in REQUIRED_SYMBOLS if not hasattr(module, s)]
    if missing:
        fail(f"{DISPATCH_MODULE} is missing required symbol(s) {missing!r} "
             f"-- expected {REQUIRED_SYMBOLS!r}")
    src = DISPATCH_MODULE.read_text()
    if "openrouter.ai/api" not in src or "messages" not in src:
        fail(f"{DISPATCH_MODULE} does not appear to target the OpenRouter "
             f"Anthropic-compatible messages endpoint (no 'openrouter.ai/api' "
             f"+ 'messages' found in source)")
    if "free_models.json" not in src and "free_models" not in src:
        fail(f"{DISPATCH_MODULE} does not appear to read "
             f"{CONFIG_FILE.name} -- it must discover ids from config, "
             f"never hardcode them (same discipline as F2)")
    if "default" not in src or "fallback" not in src:
        fail(f"{DISPATCH_MODULE} source does not reference both 'default' "
             f"and 'fallback' config slots -- fallback-on-failure is a "
             f"required behavior, not optional")
    ok(f"{DISPATCH_MODULE_REL} exists, is importable, and has the required shape")


# Shared harness used by both the self-test (tmp fixtures) and the real-module
# check: given a loaded module exposing dispatch()/call_openrouter(), patch
# call_openrouter to fail on the "default" id and succeed on the "fallback"
# id, then assert dispatch() still returns the fallback's text. This proves
# actual fallback CONTROL FLOW executes, not merely that the words "default"
# and "fallback" appear in the file (that would be satisfied by prose alone).
def _run_fallback_harness(module) -> str:
    calls = []

    def fake_call_openrouter(model_id, prompt, max_tokens, api_key):
        calls.append(model_id)
        if model_id == "vendor-a/default-model:free":
            raise module.DispatchError(f"simulated failure for {model_id}")
        if model_id == "vendor-b/fallback-model:free":
            return "pong-from-fallback"
        raise AssertionError(f"unexpected model_id passed to call_openrouter: {model_id}")

    module.call_openrouter = fake_call_openrouter

    fake_config = {
        "dev_fast": {
            "default": "vendor-a/default-model:free",
            "fallback": "vendor-b/fallback-model:free",
        },
        "qa_fast": {
            "default": "vendor-a/default-model:free",
            "fallback": "vendor-b/fallback-model:free",
        },
    }
    orig_load_config = module.load_config
    module.load_config = lambda *a, **k: fake_config
    try:
        result = module.dispatch("dev_fast", "ping", max_tokens=8, api_key="test-key")
    finally:
        module.load_config = orig_load_config

    if calls != ["vendor-a/default-model:free", "vendor-b/fallback-model:free"]:
        raise AssertionError(f"expected default-then-fallback call order, got {calls!r}")
    if result != "pong-from-fallback":
        raise AssertionError(f"expected fallback response text, got {result!r}")
    return result


BROKEN_FIXTURE_SRC = textwrap.dedent(
    '''
    class DispatchError(Exception):
        pass

    def load_config(*a, **k):
        raise NotImplementedError

    def call_openrouter(model_id, prompt, max_tokens, api_key):
        raise NotImplementedError

    def dispatch(tier, prompt, max_tokens=1024, api_key=None):
        # BROKEN: does not fall back -- only ever tries the default id.
        config = load_config()
        model_id = config[tier]["default"]
        return call_openrouter(model_id, prompt, max_tokens, api_key)
    '''
)

CORRECT_FIXTURE_SRC = textwrap.dedent(
    '''
    class DispatchError(Exception):
        pass

    def load_config(*a, **k):
        raise NotImplementedError

    def call_openrouter(model_id, prompt, max_tokens, api_key):
        raise NotImplementedError

    def dispatch(tier, prompt, max_tokens=1024, api_key=None):
        config = load_config()
        slots = config[tier]
        last_err = None
        for slot in ("default", "fallback"):
            try:
                return call_openrouter(slots[slot], prompt, max_tokens, api_key)
            except DispatchError as e:
                last_err = e
        raise DispatchError(f"all slots failed for {tier}: {last_err}")
    '''
)


def check_dispatch_fallback_discrimination_selftest() -> None:
    """Proves _run_fallback_harness() actually discriminates: a broken
    reference implementation (no retry) must FAIL it, a correct one (retries
    fallback on DispatchError) must PASS it. Runs against two tmp-dir
    fixtures, never against files in the repo, and has no dependency on
    execution/dispatch_free_model.py existing -- runnable today, before F3
    is implemented, as evidence the group-B harness is not a rubber stamp."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        broken_path = tmp_path / "broken_dispatch.py"
        correct_path = tmp_path / "correct_dispatch.py"
        broken_path.write_text(BROKEN_FIXTURE_SRC)
        correct_path.write_text(CORRECT_FIXTURE_SRC)

        broken_module = load_module(broken_path, "broken_dispatch_fixture")
        correct_module = load_module(correct_path, "correct_dispatch_fixture")

        broken_failed_as_expected = False
        try:
            _run_fallback_harness(broken_module)
        except Exception as e:  # noqa: BLE001 -- deliberately broad, this IS the assertion
            broken_failed_as_expected = True
            broken_reason = str(e)
        if not broken_failed_as_expected:
            fail("discrimination self-test broken: the BROKEN fixture "
                 "(no fallback retry) passed the fallback harness -- the "
                 "harness does not actually discriminate working fallback "
                 "logic from broken fallback logic")

        try:
            _run_fallback_harness(correct_module)
        except Exception as e:  # noqa: BLE001
            fail(f"discrimination self-test broken: the CORRECT fixture "
                 f"(retries fallback on DispatchError) failed the fallback "
                 f"harness: {e}")

    ok(f"fallback-behavior harness discriminates correctly: broken fixture "
       f"failed ({broken_reason}), correct fixture passed")


def check_dispatch_module_fallback_behavior() -> None:
    """RED today: execution/dispatch_free_model.py does not exist. Once F3
    is implemented, this loads the REAL module and runs it through the same
    harness proven above -- the actual deliverable, not a fixture."""
    if not DISPATCH_MODULE.exists():
        fail(f"{DISPATCH_MODULE} does not exist")
    module = load_module(DISPATCH_MODULE, "dispatch_free_model_behaviorcheck")
    for sym in REQUIRED_SYMBOLS:
        if not hasattr(module, sym):
            fail(f"{DISPATCH_MODULE} missing required symbol '{sym}' -- "
                 f"cannot run fallback-behavior harness")
    try:
        result = _run_fallback_harness(module)
    except Exception as e:  # noqa: BLE001
        fail(f"{DISPATCH_MODULE} failed the fallback-behavior harness: {e}. "
             f"dispatch(tier, prompt, ...) must call call_openrouter() with "
             f"config[tier]['default'] first, and on DispatchError retry "
             f"with config[tier]['fallback'], returning its result.")
    ok(f"{DISPATCH_MODULE_REL} dispatch() correctly falls back from default "
       f"to fallback on simulated failure (result={result!r})")


# ---------------------------------------------------------------------------
# Error-isolation checks (added post-@qa-finding, 2026-08-15): the fallback
# harness above (_run_fallback_harness) only ever raises DispatchError
# explicitly -- it proves the RETRY works once an error is already classified
# as DispatchError, but it cannot see a raw transport/parse exception that
# bypasses classification entirely. @qa reproduced exactly that against the
# real dispatch_free_model.py: call_openrouter()'s try/except around the HTTP
# call only catches urllib.error.HTTPError/URLError/TimeoutError/OSError; the
# json.loads(response.read().decode("utf-8")) line inside the SAME try block
# can also raise json.JSONDecodeError or UnicodeDecodeError (a 200 response
# with a non-JSON body -- e.g. an HTML rate-limit/gateway page from a
# proxied free-tier backend -- is entirely realistic). Those exceptions are
# not DispatchError, so they escape call_openrouter() AND dispatch()'s
# `except DispatchError` retry loop untouched -- the fallback id is never
# attempted. These checks assert the GENERAL property (no exception type
# other than DispatchError may ever escape dispatch()) rather than
# enumerating today's two exception types, so a fix that catches
# JSONDecodeError/UnicodeDecodeError specifically but misses some future
# third parse-failure mode still passes -- and a fix that instead wraps the
# whole response-handling block broadly (e.g. `except Exception`) also
# passes, since only the OBSERVABLE exception type crossing dispatch()'s
# boundary is asserted, not the code shape used to prevent it.
# ---------------------------------------------------------------------------

GOOD_RESPONSE_BODY = json.dumps(
    {"content": [{"type": "text", "text": "pong-from-fallback"}]}
).encode("utf-8")
MALFORMED_JSON_BODY = b"<html><body>502 Bad Gateway</body></html>"
INVALID_UTF8_BODY = b"\xff\xfe\x00\x01\x02"


class _FakeHTTPResponse:
    """Minimal stand-in for the object urllib.request.urlopen() returns when
    used as a context manager -- just enough surface (.read(), __enter__,
    __exit__) for call_openrouter()'s `with urlopen(...) as response:`."""

    def __init__(self, data: bytes):
        self._data = data

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def read(self) -> bytes:
        return self._data


def _run_dispatch_with_stub_transport(module, bodies: list):
    """Runs module.dispatch() with urllib.request.urlopen and load_config
    stubbed -- no live network involved. bodies[i] is returned as the raw
    HTTP response body for the i-th call made (repeating the last entry if
    dispatch() makes more calls than len(bodies)). Returns
    (result_or_None, exception_or_None, number_of_http_calls_made)."""
    calls: list = []

    def fake_urlopen(request, timeout=None):
        idx = min(len(calls), len(bodies) - 1)
        calls.append(idx)
        return _FakeHTTPResponse(bodies[idx])

    fake_config = {
        "dev_fast": {
            "default": "vendor-a/default-model:free",
            "fallback": "vendor-b/fallback-model:free",
        },
    }

    orig_urlopen = urllib.request.urlopen
    orig_load_config = module.load_config
    urllib.request.urlopen = fake_urlopen
    module.load_config = lambda *a, **k: fake_config
    try:
        result = module.dispatch("dev_fast", "ping", max_tokens=8, api_key="test-key")
        return result, None, len(calls)
    except Exception as e:  # noqa: BLE001 -- capturing ANY exception type IS the assertion
        return None, e, len(calls)
    finally:
        urllib.request.urlopen = orig_urlopen
        module.load_config = orig_load_config


def _assert_falls_back_cleanly(module, bad_body: bytes, label: str) -> None:
    """default id's response is malformed (bad_body); fallback id's response
    is well-formed (GOOD_RESPONSE_BODY). Correct behavior: dispatch() must
    attempt the fallback and return its text -- never let the raw parse
    exception escape, and never give up after only one HTTP call."""
    result, exc, ncalls = _run_dispatch_with_stub_transport(module, [bad_body, GOOD_RESPONSE_BODY])
    if exc is not None and not isinstance(exc, module.DispatchError):
        raise AssertionError(
            f"{label}: a raw {type(exc).__name__} escaped dispatch() instead of being "
            f"classified as DispatchError -- call_openrouter() must catch response-parsing "
            f"failures (JSON decode, UTF-8 decode, unexpected shape) the same way it already "
            f"catches transport failures (HTTPError/URLError/TimeoutError/OSError), and raise "
            f"DispatchError so dispatch()'s retry loop can act on them: {exc}"
        )
    if exc is not None:
        raise AssertionError(
            f"{label}: dispatch() raised DispatchError even though the fallback slot's "
            f"response was well-formed -- fallback was never actually reached (only "
            f"{ncalls} HTTP call(s) made)"
        )
    if ncalls < 2:
        raise AssertionError(
            f"{label}: dispatch() returned {result!r} after only {ncalls} HTTP call(s) -- "
            f"the fallback slot was never attempted despite the default slot's response "
            f"being malformed (coincidentally correct output, wrong behavior)"
        )
    if result != "pong-from-fallback":
        raise AssertionError(f"{label}: expected fallback response text, got {result!r}")


def _assert_both_slots_failing_raises_dispatcherror(module, bad_body: bytes, label: str) -> None:
    """Both default and fallback ids return a malformed response. Correct
    behavior: dispatch() must raise DispatchError (a clean, catchable
    failure) -- never a raw parse exception."""
    result, exc, ncalls = _run_dispatch_with_stub_transport(module, [bad_body, bad_body])
    if exc is None:
        raise AssertionError(
            f"{label}: dispatch() returned {result!r} instead of raising, when both slots "
            f"returned a malformed response"
        )
    if not isinstance(exc, module.DispatchError):
        raise AssertionError(
            f"{label}: dispatch() raised a raw {type(exc).__name__} instead of DispatchError "
            f"when both slots failed: {exc}"
        )


def check_dispatch_error_isolation() -> None:
    """RED today (real defect, reported by @qa 2026-08-15, reproduced here
    independently): see module-level comment above this section for the full
    root cause. Exercises the REAL execution/dispatch_free_model.py against a
    malformed-JSON body and an invalid-UTF-8 body, both simulating a
    plausible 2xx response with an unparseable payload -- no live network."""
    if not DISPATCH_MODULE.exists():
        fail(f"{DISPATCH_MODULE} does not exist")
    module = load_module(DISPATCH_MODULE, "dispatch_free_model_isolationcheck")
    for sym in REQUIRED_SYMBOLS:
        if not hasattr(module, sym):
            fail(f"{DISPATCH_MODULE} missing required symbol '{sym}' -- cannot run "
                 f"error-isolation harness")
    try:
        _assert_falls_back_cleanly(module, MALFORMED_JSON_BODY, "malformed-JSON body")
        _assert_falls_back_cleanly(module, INVALID_UTF8_BODY, "invalid-UTF-8 body")
        _assert_both_slots_failing_raises_dispatcherror(
            module, MALFORMED_JSON_BODY, "both slots malformed"
        )
    except AssertionError as e:
        fail(f"{DISPATCH_MODULE}: {e}")
    ok(f"{DISPATCH_MODULE_REL} isolates transport/parse failures behind DispatchError -- "
       f"no raw exception escapes dispatch(), fallback is attempted correctly")


BROKEN_TRANSPORT_FIXTURE_SRC = textwrap.dedent(
    '''
    import json
    import urllib.error
    import urllib.request

    class DispatchError(Exception):
        pass

    def load_config(*a, **k):
        raise NotImplementedError

    def call_openrouter(model_id, prompt, max_tokens, api_key):
        request = urllib.request.Request("http://stub.invalid/messages", data=b"{}", method="POST")
        # BROKEN (mirrors the real, reported bug): only transport-level
        # exceptions are caught here. json.loads()/decode() failures are
        # NOT -- they escape this function and dispatch()'s retry loop
        # entirely.
        try:
            with urllib.request.urlopen(request, timeout=1) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise DispatchError(str(e)) from e
        except urllib.error.URLError as e:
            raise DispatchError(str(e)) from e
        except (TimeoutError, OSError) as e:
            raise DispatchError(str(e)) from e
        try:
            blocks = body["content"]
            text = "".join(b["text"] for b in blocks if b.get("type") == "text")
        except (KeyError, TypeError) as e:
            raise DispatchError(str(e)) from e
        return text

    def dispatch(tier, prompt, max_tokens=1024, config_path=None, api_key=None):
        config = load_config()
        slots = config[tier]
        last_error = None
        for slot in ("default", "fallback"):
            try:
                return call_openrouter(slots[slot], prompt, max_tokens, api_key)
            except DispatchError as e:
                last_error = e
        raise DispatchError(f"all slots failed for {tier}: {last_error}")
    '''
)

CORRECT_TRANSPORT_FIXTURE_SRC = textwrap.dedent(
    '''
    import json
    import urllib.error
    import urllib.request

    class DispatchError(Exception):
        pass

    def load_config(*a, **k):
        raise NotImplementedError

    def call_openrouter(model_id, prompt, max_tokens, api_key):
        request = urllib.request.Request("http://stub.invalid/messages", data=b"{}", method="POST")
        # CORRECT: response-parsing failures are classified as DispatchError
        # too, same as transport failures, so dispatch()'s retry loop can
        # act on them.
        try:
            with urllib.request.urlopen(request, timeout=1) as response:
                body = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise DispatchError(str(e)) from e
        except urllib.error.URLError as e:
            raise DispatchError(str(e)) from e
        except (TimeoutError, OSError) as e:
            raise DispatchError(str(e)) from e
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            raise DispatchError(f"unparseable response from {model_id}: {e}") from e
        try:
            blocks = body["content"]
            text = "".join(b["text"] for b in blocks if b.get("type") == "text")
        except (KeyError, TypeError) as e:
            raise DispatchError(str(e)) from e
        return text

    def dispatch(tier, prompt, max_tokens=1024, config_path=None, api_key=None):
        config = load_config()
        slots = config[tier]
        last_error = None
        for slot in ("default", "fallback"):
            try:
                return call_openrouter(slots[slot], prompt, max_tokens, api_key)
            except DispatchError as e:
                last_error = e
        raise DispatchError(f"all slots failed for {tier}: {last_error}")
    '''
)


def check_dispatch_error_isolation_discrimination_selftest() -> None:
    """Proves the harness above discriminates: a BROKEN reference
    implementation (mirrors today's real, reported bug -- catches only
    HTTPError/URLError/TimeoutError/OSError) must FAIL it; a CORRECT one
    (also catches JSONDecodeError/UnicodeDecodeError, wrapping them as
    DispatchError) must PASS it. Two tmp-dir fixtures, never repo files.
    Runnable independent of dispatch_free_model.py existing -- standing
    proof check_dispatch_error_isolation is not a rubber stamp."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        broken_path = tmp_path / "broken_transport.py"
        correct_path = tmp_path / "correct_transport.py"
        broken_path.write_text(BROKEN_TRANSPORT_FIXTURE_SRC)
        correct_path.write_text(CORRECT_TRANSPORT_FIXTURE_SRC)

        broken_module = load_module(broken_path, "broken_transport_fixture")
        correct_module = load_module(correct_path, "correct_transport_fixture")

        broken_failed = False
        broken_reason = ""
        try:
            _assert_falls_back_cleanly(broken_module, MALFORMED_JSON_BODY, "broken fixture")
        except AssertionError as e:
            broken_failed = True
            broken_reason = str(e)
        if not broken_failed:
            fail("discrimination self-test broken: the BROKEN transport fixture (does not "
                 "catch JSON/UTF-8 decode errors) passed the isolation harness -- the harness "
                 "does not actually discriminate the reported bug class")

        try:
            _assert_falls_back_cleanly(correct_module, MALFORMED_JSON_BODY, "correct fixture")
            _assert_falls_back_cleanly(correct_module, INVALID_UTF8_BODY, "correct fixture")
            _assert_both_slots_failing_raises_dispatcherror(
                correct_module, MALFORMED_JSON_BODY, "correct fixture"
            )
        except AssertionError as e:
            fail(f"discrimination self-test broken: the CORRECT transport fixture failed the "
                 f"isolation harness: {e}")

    ok(f"transport/parse isolation harness discriminates correctly: broken fixture failed "
       f"({broken_reason}), correct fixture passed")


def check_live_dispatch_smoke() -> None:
    """Opt-in only -- the M1 milestone-gate real-dispatch proof. Exits 77
    (SKIP, never a false PASS -- see the skip() docstring) when
    OPENROUTER_API_KEY is unset, so this never blocks an offline or
    unauthenticated gate run AND is never silently counted as a pass by
    execution/contract.py. When a key IS present, this makes one real
    free-tier OpenRouter call and asserts non-empty text came back -- the
    only check in F1-F3 that would have caught RC-D, per SPEC.md §4."""
    import os

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        skip("OPENROUTER_API_KEY not set -- live dispatch smoke test is "
             "opt-in and requires a real key; this is expected in CI/offline "
             "gate runs, run manually with the key set to exercise it")
    if not DISPATCH_MODULE.exists():
        fail(f"{DISPATCH_MODULE} does not exist -- cannot run live smoke test")
    module = load_module(DISPATCH_MODULE, "dispatch_free_model_livecheck")
    try:
        result = module.dispatch(
            "dev_fast", "Reply with exactly the single word: pong",
            max_tokens=8, api_key=api_key,
        )
    except Exception as e:  # noqa: BLE001
        fail(f"live dispatch to dev_fast tier raised: {e}")
    if not result or not result.strip():
        fail("live dispatch to dev_fast tier returned empty text")
    ok(f"live dispatch smoke test succeeded, response={result!r}")


# ---------------------------------------------------------------------------
# Regression check (added post-@qa/orchestrator finding, 2026-08-15): proves
# a live_dispatch_smoke skip is reported by the REAL execution/contract.py
# as verdict=skip -- not silently counted as verdict=pass. This is what
# migrating skip() from exit 0 to exit 77 exists to fix; without a check
# that actually drives contract.py, a future edit could reintroduce exit 0
# for a "SKIPs cleanly" case and nothing here would catch the regression
# (which is exactly how the original bug shipped -- "SKIP: ..." printed to
# stdout looked correct to a human reading the checker's own output, while
# contract.py silently scored it a pass).
#
# Mirrors execution/checks/verify_f1_skip_detection.sh's approach: drives
# the real contract.py against a SYNTHETIC fixture contract (never the real
# contract-f3.yaml) with CWD sandboxed to a fresh tmp dir, so
# .agent/memory/scratch/contract-results/ in the real repo is never touched.
# ---------------------------------------------------------------------------

def check_live_dispatch_smoke_skip_is_reported_as_skip() -> None:
    import os
    import subprocess
    import tempfile as _tempfile

    contract_py = REPO_ROOT / "execution" / "contract.py"
    checker_script = REPO_ROOT / "execution" / "checks" / "verify_f3_dispatch_wiring.py"
    if not contract_py.exists():
        fail(f"{contract_py} does not exist -- cannot drive the real gate for this regression check")

    with _tempfile.TemporaryDirectory() as sandbox:
        sandbox_path = Path(sandbox)
        fixture = sandbox_path / "fixture.yaml"
        fixture.write_text(
            "schema: athanor.contract/v1\n"
            "slug: f3-skip-regression-fixture\n"
            "goal: synthetic fixture -- proves live_dispatch_smoke's skip is reported as skip\n"
            "created_at: '2026-08-15'\n"
            "assertions:\n"
            "  phase: 4\n"
            "  checks:\n"
            "    - id: A1\n"
            "      description: live_dispatch_smoke without an API key\n"
            f"      command: python3 {checker_script} live_dispatch_smoke\n"
            "      required: false\n"
        )

        env = os.environ.copy()
        env.pop("OPENROUTER_API_KEY", None)  # this regression check must never use a real key

        check_result = subprocess.run(
            ["python3", str(contract_py), "check", str(fixture), "--assertion", "A1"],
            cwd=str(sandbox_path), env=env, capture_output=True, text=True, timeout=30,
        )
        if check_result.returncode != 0:
            fail(
                f"contract.py check exited {check_result.returncode} for a skip verdict "
                f"(expected 0 -- a skip verdict is not itself a check-invocation failure). "
                f"stdout+stderr: {(check_result.stdout + check_result.stderr)[:500]!r}"
            )
        combined = check_result.stdout + check_result.stderr
        if "SKIP A1 (shell): SKIP" not in combined:
            fail(
                f"contract.py did not report verdict=skip for A1 (expected the line "
                f"'SKIP A1 (shell): SKIP'). This means live_dispatch_smoke's skip is NOT being "
                f"recognized as exit 77 by contract.py -- got: {combined[:500]!r}"
            )

        gate_result = subprocess.run(
            ["python3", str(contract_py), "gate", str(fixture), "--phase", "4", "--allow-skips"],
            cwd=str(sandbox_path), env=env, capture_output=True, text=True, timeout=30,
        )
        gate_combined = gate_result.stdout + gate_result.stderr
        if "0 pass, 1 skip, 0 fail" not in gate_combined:
            fail(
                f"gate summary did not show the skip counted separately from pass (expected "
                f"'0 pass, 1 skip, 0 fail') -- got: {gate_combined[:500]!r}. If this instead "
                f"read '1 pass, 0 skip, 0 fail', the false-PASS regression this check exists to "
                f"catch has recurred."
            )

    ok("live_dispatch_smoke's skip is reported by the real contract.py as verdict=skip "
       "('SKIP A1 (shell): SKIP', gate summary '0 pass, 1 skip, 0 fail') -- never counted as "
       "a pass")


CASES = {
    "installed_impossible_pattern_gone_dev_fast":
        lambda: check_installed_impossible_pattern_gone(INSTALLED_DEV_FAST_MD),
    "installed_impossible_pattern_gone_qa_fast":
        lambda: check_installed_impossible_pattern_gone(INSTALLED_QA_FAST_MD),
    "installed_consistent_with_rules_dev_fast":
        lambda: check_installed_consistent_with_rules(INSTALLED_DEV_FAST_MD),
    "installed_consistent_with_rules_qa_fast":
        lambda: check_installed_consistent_with_rules(INSTALLED_QA_FAST_MD),
    "installed_references_dispatch_script_dev_fast":
        lambda: check_installed_references_dispatch_script(INSTALLED_DEV_FAST_MD),
    "installed_references_dispatch_script_qa_fast":
        lambda: check_installed_references_dispatch_script(INSTALLED_QA_FAST_MD),
    "dispatch_module_shape": check_dispatch_module_shape,
    "dispatch_module_fallback_behavior": check_dispatch_module_fallback_behavior,
    "dispatch_fallback_discrimination_selftest": check_dispatch_fallback_discrimination_selftest,
    "dispatch_error_isolation": check_dispatch_error_isolation,
    "dispatch_error_isolation_discrimination_selftest": check_dispatch_error_isolation_discrimination_selftest,
    "live_dispatch_smoke": check_live_dispatch_smoke,
    "live_dispatch_smoke_skip_is_reported_as_skip": check_live_dispatch_smoke_skip_is_reported_as_skip,
}


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in CASES:
        print(f"ERROR: usage: verify_f3_dispatch_wiring.py <case>\n"
              f"Valid cases: {sorted(CASES)}", file=sys.stderr)
        return 1
    CASES[sys.argv[1]]()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
