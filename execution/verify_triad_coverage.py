#!/usr/bin/env python3
"""verify_triad_coverage.py -- coverage linter for the verification triad.

Usage:
    python3 execution/verify_triad_coverage.py <contract.yaml>

Classifies the given contract as "UI/workflow" or "non-UI", then:
  - a UI/workflow contract must declare at least one assertion of each of the
    three triad kinds (codex_qa, browser_deployed_check, gws_inbox_check)
    somewhere in its assertion list -- exit 0 if it does, exit 1 if it does
    not (never a silent exit 0 on a missing triad).
  - a non-UI contract is exempt -- exit 0 unconditionally.
  - a contract file that cannot be found or parsed is a usage error -- exit 2,
    never treated as either compliant or non-UI by default.

Classification heuristic (golden spec, goldens/README.md design answer 5):
a contract is "UI/workflow" if ANY assertion's command/cmd/target string
contains a path-shaped reference under `app/` (this project's Next.js route
tree) -- e.g. "app/(marketing)/page.tsx" or "app/api/vendors/route.ts" -- OR
a literal URL on the deployed site (`https://saoc.co.za`, `https://beta.saoc.co.za`,
`http://nos.saoc.co.za/x`, host-boundary matched, case-insensitive). The URL
rule closes the dodge where a contract checks the live site by curl/browser
without ever naming an `app/` file. It looks only at which kinds are declared:
`required: false` triad assertions still satisfy the linter.

Known limitations (ship honestly, per project convention -- do not discover
these in production):
  - False negative, URLs: closed for literal `saoc.co.za` URLs. Still not
    detected: a URL built from a shell/env variable ("$SITE_URL/x"), a
    `localhost` URL, and a site reached through a helper script whose body
    holds the URL. A UI contract that only does any of those is invisible
    here.
  - False negative, no path: a UI contract that names neither an `app/`
    path nor a deployed-site URL (only a collection, an API route or a
    component name) is not flagged.
  - False positive: a non-UI contract whose shell command happens to contain
    the substring `app/` unrelated to the Next.js route tree (e.g. inside a
    quoted string or a comment) gets misclassified as UI/workflow and
    required to carry triad kinds it may not need.
This is a string-matching heuristic over assertion command/target text, not
semantic analysis of what a feature actually touches. It is a backstop
against a mission forgetting the rule, not a formal proof of coverage --
architect/orchestrator judgement (per workflow.md's existing chain) remains
the primary enforcement mechanism.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

APP_PATH_PATTERN = re.compile(r"\bapp/")
# Two parsers read the same text differently, and an assertion may hand it to either, so a URL is
# the deployed site when EITHER reading names a SAOC host (the linter fails closed):
#   - RFC 3986, as curl reads it: only `//` opens the authority and `\` is an ordinary byte, so
#     curl sends `https://evil.com\@saoc.co.za/x` to saoc.co.za (userinfo `evil.com\`). The
#     authority (up to a path/query/fragment or a character that ends a URL in shell text) is
#     parsed, never pattern-matched, so `saoc.co.za:443@evil.com` cannot masquerade as the host.
#   - WHATWG, as a browser reads it: not re-implemented here. Every URL-shaped candidate is handed
#     to Node's own `new URL()` (one batched call per contract), which applies the backslash,
#     slash-run, userinfo (`user;@host`), tab/LF/CR deletion, percent-decoding and IDNA rules.
#     The shell decides where an argument ends, so each candidate is cut at every character that
#     can end it (a quote, `;`, `|`, ...) as well as at whitespace, and the text with ASCII
#     tab/LF/CR deleted is scanned too; any one cut that reaches SAOC is enough.
_URL_STOP = r"\s?#'\"`;|&,<>\]})("
CURL_AUTHORITY_PATTERN = re.compile(rf"https?://([^/{_URL_STOP}]*)", re.IGNORECASE)
WHATWG_SCHEME_PATTERN = re.compile(r"https?:", re.IGNORECASE)
WHATWG_RUN_END = re.compile(r"\s")
WHATWG_CUT_CHARS = frozenset("'\"`;|&,<>(){}[]")
WHATWG_DELETED_CHARS = re.compile(r"[\t\n\r]")
WHATWG_RESOLVER = (
    "const input = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
    "process.stdout.write(JSON.stringify(input.map((c) => {"
    " try { return new URL(c).hostname; } catch { return null; } })));"
)
NODE_TIMEOUT_SECONDS = 30
DEPLOYED_DOMAIN = "saoc.co.za"
TRIAD_KINDS = ("codex_qa", "browser_deployed_check", "gws_inbox_check")

# Tri-state shape signal for iter_assertions_with_shape()/assertion_kind().
# Which top-level field (if any) contract.py's own normalize_contract()
# promotes into verify.kind is a property of the SHAPE an assertion came
# from, not a plain checks-vs-not boolean -- a boolean cannot distinguish
# "plain assertions: list item" (contract.py never reads a top-level field
# for these) from "phases: {...} dict item" (contract.py DOES promote
# top-level `kind`, but only when `verify` is absent or a bare string; see
# contract.py's phases-dict branch). Collapsing those two into one False
# value is exactly the defect the Codex GPT-5.5 pass caught (mission
# verification-triad-gate M2/F2, contract-f2.yaml A10).
SHAPE_CHECKS = "checks"
SHAPE_LIST = "list"
SHAPE_PHASES = "phases"


def usage_error(message: str) -> int:
    print(f"verify_triad_coverage.py: {message}", file=sys.stderr)
    return 2


def load_contract(path: str):
    p = Path(path)
    if not p.exists():
        return None, f"contract file not found: {path}"
    try:
        import yaml
        with open(p) as f:
            data = yaml.safe_load(f)
    except ImportError:
        return None, "PyYAML is required to parse contract.yaml files"
    except Exception as exc:
        return None, f"failed to parse {path}: {exc}"
    if not isinstance(data, dict):
        return None, f"contract {path} did not parse to a mapping"
    return data, None


def iter_assertions_with_shape(contract: dict):
    """Yield (assertion, shape) pairs, tolerating all three shapes this
    project's contracts are authored in -- this linter runs standalone
    against author-written contract files, before contract.py's own
    normalize_contract() has touched them.

    shape is one of SHAPE_CHECKS, SHAPE_LIST, or SHAPE_PHASES, and encodes
    exactly which top-level field (if any) contract.py's own
    normalize_contract() promotes into verify.kind for that shape:
      - SHAPE_CHECKS: the @architect `assertions: {checks: [...]}` dict
        shape. contract.py synthesizes verify.kind from the item's
        top-level `type` (`check.get("type", "shell")`).
      - SHAPE_LIST: a plain `assertions:` LIST item. contract.py passes
        this through untouched -- no top-level field is ever read into
        verify.kind.
      - SHAPE_PHASES: an item from the raw `phases: {...}` dict shape.
        contract.py synthesizes verify.kind from the item's top-level
        `kind` (`a.get("kind", "shell")`), but ONLY when the item's
        `verify` field is absent or a bare string -- if `verify` is
        already a dict, contract.py uses it as-is and never reads
        top-level `kind` at all.
    A two-valued from_checks_shape boolean cannot distinguish SHAPE_LIST
    from SHAPE_PHASES -- collapsing them let a fix for one shape either
    miss the other (false negative) or over-credit it (false positive,
    letting a plain-list item's decorative top-level `kind` masquerade as
    triad coverage the gate never actually executes it as). See
    assertion_kind() for how each shape is scored.
    """
    assertions_raw = contract.get("assertions", [])
    if isinstance(assertions_raw, dict) and "checks" in assertions_raw:
        for assertion in assertions_raw.get("checks", []):
            yield assertion, SHAPE_CHECKS
    elif isinstance(assertions_raw, list):
        for assertion in assertions_raw:
            yield assertion, SHAPE_LIST

    # Raw author-written `phases: {<phase_key>: [{id, verify/kind/cmd, ...}]}` dict shape --
    # the same shape contract.py's own normalize_contract() detects via
    # `isinstance(c.get("phases"), dict)` and folds into its internal assertions list. This
    # linter runs standalone against author-written files, before that normalization ever
    # happens, so it must recognise the SAME raw key (`phases`) contract.py reads -- not a
    # `phases_raw` key, which is only ever a local variable inside normalize_contract() and is
    # never written back onto the contract dict. Reading a nonexistent `phases_raw` key here
    # made every phases-dict-only contract (no top-level `assertions:` key at all) invisible to
    # this linter, silently misclassified as non-UI ("EXEMPT") instead of correctly seeing its
    # app/ references and triad-kind declarations.
    #
    # Gated on `not contract.get("assertions")`, mirroring contract.py:131-132's own
    # condition exactly. contract.py only folds `phases:` entries into the assertions
    # list it actually executes when a truthy top-level `assertions:` is absent -- if
    # `assertions:` is present, every `phases:` entry is discarded and never runs. An
    # unconditional yield here credited discarded phases entries as if they were real
    # triad coverage: a contract with one bare shell check under `assertions:` and three
    # decorative triad entries under `phases:` would run only the shell check and zero
    # triad checks, while this linter still reported PASS. Using the same falsy check as
    # contract.py (not `"assertions" not in contract`) matters too -- an explicit
    # `assertions: []` is falsy, so contract.py DOES use the phases entries in that case,
    # and so must this linter.
    if not contract.get("assertions"):
        phases_raw = contract.get("phases")
        if isinstance(phases_raw, dict):
            for phase_items in phases_raw.values():
                for assertion in (phase_items or []):
                    yield assertion, SHAPE_PHASES


def iter_assertions(contract: dict):
    """Yield each assertion dict, shape-agnostic -- for callers (like the
    app/ path scan) that only need the assertion's text fields and don't
    care which shape it came from."""
    for assertion, _shape in iter_assertions_with_shape(contract):
        yield assertion


def assertion_text_fields(assertion: dict):
    """All string fields on one assertion that might carry an app/ path or a
    triad-kind marker: command/cmd/target at the top level, and the same
    inside a nested verify: block (either shape appears across this
    project's contracts)."""
    fields = []
    for key in ("command", "cmd", "target"):
        val = assertion.get(key)
        if isinstance(val, str):
            fields.append(val)
    verify = assertion.get("verify")
    if isinstance(verify, dict):
        for key in ("cmd", "target"):
            val = verify.get(key)
            if isinstance(val, str):
                fields.append(val)
    return fields


def assertion_kind(assertion: dict, shape: str = SHAPE_LIST) -> str:
    """The declared kind for one assertion, recognising exactly the key(s)
    contract.py itself actually normalises/reads for THIS assertion's shape
    -- never a lookalike key contract.py ignores in that shape.

    contract.py's gate execution (check_cmd) reads ONLY
    assertion["verify"]["kind"] at run time -- see contract.py:159 (`kind =
    verify.get("kind", "")`). So `verify.kind` is always credited, for every
    shape.

    A top-level key can also feed into verify.kind, but only via
    normalize_contract(), and the field it reads plus the condition under
    which it reads it are both shape-specific -- this is why `shape` must be
    tri-state, not a boolean:

      - SHAPE_CHECKS (@architect `assertions: {checks: [...]}` dict format):
        normalize_contract() reads `check.get("type", "shell")` and
        synthesizes `verify: {kind: ...}` from it unconditionally. Top-level
        `type` is credited here, always.

      - SHAPE_PHASES (raw `phases: {...}` dict format, contract.py:118-122):
        normalize_contract() reads `a.get("kind", "shell")` and synthesizes
        `verify: {kind: ...}` from it, but ONLY when the item's raw `verify`
        field is absent (None) or a bare string -- if `verify` is already a
        dict, contract.py uses it as-is and never looks at top-level `kind`
        at all. Top-level `kind` is credited here only under that same
        condition, mirrored exactly: crediting it unconditionally would
        claim coverage contract.py doesn't actually execute whenever a
        phases-dict item pairs a top-level `kind` with an unrelated nested
        `verify:` dict.

      - SHAPE_LIST (a plain `assertions:` LIST item): passed through
        untouched by normalize_contract() -- neither top-level `type` nor
        top-level `kind` is ever read by contract.py for it. Crediting
        either here would let a contract carry e.g. a decorative top-level
        `kind: browser_deployed_check` with no matching `verify.kind`, pass
        this linter as triad-covered, and have the gate execute that
        assertion as a bare, uncovered shell check -- the exact masquerade
        this linter exists to prevent. Neither top-level field is ever
        credited for SHAPE_LIST.
    """
    verify = assertion.get("verify")
    if isinstance(verify, dict) and verify.get("kind"):
        return str(verify["kind"])
    if shape == SHAPE_CHECKS:
        val = assertion.get("type")
        if isinstance(val, str):
            return val
    elif shape == SHAPE_PHASES:
        # Mirror contract.py's exact synthesis condition: only when `verify`
        # is absent or a bare string does contract.py read top-level `kind`.
        if verify is None or isinstance(verify, str):
            val = assertion.get("kind")
            if isinstance(val, str):
                return val
    return "shell"


class WhatwgUnavailable(RuntimeError):
    """Node could not resolve the WHATWG reading; the linter must not guess."""


def is_deployed_host(host: str | None) -> bool:
    if not host:
        return False
    host = host.lower().rstrip(".")
    return host == DEPLOYED_DOMAIN or host.endswith("." + DEPLOYED_DOMAIN)


def curl_reaches_deployed(text: str) -> bool:
    """The RFC 3986 reading: the host after the last `@` of a `//` authority."""
    for match in CURL_AUTHORITY_PATTERN.finditer(text):
        try:
            host = urlsplit(f"//{match.group(1)}").hostname
        except ValueError:
            continue
        if is_deployed_host(host):
            return True
    return False


def whatwg_candidates(text: str) -> set[str]:
    """Every string a shell could hand a browser from `text`: from each `http(s):` up to each
    character that can end a shell word, and up to the next whitespace."""
    candidates = set()
    for reading in (text, WHATWG_DELETED_CHARS.sub("", text)):
        for match in WHATWG_SCHEME_PATTERN.finditer(reading):
            start = match.start()
            run_end = WHATWG_RUN_END.search(reading, start)
            stop = run_end.start() if run_end else len(reading)
            cuts = [index for index in range(match.end(), stop) if reading[index] in WHATWG_CUT_CHARS]
            candidates.update(reading[start:index] for index in cuts + [stop])
    return candidates


def whatwg_hosts(candidates: list[str]) -> list[str | None]:
    """Node's `new URL(c).hostname` for each candidate (None where it does not parse)."""
    node = shutil.which("node")
    if node is None:
        raise WhatwgUnavailable("node is not on PATH; the WHATWG URL reading needs it")
    try:
        result = subprocess.run(
            [node, "-e", WHATWG_RESOLVER], input=json.dumps(candidates),
            capture_output=True, text=True, timeout=NODE_TIMEOUT_SECONDS, check=True,
        )
        hosts = json.loads(result.stdout)
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        raise WhatwgUnavailable(f"node URL resolution failed: {type(exc).__name__}") from exc
    if not isinstance(hosts, list) or len(hosts) != len(candidates):
        raise WhatwgUnavailable("node URL resolution returned a malformed result")
    return hosts


def any_deployed_site_url(texts: list[str]) -> bool:
    """True when any text holds a URL that curl or a browser would send to saoc.co.za or a
    subdomain of it. The curl reading runs first; Node is called once for all the rest."""
    if any(curl_reaches_deployed(text) for text in texts):
        return True
    candidates = sorted(set().union(*(whatwg_candidates(text) for text in texts)))
    return bool(candidates) and any(is_deployed_host(host) for host in whatwg_hosts(candidates))


def is_deployed_site_url(text: str) -> bool:
    return any_deployed_site_url([text])


def is_ui_workflow_contract(contract: dict) -> bool:
    texts = []
    for assertion in iter_assertions(contract):
        if not isinstance(assertion, dict):
            continue
        texts.extend(assertion_text_fields(assertion))
    if any(APP_PATH_PATTERN.search(text) for text in texts):
        return True
    return any_deployed_site_url(texts)


def declared_kinds(contract: dict) -> set:
    kinds = set()
    for assertion, shape in iter_assertions_with_shape(contract):
        if isinstance(assertion, dict):
            kinds.add(assertion_kind(assertion, shape))
    return kinds


def main() -> int:
    if len(sys.argv) != 2:
        return usage_error("usage: verify_triad_coverage.py <contract.yaml>")

    contract, err = load_contract(sys.argv[1])
    if err is not None:
        return usage_error(err)

    try:
        ui_workflow = is_ui_workflow_contract(contract)
    except WhatwgUnavailable as exc:
        return usage_error(f"cannot classify {sys.argv[1]}: {exc}")
    if not ui_workflow:
        print(f"EXEMPT: {sys.argv[1]} does not reference an app/ path or a deployed-site URL -- non-UI, no triad required")
        return 0

    present = declared_kinds(contract)
    missing = [kind for kind in TRIAD_KINDS if kind not in present]
    if missing:
        print(f"FAIL: {sys.argv[1]} is a UI/workflow contract (references an app/ path or a deployed-site URL) "
              f"but is missing triad kind(s): {', '.join(missing)}")
        return 1

    print(f"PASS: {sys.argv[1]} is a UI/workflow contract and declares all triad kinds "
          f"({', '.join(TRIAD_KINDS)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
