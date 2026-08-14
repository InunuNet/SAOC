#!/usr/bin/env bash
# verify_f8_agent_report_back.sh -- sandboxed + read-only scenarios for
# mission verification-integrity F8 (GH #1315: agents finish work, write
# real output to disk, then go idle as "available" WITHOUT sending their
# deliverable to the orchestrator).
#
# Defect: none of the ten canonical agent role templates in .agent/agents/
# contain any instruction that an agent's final act before finishing is to
# SendMessage its deliverable to the orchestrator. Verified at authoring
# time: `grep -ril "sendmessage" .agent/agents/*.md` returns zero hits.
# The suggested fix from #1315 ("bake it into every agent role template")
# was never implemented as of commit 8b33098.
#
# Fix under test must:
#   1. Add a "## Report Back" section to all 10 canonical templates in
#      .agent/agents/, each naming the deliverable specific to that role
#      (a @qa report is not a @dev report), instructing SendMessage before
#      going idle, and naming "going idle without reporting" as incomplete.
#   2. Because execution/sync_agents.sh is explicitly NON-DESTRUCTIVE for
#      already-existing .claude/agents/*.md and .gemini/agents/*.md (it
#      SKIPs any target file that already exists -- see its header comment
#      and the per-file `if [ -f "$CLAUDE_TARGET" ]` / `if [ -f
#      "$GEMINI_TARGET" ]` guards), running `make sync-agents` alone will
#      NOT propagate this fix into those already-tracked provider files.
#      The fix must therefore directly mirror the same Report Back content
#      into .claude/agents/*.md and .gemini/agents/*.md as well.
#   3. .anti/agents.json IS unconditionally regenerated (atomic rewrite)
#      every run of sync_agents.sh regardless of prior content, so once the
#      canonical templates are fixed, running `make sync-agents` correctly
#      propagates the Report Back content into .anti/agents.json.
#
# Sandbox scenarios (anti_json_sandbox_propagation, sync_agents_exits_zero)
# copy .agent/agents/*.md and execution/sync_agents.sh into a mktemp dir and
# run the real script there -- never touches the real repo's .claude/,
# .gemini/, or .anti/ directories. Other scenarios read real, already-
# tracked repo files directly (read-only, no mutation).
#
# Usage: verify_f8_agent_report_back.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

CASE="${1:-}"
AGENTS="analyst architect designer dev dev-fast docs lead maintainer qa qa-fast"

cleanup() { rm -rf "${SANDBOX:-}"; }
trap cleanup EXIT

# role_keyword AGENT -- the role-specific deliverable noun each template's
# Report Back section must mention (case-insensitive), tied to what that
# role's own Output Format legend already promises back.
role_keyword() {
    case "$1" in
        analyst) echo "findings" ;;
        architect) echo "contract" ;;
        designer) echo "handoff" ;;
        dev) echo "changes" ;;
        dev-fast) echo "changes" ;;
        docs) echo "documented" ;;
        lead) echo "delegation" ;;
        maintainer) echo "backlog" ;;
        qa) echo "verdict" ;;
        qa-fast) echo "verdict" ;;
    esac
}

# check_report_back_dir DIR -- verifies every agent's file under DIR
# contains the "## Report Back" heading plus "SendMessage" plus "idle".
# Prints missing files to stderr. Returns 0 iff all 10 present.
check_report_back_dir() {
    local dir="$1" missing=0 f
    for a in $AGENTS; do
        f="$dir/$a.md"
        if [ ! -f "$f" ]; then
            echo "MISSING FILE: $f" >&2
            missing=1
            continue
        fi
        if ! grep -q "^## Report Back" "$f"; then
            echo "NO 'Report Back' heading: $f" >&2
            missing=1
        fi
        if ! grep -qi "sendmessage" "$f"; then
            echo "NO 'SendMessage' mention: $f" >&2
            missing=1
        fi
        if ! grep -qi "idle" "$f"; then
            echo "NO 'idle' mention: $f" >&2
            missing=1
        fi
    done
    return $missing
}

