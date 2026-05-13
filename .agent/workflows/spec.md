---
description: Specification Mode — read-only planning before implementation. Use for any feature touching 3+ files or requiring architectural decisions.
---

# /spec — Specification Mode

## When to use
- Feature touches 3+ files
- Requires architectural decisions
- Multi-day work
- Any task where getting it wrong would be expensive

## Phase 1: Lock to Read-Only (FIRST — before any exploration)

Execute these commands immediately on `/spec` invocation:

```bash
# 1. Save current autonomy level for restore later
CURRENT_AUTONOMY=$(python3 -c "import json; print(json.load(open('.agent/profile.json')).get('autonomy',{}).get('level','medium'))")

# 2. Flip autonomy to off (enforces hook-level read-only — not just a promise)
python3 -c "import json,datetime; p=json.load(open('.agent/profile.json')); p.setdefault('autonomy',{})['level']='off'; p['autonomy']['updated_at']=datetime.datetime.now(datetime.UTC).isoformat(); json.dump(p,open('.agent/profile.json','w'),indent=2)"
rm -f /tmp/athanor_autonomy_* 2>/dev/null || true  # clear session cache so hook picks up new level

# 3. Announce
echo "🔒 SPEC MODE ACTIVE — autonomy locked to off (was: $CURRENT_AUTONOMY)"
echo "   The ONLY file you may write is the spec plan itself."
```

If the autonomy flip fails → STOP. Surface the error. Do not proceed.

You MAY (read-only operations):
- Read any file with Read tool
- Search with Grep/Glob
- Run: `ls`, `cat`, `grep`, `git log`, `git diff`, `git status`

You MUST NOT (enforced by hook + lock):
- Write or edit any files (except the spec in Phase 2)
- Run shell commands that modify state
- Create directories or files (except the specs/ dir in Phase 2)

Steps:
1. Read AGENTS.md, .agent/memory/project/goals.md, .agent/memory/project/learned.md
2. Read all files relevant to the requested feature
3. Understand the existing patterns, conventions, and constraints
4. Identify every file that will need to change
5. Identify risks, dependencies, and open questions

## Phase 2: Write the Plan

Save the plan as: `.agent/memory/project/specs/YYYY-MM-DD-<slug>.md`
where slug is 3-5 words from the feature title, hyphenated, lowercase.

Plan must contain these 9 sections:
1. **Goal & Acceptance Criteria** — what done looks like, testable assertions
2. **Technical Approach** — architectural decisions, patterns to follow
3. **File-by-File Breakdown** — every file that changes, what changes
4. **Phase Breakdown** — ordered implementation phases, each ≤1 day
5. **Dependencies** — which phases must complete before others
6. **Testing Strategy** — how to verify each phase works
7. **Risk Assessment** — what could go wrong, likelihood, mitigation
8. **Rollback Plan** — how to revert if a phase fails
9. **Open Questions** — anything requiring user input before implementing

### Contract (mandatory — append to spec file)

After the 9 sections, append a `## Validation Contract` section to the spec file.
Write at least one assertion per feature phase. Assertions must be:
- Written BEFORE any code exists (adversarial — not confirming decisions)
- Specific enough that qa can verify them without reading the implementation
- Cover at least one scrutiny check (make test, make audit, specific command)
- Cover at least one behavioral/manual check per phase

Format each assertion as:
```
### A<N> — <what must be true when done>
- **Type**: scrutiny | behavioral | manual  
- **Verify**: `<exact command>` or <exact instruction>
- **Expected**: <expected output or exit code>
- **Phase**: <phase number>
- **Features**: [<feature-slug>]
```

Minimum: 1 assertion per phase. Target: 2-3 per phase for any real feature.

## Phase 2.5: Write and Validate the Contract Sidecar

```bash
# 1. Write the machine-readable sidecar (YAML or JSON)
# Filename: same as spec file but with -contract.yaml suffix
# Example: 2026-05-11-my-feature-contract.yaml

# 2. Validate it
python3 execution/contract.py validate .agent/memory/project/specs/<slug>-contract.yaml
# If exit != 0: fix errors and re-run. Do NOT proceed to approval gate.

# 3. Clear any stale results from previous runs
python3 execution/contract.py clear .agent/memory/project/specs/<slug>-contract.yaml

# 4. Print the report to confirm coverage
python3 execution/contract.py report .agent/memory/project/specs/<slug>-contract.yaml
```

