#!/usr/bin/env python3
"""verify_f1_dispatch_docs.py -- static doc-consistency checks for mission
model-tier-repair F1 (dispatch-mechanism contradiction, RC-D).

Feature under test (docs only; no code changes expected):
  .agent/agents/dev-fast.md
  .agent/agents/qa-fast.md
  .agent/memory/project/rules.md

Empirically confirmed 2026-08-15 (mission notes, "F1 FINDING"): the Agent
tool's `model` param is a closed enum {sonnet, opus, haiku, fable}. Any
non-Claude OpenRouter model id (shape: contains "/", e.g.
"qwen/qwen3-coder:free") is rejected client-side before any API call.
rules.md's "Two Routing Mechanisms" section already documents this
correctly and names the two mechanisms that DO work for non-Claude free
models: (1) a direct OpenRouter API call, or (2) a `claude -p --model
<claude-id>` subprocess routed through OpenRouter. dev-fast.md/qa-fast.md
currently instruct the impossible Agent-tool form instead.

This checker asserts the SHAPE of the defect (an Agent(...) call whose
model= value looks like an OpenRouter id) rather than any specific model
name, and derives the "valid mechanism" markers dynamically FROM rules.md's
own text at check time -- it does not hardcode a second copy of the
mechanism description to compare against, so it cannot itself rot out of
sync with rules.md the way the two docs it is checking did.

Round 2 additions: the same impossible claim ("this non-Claude id IS the
Agent-tool-dispatchable model") can also appear as a frontmatter `model:`
key, or as body prose ("Default model: `<id>`") above the '## Routing'
section -- outside the window the original A1-A4 checks looked at. These
checks apply the same enum-membership test to those two additional shapes,
while carefully leaving alone the SAME id's legitimate appearance as the
payload of the documented curl/JSON call in '## Routing' -- that appearance
is the fix, not the defect.

Usage: verify_f1_dispatch_docs.py <case>
"""
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RULES_MD = REPO_ROOT / ".agent" / "memory" / "project" / "rules.md"
DEV_FAST_MD = REPO_ROOT / ".agent" / "agents" / "dev-fast.md"
QA_FAST_MD = REPO_ROOT / ".agent" / "agents" / "qa-fast.md"

# The Agent tool's model param is a closed enum -- confirmed live 2026-08-15.
# This is the ONLY hardcoded set in this checker, and it mirrors the error
# message's own "values" list, not a guess about which free models exist.
CLAUDE_ENUM = {"sonnet", "opus", "haiku", "fable"}

