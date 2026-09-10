#!/usr/bin/env bash
# verify_f5_quota_doctrine.sh -- retroactive verification for mission
# quota-aware-execution F5 (quota expenditure doctrine: "run to the wall,
# checkpoint every green step" replacing prior conserve/stop-early guidance).
#
# F5 was marked done doc-only in ec9b95f4 and never had a contract. This
# check is read-only against the real repo tree (rules.md, docs, hooks) --
# there is no code to sandbox and no side effects to guard against, except
# the two hook invocations in the reachability cases, which are read-only
# by construction (subagent_start.sh reads files and prints JSON;
# full_boot.sh's truncation logic is replicated inline rather than running
# the full script, since full_boot.sh also makes network calls (gh api) and
# writes brain state -- not appropriate for a deterministic gate check).
#
# Usage: verify_f5_quota_doctrine.sh <case>
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

RULES="$REPO_ROOT/.agent/memory/project/rules.md"
CASE="${1:-}"

case "$CASE" in

  # --- Substance: the doctrine is genuinely present, non-generic ---------

  substance_expenditure_policy_section_present)
    [ -f "$RULES" ] || { echo "FAIL: $RULES does not exist"; exit 1; }
    grep -q '^## Quota Expenditure Policy' "$RULES" \
        || { echo "FAIL: rules.md has no '## Quota Expenditure Policy' section header"; exit 1; }
    echo "PASS: substance_expenditure_policy_section_present"
    ;;

  substance_run_to_the_wall_phrase_present)
    [ -f "$RULES" ] || { echo "FAIL: $RULES does not exist"; exit 1; }
    # Specific, non-generic phrasing -- would not match unrelated prose.
    grep -qi 'run to the wall' "$RULES" \
        || { echo "FAIL: rules.md does not contain the 'run to the wall' expenditure doctrine phrase"; exit 1; }
    grep -qi 'not to a self-imposed early stop' "$RULES" \
        || { echo "FAIL: rules.md does not contain the 'not to a self-imposed early stop' phrase"; exit 1; }
    echo "PASS: substance_run_to_the_wall_phrase_present"
    ;;

  # --- Absence: no contradictory stop-early/conserve doctrine survives ---

  absence_no_contradictory_doctrine_in_other_docs)
    # Scope: agent-facing docs other than rules.md's own Quota Expenditure
    # Policy section (which legitimately MENTIONS the retired doctrine to
    # say it's retired -- that is not an instruction to follow it).
    fail=0
    targets="AGENTS.md CLAUDE.md docs/workflow-reference.md"
    for f in $targets; do
        [ -f "$f" ] || continue
        if grep -niE 'conserve.{0,20}quota|stop early.{0,20}quota|quota.{0,20}stop early' "$f" >/dev/null; then
            echo "FAIL: $f contains conserve/stop-early quota guidance that contradicts F5's expend-the-window doctrine"
            fail=1
        fi
    done
    if [ -d docs/harness ]; then
        for f in docs/harness/*.md; do
            if grep -niE 'conserve.{0,20}quota|stop early.{0,20}quota|quota.{0,20}stop early' "$f" >/dev/null; then
                echo "FAIL: $f contains conserve/stop-early quota guidance that contradicts F5's expend-the-window doctrine"
                fail=1
            fi
        done
    fi
    [ -f .agent/memory/project/learned.md ] && \
        grep -niE 'conserve.{0,20}quota|stop early.{0,20}quota|quota.{0,20}stop early' .agent/memory/project/learned.md >/dev/null && \
        { echo "FAIL: learned.md contains conserve/stop-early quota guidance that contradicts F5's doctrine"; fail=1; }
    # rules.md itself: only its OWN Quota Expenditure Policy section may
    # mention the old doctrine (to retire it). Any OTHER section instructing
    # conserve/stop-early is a genuine contradiction living right next to
    # the new doctrine.
    other_sections="$(awk '/^## Quota Expenditure Policy/{skip=1; next} /^## /{skip=0} skip==0' "$RULES")"
    if printf '%s' "$other_sections" | grep -niE 'conserve.{0,20}quota|stop early.{0,20}quota|quota.{0,20}stop early' >/dev/null; then
        echo "FAIL: rules.md contains conserve/stop-early quota guidance OUTSIDE the Quota Expenditure Policy section -- contradicts F5's doctrine"
        fail=1
    fi
    [ "$fail" -eq 1 ] && exit 1
    echo "PASS: absence_no_contradictory_doctrine_in_other_docs"
    ;;

  # --- Reachability: does the doctrine actually surface to a session? ----

  reachable_subagent_start_hook_injects_full_doctrine)
    [ -f execution/hooks/subagent_start.sh ] || { echo "FAIL: execution/hooks/subagent_start.sh does not exist"; exit 1; }
    out="$(printf '{"agent_type":"dev"}' | bash execution/hooks/subagent_start.sh 2>&1)"
    ctx="$(printf '%s' "$out" | python3 -c "import sys,json; print(json.load(sys.stdin)['hookSpecificOutput']['additionalContext'])" 2>/dev/null || true)"
    [ -n "$ctx" ] || { echo "FAIL: subagent_start.sh produced no additionalContext -- output was: $out"; exit 1; }
    echo "$ctx" | grep -qi 'run to the wall' \
        || { echo "FAIL: SubagentStart hook injection does not contain the F5 doctrine phrase -- spawned agents (dev/qa/architect) would not see it"; exit 1; }
    echo "PASS: reachable_subagent_start_hook_injects_full_doctrine"
    ;;

  reachable_session_start_boot_injects_full_doctrine)
    # Extracts the REAL "Step 3: Project rules" stanza verbatim from
    # full_boot.sh (the block bounded by the "# Step 3: Project rules" and
    # "# Step 4:" comments) and executes THAT extracted code -- not a
    # reimplementation of it -- against a fixture rules.md in an isolated
    # temp tree. This exercises the actual injection logic's real output
    # while skipping the rest of the script (gh api network calls, brain
    # writes) which are unrelated to rules injection and unsafe for a
    # deterministic gate.
    #
    # Coverage: proves what the Step 3 stanza itself does to rules.md
    # content. Does NOT prove the stanza is still wired into full_boot.sh's
    # execution order (i.e. that Step 3 isn't dead code) -- the extraction
    # itself requires the "# Step 3: Project rules" / "# Step 4:" comment
    # markers to still exist and bound the real block, which is checked
    # below.
    [ -f execution/hooks/full_boot.sh ] || { echo "FAIL: execution/hooks/full_boot.sh does not exist"; exit 1; }

    stanza="$(awk '/^# Step 4:/{exit} /^# Step 3: Project rules/{flag=1} flag{print}' execution/hooks/full_boot.sh)"
    [ -n "$stanza" ] || { echo "FAIL: could not extract the Step 3 project-rules stanza from full_boot.sh (markers '# Step 3: Project rules' / '# Step 4:' not found or block empty) -- check script structure changed, check is stale"; exit 1; }
    echo "$stanza" | grep -q 'rules.md' \
        || { echo "FAIL: extracted Step 3 stanza does not reference rules.md -- extraction markers may have drifted onto the wrong block"; exit 1; }

    # No truncation primitive may be applied to rules.md within the stanza --
    # this is what makes the check bite if tail/head/sed-slicing is ever
    # reintroduced ahead of the `cat`.
    if echo "$stanza" | grep -qE '(tail|head|sed[[:space:]]+-n)[^|;&]*rules\.md'; then
        echo "FAIL: Step 3 stanza applies a truncation primitive (tail/head/sed -n) to rules.md -- doctrine could be truncated before it reaches the orchestrator session"
        exit 1
    fi

    # Execute the real extracted stanza for real, against a fixture rules.md,
    # in an isolated temp tree -- so the assertion is against actual runtime
    # output, not a copy of the hook's internals.
    tmpdir="$(mktemp -d)"
    trap 'rm -rf "$tmpdir"' RETURN 2>/dev/null || true
    mkdir -p "$tmpdir/.agent/memory/project"
    cp "$RULES" "$tmpdir/.agent/memory/project/rules.md"
    boot_injection="$(cd "$tmpdir" && bash -c "$stanza" 2>&1)"
    rm -rf "$tmpdir"

    if echo "$boot_injection" | grep -qi 'run to the wall'; then
        echo "PASS: reachable_session_start_boot_injects_full_doctrine"
    else
        echo "FAIL: the orchestrator's own SessionStart boot injection (full_boot.sh Step 3 stanza) does NOT surface the F5 doctrine when run for real against rules.md -- the text exists on disk but is not mechanically reachable by the orchestrator session that needs it to make quota-window pacing decisions -- same failure class ('signal reported, not enforced/reachable') this mission exists to catch. Actual output was: $boot_injection"
        exit 1
    fi
    ;;

  *)
    echo "ERROR: unknown case '$CASE'. Valid: substance_expenditure_policy_section_present, substance_run_to_the_wall_phrase_present, absence_no_contradictory_doctrine_in_other_docs, reachable_subagent_start_hook_injects_full_doctrine, reachable_session_start_boot_injects_full_doctrine" >&2
    exit 1
    ;;
esac
