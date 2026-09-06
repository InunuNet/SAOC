#!/usr/bin/env bash
# harness_heartbeat.sh — UserPromptSubmit hook.
# Injects a brief per-turn reminder: who the agent is, which workspace it runs
# in, which harness supplied the machinery, and (only when the workspace's own
# roster actually has them) the mandatory dispatch chain.
#
# scaffold-identity-integrity F2: this hook fires EVERY user turn, so a
# hardcoded "on the Athanor harness" told every scaffolded project it WAS the
# harness once per turn. Identity is now derived from .agent/profile.json with
# the WORKSPACE-file fallback full_boot.sh applies to the same file (D-F2-6),
# and the chain mandate is emitted only when the profile's declared roster
# contains ALL five chain agents. Profile/soul text is untrusted display input
# and is sanitized before interpolation (D-F2-7). The hook must ALWAYS exit 0
# with valid JSON — a failing UserPromptSubmit hook takes the user's turn.
set -uo pipefail

python3 - <<'EOF'
import json, pathlib, re

DEFAULT_HARNESS_NAME = 'Athanor'      # full_boot.sh's legacy fallback
CHAIN_AGENTS = {'architect', 'dev', 'qa', 'docs', 'maintainer'}
MAX_NAME_LEN = 120                    # D-F2-7 display cap
# Bound on the text the marker-strip loop works over. The loop is recursive by
# necessity (D-F2-9) and each pass is O(n), so a megabyte-scale nested payload
# in a workspace-editable file would otherwise cost minutes of CPU on EVERY
# user turn. Only the first MAX_NAME_LEN chars can ever be displayed, so a
# generous prefix bound is behaviour-preserving for any realistic name.
SANITIZE_WORK_LIMIT = 4096
RELAY_MARKER = 'ROOT COMMS REFIRE INPUT'


def sanitize(value):
    """Untrusted profile/soul text -> single-line, marker-free, capped display
    string. Non-strings are UNSET (never str()'d into the reminder)."""
    if not isinstance(value, str):
        return ''
    # Order is load-bearing (D-F2-9): normalize FIRST, strip the forbidden
    # token LAST, and iterate to a FIXPOINT over strip-then-collapse. A strip
    # that runs before the whitespace collapse is decorative — the collapse
    # reconstructs any interior-whitespace variant of the marker verbatim, and
    # a single non-recursive replace rebuilds a nested payload. Collapsing
    # inside the loop is equally load-bearing: removing a marker that sits
    # between two spaces leaves a whitespace run that a post-loop collapse
    # would join back into the marker, so the loop cannot exit until strip and
    # collapse together change nothing. Each pass is a fixpoint or strictly
    # shortens the string, so it terminates.
    cleaned = re.sub(r'[\x00-\x1f\x7f]', ' ', value)
    cleaned = re.sub(r'\s+', ' ', cleaned)[:SANITIZE_WORK_LIMIT]
    while True:
        new = re.sub(r'\s+', ' ', cleaned.replace(RELAY_MARKER, ''))
        if new == cleaned:
            break
        cleaned = new
    return cleaned.strip()[:MAX_NAME_LEN].strip()


def agent_name_of(value):
    """sanitize() plus the placeholder guard, shared by both name sources."""
    candidate = sanitize(value)
    if candidate and '[' not in candidate and '{{' not in candidate:
        return candidate
    return ''


profile = None
try:
    profile = json.loads(pathlib.Path('.agent/profile.json').read_text(encoding='utf-8-sig'))
    if not isinstance(profile, dict):
        profile = None
except Exception:
    profile = None

# Identity name — profile.json identity.agent_name first (the machine-written
# onboarding surface), legacy soul.md **Name**: regex as fallback.
agent_name = ''
if profile is not None:
    identity = profile.get('identity')
    if isinstance(identity, dict):
        agent_name = agent_name_of(identity.get('agent_name'))
if not agent_name:
    try:
        soul = pathlib.Path('.agent/identity/soul.md').read_text()
        m = re.search(r'\*\*Name\*\*:\s*(.+)', soul)
        if m:
            agent_name = agent_name_of(m.group(1))
    except Exception:
        pass

prefix = f"{agent_name} runs" if agent_name else "This agent runs"

# Workspace identity. A field counts only as a NON-EMPTY STRING; an unset
# project_name falls back to the WORKSPACE file's first line. That chain is a
# STRICT SUBSET of full_boot.sh's — it stops before basename($PWD), because a
# per-turn hook must not fabricate identity from a directory name; with no
# usable name the hook says identity is unknown.
project_name = ''
harness_name = ''
if profile is not None:
    project_name = sanitize(profile.get('project_name'))
    harness_name = sanitize(profile.get('harness_name'))
ws_name = ''
try:
    ws_lines = pathlib.Path('WORKSPACE').read_text(encoding='utf-8-sig').splitlines()
    ws_name = sanitize(ws_lines[0]) if ws_lines else ''
except Exception:
    ws_name = ''

# The DISPLAY name and the checkout VERDICT are separate concepts (D-F2-8).
display_project = project_name or ws_name
if harness_name:
    is_harness = display_project == harness_name
else:
    # Pre-backfill legacy state: adopt full_boot.sh's operand — the WORKSPACE
    # file's name against the literal legacy harness name, ignoring
    # project_name — so the two hooks cannot reach different verdicts about
    # the same workspace. With no WORKSPACE file, project_name is the last
    # operand; there is deliberately no basename($PWD) resort.
    harness_name = DEFAULT_HARNESS_NAME
    is_harness = (ws_name or project_name) == DEFAULT_HARNESS_NAME

if not display_project:
    identity_sentence = (
        "This agent runs on machinery supplied by the "
        f"{harness_name} harness — workspace identity is unknown until the "
        "workspace profile provides it."
    )
elif not is_harness:
    identity_sentence = (
        f"{prefix} in the {display_project} workspace, using machinery "
        f"supplied by the {harness_name} harness — the harness is "
        "tooling, not this project's identity."
    )
else:
    identity_sentence = f"{prefix} on the {harness_name} harness."

# Chain mandate — emitted IFF the profile parses AND its declared roster
# contains EVERY chain agent (full subset, not a sample). Otherwise a
# pointer, never silence.
roster = set()
if profile is not None:
    agents = profile.get('agents')
    if isinstance(agents, list):
        roster = {a.strip() for a in agents if isinstance(a, str)}
if CHAIN_AGENTS <= roster:
    workflow = (
        "Mandatory chain: classify → @architect (contract+goldens) → @dev → "
        "@qa → @docs → contract gate → @maintainer. "
        "You dispatch. Never implement directly. No contract = no @dev."
    )
else:
    workflow = "Consult AGENTS.md for this project's workflow."

autonomy = (
    "Default to autonomous action: act on your own recommendation instead of "
    "stopping to confirm it; ask the user only at genuine forks (irreversible "
    "or materially divergent choices) or platform-enforced gates."
)

reminder = f"{identity_sentence} {workflow} {autonomy}"

refire = ""
try:
    comms = pathlib.Path("comms.md")
    if comms.exists():
        text = comms.read_text(encoding="utf-8")
        m = re.search(r"^## Refire Input\n(?P<body>.*?)(?=\n## |\Z)", text, re.S | re.M)
        if m:
            body = re.sub(r"\n{3,}", "\n\n", m.group("body").strip())
            refire = body[:2500]
except Exception:
    refire = ""

additional = reminder
if refire:
    additional += "\n\n" + RELAY_MARKER + ":\n" + refire

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": additional
    }
}))
EOF