The sidecar is a YAML (or JSON) file conforming to `athanor.contract/v1`.
See `.agent/schemas/contract.example.yaml` for a complete example.

If PyYAML is not installed: `pip install pyyaml` or write the sidecar as `.json`.

**Phase gate usage** (Lead runs between dev phases):
```bash
python3 execution/contract.py gate .agent/memory/project/specs/<slug>-contract.yaml --phase 1 --run-checks
# Exit 0 = all phase-1 assertions pass -> dev may start phase 2
# Exit 2 = failures -> surface to user, do not advance
```

## Phase 3: Present the Approval Gate

After writing the plan, print EXACTLY this block (fill in [PLAN_PATH] and [SUMMARY]):

```
════ SPEC READY ════════════════════════════════
📋 Plan: [PLAN_PATH]
📝 [SUMMARY — 2 sentence description of what will be built]

Choose how to proceed:
  1. ❌ Reject — iterate on the plan (tell me what to change)
  2. ✅ Approve — I will implement manually with full control
  3. ✅ Approve + LOW — agents get memory writes + safe shell only
  4. ✅ Approve + MEDIUM — agents get full project writes + build tools (default)
  5. ✅ Approve + HIGH — agents get full project + release commands

Enter 1–5:
════════════════════════════════════════════════
```

## Phase 4: Act on Approval

- **Option 1 (Reject)**: Revise the plan based on feedback. Restore autonomy first:
  ```bash
  python3 -c "import json,datetime; p=json.load(open('.agent/profile.json')); p['autonomy']['level']='$CURRENT_AUTONOMY'; p['autonomy']['updated_at']=datetime.datetime.now(datetime.UTC).isoformat(); json.dump(p,open('.agent/profile.json','w'),indent=2)"
  rm -f /tmp/athanor_autonomy_* 2>/dev/null || true
  ```
  Then edit the spec file in place and present the gate again.

- **Option 2 (Approve manual)**: Restore autonomy to `$CURRENT_AUTONOMY` (same snippet as option 1). Print "Spec saved at [PLAN_PATH]. Execute manually." Exit.

- **Options 3/4/5 (Approve + delegate)**: Set autonomy to chosen level, clear cache, then delegate to @dev:
  ```bash
  # Set chosen level (low / medium / high)
  python3 -c "import json,datetime; p=json.load(open('.agent/profile.json')); p['autonomy']['level']='<CHOSEN>'; p['autonomy']['updated_at']=datetime.datetime.now(datetime.UTC).isoformat(); json.dump(p,open('.agent/profile.json','w'),indent=2)"
  rm -f /tmp/athanor_autonomy_* 2>/dev/null || true
  echo "🔓 Autonomy set to <CHOSEN> — handing off to @dev"
  ```
  Tell @dev: "Implement the spec at [PLAN_PATH]. Read it fully before starting. Follow phases in order. Run tests per phase. Report after each phase before proceeding."
  Lead reviews each phase output before allowing dev to continue.

## Phase 5: Wrap Up

After dev completes (or aborts):
1. Restore autonomy to `$CURRENT_AUTONOMY`:
   ```bash
   python3 -c "import json,datetime; p=json.load(open('.agent/profile.json')); p['autonomy']['level']='$CURRENT_AUTONOMY'; p['autonomy']['updated_at']=datetime.datetime.now(datetime.UTC).isoformat(); json.dump(p,open('.agent/profile.json','w'),indent=2)"
   rm -f /tmp/athanor_autonomy_* 2>/dev/null || true
   ```
2. Append outcome to the spec file: `## Outcome\n✅ Shipped / ⏸ Paused / ❌ Rolled back — [date] [summary]`
3. Store in brain: `python3 execution/brain.py remember --summary "<slug> spec outcome" --tags "spec,<slug>"`

## Failure modes
- Autonomy flip fails → STOP, surface error, do not proceed
- User reply is not 1–5 → re-print gate, do not assume a default
- Dev fails mid-phase → halt, run rollback steps from section 7 of the spec, ask user
- Session ends mid-spec → autonomy may be stuck at `off`; run `/autonomy set medium` at next session start