# Shape of an impossible dispatch: Agent(...model="<value>"...) where value
# is not a bare Claude enum word. OpenRouter ids always contain "/" (and
# usually ":free"), but we key on "not a Claude enum member" rather than on
# "/" alone so this doesn't silently miss a future non-slash non-enum value.
AGENT_CALL_MODEL_RE = re.compile(
    r"Agent\([^)]*?model\s*=\s*['\"]([^'\"]+)['\"]", re.DOTALL
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def read(path: Path) -> str:
    if not path.exists():
        fail(f"{path} does not exist")
    return path.read_text()


def routing_section(doc_text: str, doc_path: Path) -> str:
    """Extract the '## Routing' section body (up to the next '## ' heading)."""
    m = re.search(r"^## Routing\b(.*?)(?=^## |\Z)", doc_text, re.DOTALL | re.MULTILINE)
    if not m:
        fail(f"{doc_path} has no '## Routing' section to check")
    return m.group(1)


# ---------------------------------------------------------------------------
# Whole-file checks (round 2) -- the defect is not confined to '## Routing'.
# A doc can fix Routing perfectly and still assert, in frontmatter or in the
# prose above Routing, that a non-Claude OpenRouter id IS the agent's
# Agent-tool-dispatchable "model" / "default model". That claim is exactly as
# impossible as the Agent(...) form A1/A2 already catch -- it is the same
# defect in a different shape, so it gets the same enum-membership test.
#
# The critical distinction (do NOT flatten this): the SAME OpenRouter id is
# legitimately required elsewhere in the doc, as the payload of the direct
# curl/JSON call documented in '## Routing' (mechanism 1). That is not the
# defect -- it's the fix. So these checks only look at (a) the YAML
# frontmatter `model:` key, and (b) prose OUTSIDE fenced code blocks that
# grammatically declares an id as the "default"/"dispatch" model. Anything
# inside a fenced code block, or plain narrative mention of the id, is left
# alone on purpose -- flagging every appearance of the id would forbid the
# correct fix (rules.md itself mentions the id in the mech-1 code block).
# ---------------------------------------------------------------------------

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
FENCED_CODE_RE = re.compile(r"```.*?```", re.DOTALL)
BACKTICK_ID_RE = re.compile(r"`([\w.\-]+/[\w.\-]+(?::[\w.\-]+)?)`")
# "default model" / "dispatch model" / "dispatched model" etc. -- the
# grammatical shape of a claim that a given id IS the thing the Agent tool
# would dispatch, as opposed to a narrative mention ("uses `id` via a direct
# API call") or a payload example inside a code fence.
DEFAULT_MODEL_CLAIM_RE = re.compile(r"\b(default|dispatch)\w*\s+model\b", re.IGNORECASE)


def extract_frontmatter(doc_text: str, doc_path: Path) -> str:
    m = FRONTMATTER_RE.match(doc_text)
    if not m:
        fail(f"{doc_path} has no YAML frontmatter block to check")
    return m.group(1)


def frontmatter_model_value(frontmatter_text: str) -> str | None:
    """Return the value of a top-level `model:` key (not `model_tier:` or any
    other key merely containing "model"), or None if absent."""
    m = re.search(r"^model:\s*(.+?)\s*$", frontmatter_text, re.MULTILINE)
    if not m:
        return None
    return m.group(1).strip().strip("'\"")


def strip_fenced_code(doc_text: str) -> str:
    """Remove fenced code blocks entirely, so prose-only checks never see
    (and never need to special-case) a legitimate curl/JSON payload id."""
    return FENCED_CODE_RE.sub("", doc_text)


def check_frontmatter_model_key(doc_path: Path) -> None:
    text = read(doc_path)
    frontmatter = extract_frontmatter(text, doc_path)
    value = frontmatter_model_value(frontmatter)
    if value is not None and value not in CLAUDE_ENUM:
        fail(
            f"{doc_path} frontmatter `model:` key is set to {value!r}, a "
            f"non-Claude-enum value. In this repo's doc convention, a "
            f"frontmatter `model:` key names the Agent-tool-dispatchable "
            f"model -- and the Agent tool rejects any value outside "
            f"{sorted(CLAUDE_ENUM)!r} client-side. Remove the key, or "
            f"rename it to something that does not claim Agent-tool "
            f"dispatchability (e.g. document the free-tier id only inside "
            f"the '## Routing' curl/JSON example)."
        )
    print(f"PASS: {doc_path.name} frontmatter `model:` key does not assert "
          f"an impossible dispatch value")


def check_no_prose_default_model_claim(doc_path: Path) -> None:
    text = read(doc_path)
    # Frontmatter is checked separately (check_frontmatter_model_key) with
    # its own tailored message; drop it here so this check is prose-only.
    body = FRONTMATTER_RE.sub("", text, count=1)
    prose = strip_fenced_code(body)
    offenders = []
    for line in prose.splitlines():
        if not DEFAULT_MODEL_CLAIM_RE.search(line):
            continue
        for backtick_id in BACKTICK_ID_RE.findall(line):
            if backtick_id not in CLAUDE_ENUM:
                offenders.append(line.strip())
    if offenders:
        fail(
            f"{doc_path} prose declares a non-Claude id as the agent's "
            f"default/dispatch model outside any code example -- same "
            f"impossible claim as the Agent(...) form, different shape: "
            f"{offenders!r}. Describe the id as the payload of the direct "
            f"OpenRouter API call (see '## Routing'), not as a value the "
            f"agent dispatches directly."
        )
    print(f"PASS: {doc_path.name} prose contains no default/dispatch-model "
          f"claim naming a non-Claude id")


def find_impossible_dispatch_calls(section_text: str) -> list[str]:
    """Return Agent(...) model= values in section_text that are NOT a bare
    Claude enum member -- i.e. instructions to dispatch a non-Claude model
    id through the Agent tool's model param, which is rejected client-side."""
    bad = []
    for value in AGENT_CALL_MODEL_RE.findall(section_text):
        if value not in CLAUDE_ENUM:
            bad.append(value)
    return bad


def two_routing_mechanisms_section(rules_text: str) -> str:
    m = re.search(
        r"^### Two Routing Mechanisms\b(.*?)(?=^### |\Z)",
        rules_text,
        re.DOTALL | re.MULTILINE,
    )
    if not m:
        fail(f"{RULES_MD} has no '### Two Routing Mechanisms' section -- "
             "cannot derive valid-mechanism markers")
    return m.group(1)


def fenced_code_blocks(text: str) -> list[str]:
    return FENCED_CODE_RE.findall(text)


def derive_valid_mechanism_markers(mechanisms_text: str) -> dict:
    """Pull the identifying markers for each of the two valid mechanisms
    directly out of rules.md's own text, instead of hardcoding a second
    copy here that could drift out of sync with it."""
    api_url = re.search(r"https://openrouter\.ai/api/[\w/./-]*", mechanisms_text)
    has_curl = "curl" in mechanisms_text
    has_subprocess = "claude -p" in mechanisms_text and "--model" in mechanisms_text
    if not (api_url and has_curl):
        fail(f"{RULES_MD} § Two Routing Mechanisms does not describe the "
             "direct-OpenRouter-API-call mechanism (no openrouter.ai/api URL "
             "+ curl reference found) -- cannot derive mechanism-1 marker")
    if not has_subprocess:
        fail(f"{RULES_MD} § Two Routing Mechanisms does not describe the "
             "'claude -p --model' subprocess mechanism -- cannot derive "
             "mechanism-2 marker")
    return {
        "api_host": "openrouter.ai/api",
        "mech2_tokens": ("claude -p", "--model"),
    }


def doc_references_a_valid_mechanism(section_text: str, markers: dict) -> bool:
    """A doc "references a valid mechanism" only if the markers appear
    CO-LOCATED inside one fenced code block, not merely scattered anywhere in
    the section as loose tokens. A prior version of this check matched on
    substring presence anywhere in the section text; a word-salad Routing
    section that name-drops "curl" and "openrouter.ai/api" as prose (with no
    actual command) satisfied it. Requiring the markers to co-occur inside
    the same code fence forces an actual example, not a token mention --
    without hardcoding rules.md's own command text a second time here."""
    for block in fenced_code_blocks(section_text):
        mech1 = markers["api_host"] in block and "curl" in block
        mech2 = all(tok in block for tok in markers["mech2_tokens"])
        if mech1 or mech2:
            return True
    return False


def check_impossible_pattern_gone(doc_path: Path) -> None:
    text = read(doc_path)
    section = routing_section(text, doc_path)
    bad = find_impossible_dispatch_calls(section)
    if bad:
        fail(
            f"{doc_path} § Routing still instructs Agent(...) dispatch with "
            f"a non-Claude-enum model value {bad!r} -- this form is "
            f"rejected client-side (confirmed empirically, mission notes "
            f"'F1 FINDING'); it must be replaced with one of the two "
            f"mechanisms rules.md documents as actually working"
        )
    print(f"PASS: {doc_path.name} Routing section contains no impossible "
          f"Agent(...) dispatch instruction")


def check_consistent_with_rules(doc_path: Path) -> None:
    rules_text = read(RULES_MD)
    mech_section = two_routing_mechanisms_section(rules_text)
    markers = derive_valid_mechanism_markers(mech_section)

    doc_text = read(doc_path)
    section = routing_section(doc_text, doc_path)

    bad = find_impossible_dispatch_calls(section)
    if bad:
        fail(
            f"{doc_path} § Routing contradicts rules.md § Two Routing "
            f"Mechanisms: it instructs the impossible Agent(...) form "
            f"(model={bad!r}) that rules.md itself documents as "
            f"client-rejected"
        )

    if not doc_references_a_valid_mechanism(section, markers):
        fail(
            f"{doc_path} § Routing does not reference either mechanism "
            f"rules.md § Two Routing Mechanisms documents as working "
            f"(direct OpenRouter API call via curl to an "
            f"{markers['api_host']} endpoint, or a "
            f"'{' '.join(markers['mech2_tokens'])}' subprocess) -- the two "
            f"documents must describe the SAME dispatch mechanism"
        )
    print(f"PASS: {doc_path.name} § Routing is consistent with rules.md "
          f"§ Two Routing Mechanisms")


def main() -> int:
    if len(sys.argv) != 2:
        print(
            "ERROR: usage: verify_f1_dispatch_docs.py <case>\n"
            "Valid cases: impossible_pattern_gone_dev_fast, "
            "impossible_pattern_gone_qa_fast, dev_fast_consistent_with_rules, "
            "qa_fast_consistent_with_rules, frontmatter_model_key_dev_fast, "
            "frontmatter_model_key_qa_fast, no_prose_default_model_claim_dev_fast, "
            "no_prose_default_model_claim_qa_fast",
            file=sys.stderr,
        )
        return 1

    case = sys.argv[1]
    if case == "impossible_pattern_gone_dev_fast":
        check_impossible_pattern_gone(DEV_FAST_MD)
    elif case == "impossible_pattern_gone_qa_fast":
        check_impossible_pattern_gone(QA_FAST_MD)
    elif case == "dev_fast_consistent_with_rules":
        check_consistent_with_rules(DEV_FAST_MD)
    elif case == "qa_fast_consistent_with_rules":
        check_consistent_with_rules(QA_FAST_MD)
    elif case == "frontmatter_model_key_dev_fast":
        check_frontmatter_model_key(DEV_FAST_MD)
    elif case == "frontmatter_model_key_qa_fast":
        check_frontmatter_model_key(QA_FAST_MD)
    elif case == "no_prose_default_model_claim_dev_fast":
        check_no_prose_default_model_claim(DEV_FAST_MD)
    elif case == "no_prose_default_model_claim_qa_fast":
        check_no_prose_default_model_claim(QA_FAST_MD)
    else:
        print(f"ERROR: unknown case '{case}'", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