case "$CASE" in

  canonical_report_back_present)
    check_report_back_dir ".agent/agents"
    ;;

  claude_provider_report_back_present)
    check_report_back_dir ".claude/agents"
    ;;

  gemini_provider_report_back_present)
    check_report_back_dir ".gemini/agents"
    ;;

  role_specific_wording)
    fail=0
    for a in $AGENTS; do
        f=".agent/agents/$a.md"
        kw="$(role_keyword "$a")"
        [ -f "$f" ] || { echo "MISSING FILE: $f" >&2; fail=1; continue; }
        # Extract the Report Back section: from its heading to the next
        # "## " heading (or EOF), then check for the role's deliverable noun.
        section="$(awk '/^## Report Back/{flag=1; next} /^## /{flag=0} flag' "$f")"
        if [ -z "$section" ]; then
            echo "NO Report Back section body: $f" >&2
            fail=1
            continue
        fi
        if ! printf '%s' "$section" | grep -qi "$kw"; then
            echo "Report Back section in $f missing role keyword '$kw'" >&2
            fail=1
        fi
    done
    exit $fail
    ;;

  existing_sections_preserved)
    # Non-regression: the pre-existing "## Output Format" heading every
    # template already carries must survive the fix untouched.
    fail=0
    for a in $AGENTS; do
        f=".agent/agents/$a.md"
        [ -f "$f" ] || { echo "MISSING FILE: $f" >&2; fail=1; continue; }
        if ! grep -q "^## Output Format" "$f"; then
            echo "Output Format heading missing/damaged: $f" >&2
            fail=1
        fi
    done
    exit $fail
    ;;

  anti_json_sandbox_propagation)
    SANDBOX="$(mktemp -d)"
    mkdir -p "$SANDBOX/.agent/agents"
    cp .agent/agents/*.md "$SANDBOX/.agent/agents/"
    cp execution/sync_agents.sh "$SANDBOX/sync_agents.sh"
    ( cd "$SANDBOX" && bash sync_agents.sh >/dev/null 2>&1 )
    if [ ! -f "$SANDBOX/.anti/agents.json" ]; then
        echo ".anti/agents.json was not generated in sandbox" >&2
        exit 1
    fi
    count="$(python3 -c "import json,sys; d=json.load(open('$SANDBOX/.anti/agents.json')); print(sum(1 for a in d if 'sendmessage' in a.get('system_prompt','').lower()))")"
    if [ "$count" != "10" ]; then
        echo "expected 10 agents with SendMessage propagated into .anti/agents.json, got $count" >&2
        exit 1
    fi
    ;;

  sync_agents_exits_zero)
    SANDBOX="$(mktemp -d)"
    mkdir -p "$SANDBOX/.agent/agents"
    cp .agent/agents/*.md "$SANDBOX/.agent/agents/"
    cp execution/sync_agents.sh "$SANDBOX/sync_agents.sh"
    set +e
    ( cd "$SANDBOX" && bash sync_agents.sh >/dev/null 2>&1 )
    rc=$?
    set -e
    if [ "$rc" -ne 0 ]; then
        echo "sync_agents.sh exited $rc against fixed canonical templates" >&2
        exit 1
    fi
    python3 -m json.tool "$SANDBOX/.anti/agents.json" >/dev/null
    ;;

  close_out_composes_with_regenerated_anti_json)
    # Non-regression: F4's already-shipped denylist (execution/checks/
    # verify_f4_scope_guard.sh) must still correctly gate close-out when
    # .anti/agents.json is dirtied as a result of THIS mission's own F8
    # work -- refuse without the override, succeed with it.
    bash execution/checks/verify_f4_scope_guard.sh out_of_scope_blocks
    bash execution/checks/verify_f4_scope_guard.sh allow_override_works
    ;;

  *)
    echo "Usage: $0 {canonical_report_back_present|claude_provider_report_back_present|gemini_provider_report_back_present|role_specific_wording|existing_sections_preserved|anti_json_sandbox_propagation|sync_agents_exits_zero|close_out_composes_with_regenerated_anti_json}" >&2
    exit 2
    ;;
esac
