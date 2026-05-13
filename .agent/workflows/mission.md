---
description: Mission Mode — persistent multi-session goal orchestrator. Use when a goal spans multiple sessions, requires milestone gating, and benefits from tracked feature/milestone progress.
---

# /mission — Multi-Session Goal Orchestrator

## When to use

- Goal requires 3+ implementation sessions
- Work must survive session boundaries (crash, context compaction, hand-off)
- Milestone gating with validation contracts is required
- Goal decomposes into parallel or sequential features

## Phase 0: Boot Check (Always First)

At every session start, check for an active mission:

```bash
python3 execution/mission.py resume
```

If a mission is active, the boot context will show:
```
--- ACTIVE MISSION ---
Mission: <slug> — <goal>
Status: in_progress | Features: N/M done | Milestones: K/L done
→ Run /mission resume to continue.
```

**If an active mission exists:** read Phase 3 and continue from the last checkpoint. Do NOT start a new mission.

**If no active mission:** proceed to Phase 1.

## Phase 1: Goal Decomposition with Lead (Autonomy: off)

**First — compact the session context:**

Run `/compact` now. Do not proceed until compaction is confirmed. This is the Pre-Mission Compaction Rule (binding gate in `rules.md`).

Rationale: mission planning quality degrades under accumulated tool noise. Compaction ensures the mission starts from clean boot-loaded context only.

**Next — lock autonomy:**
```bash
python3 -c "import json,datetime; p=json.load(open('.agent/profile.json')); p.setdefault('autonomy',{})['level']='off'; p['autonomy']['updated_at']=datetime.datetime.now(datetime.UTC).isoformat(); json.dump(p,open('.agent/profile.json','w'),indent=2)"
rm -f /tmp/athanor_autonomy_* 2>/dev/null || true
echo "Autonomy locked to off for mission planning"
```

**Dispatch @lead** to decompose the goal into:
- 3–10 features (`F1`…`Fn`) — each implementable in one agent session
- 2–4 milestones (`M1`…`Mm`) — each grouping related features, with a gate rationale
- Inline briefs for each feature (or spec file references)

Lead returns a structured plan. Do NOT implement anything during Phase 1.

**Create the mission file:**
```bash
python3 execution/mission.py new "<goal>" --slug <slug>
```

Then edit the created `.md` file in `.agent/memory/project/missions/` to populate features and milestones per the lead's plan.

## Phase 2: Plan Approval Gate

Validate the mission file:
```bash
python3 execution/mission.py validate <mission.md>
python3 execution/mission.py status <mission.md>
python3 execution/mission.py cost <mission.md>
```

Then present EXACTLY this block:

```
════ MISSION PLAN READY ════════════════════════════════
📋 Plan: <path>
📝 [2 sentence description of goal and feature breakdown]

Cost estimate: ~N agent calls

Choose how to proceed:
  1. ❌ Reject — iterate on the plan (describe changes needed)
  2. ✏️  Edit — I will edit the mission file directly, then re-validate
  3. ✅ Approve — I will implement manually with full control
  4. ✅ Approve + LOW — agents get memory writes + safe shell only
  5. ✅ Approve + MEDIUM — agents get full project writes + build tools (default)
  6. ✅ Approve + HIGH — agents get full project + release commands

Enter 1–6:
════════════════════════════════════════════════════════
```

- **Option 1 (Reject)**: Update the mission file and re-validate. Re-present gate.
- **Option 2 (Edit)**: User edits file; re-validate; re-present gate.
- **Option 3 (Approve manual)**: Restore autonomy to prior level; print mission path. Exit.
- **Options 4/5/6 (Approve + delegate)**: Set autonomy to chosen level, clear cache, activate mission, proceed to Phase 3.

## Phase 3: Execution Loop (Per-Milestone, Per-Feature)

For each milestone in order:

### 3a. Per-Feature Execution

For each feature in the milestone:

1. **Checkpoint start:**
   ```bash
   python3 execution/mission.py checkpoint <mission.md> --feature F1 --status in_progress
   ```

2. **Dispatch @dev** with the feature brief or spec.
   - @dev must write a `/spec` contract before implementing if the feature touches 3+ files.
   - @dev reports back with a handoff block.

3. **On completion, checkpoint done:**
   ```bash
   python3 execution/mission.py checkpoint <mission.md> --feature F1 --status done [--handoff <path>]
   ```

4. **On failure/block:**
   ```bash
   python3 execution/mission.py checkpoint <mission.md> --feature F1 --status blocked
   # Then: investigate, skip, or redesign
   python3 execution/mission.py skip <mission.md> --feature F1 --reason "..."
   ```

### 3b. Resume After Session Break

If a session ends mid-mission, next session:
```bash
python3 execution/mission.py resume
```
Prints exact next action. No re-reading the plan needed.

## Phase 4: Milestone Gate

When all features in a milestone are `done` or `skipped`:

```bash
python3 execution/mission.py gate <mission.md> --milestone M1
```

This:
- Runs `contract.py gate --phase 1 --run-checks` for each feature with a contract
- Features without contracts: pass iff status is `done`
- Exit 0 → milestone marked `done`, proceed to next milestone
- Exit 2 → surface failures, fix before advancing

**After gate passes**, update the mission status and continue to the next milestone.

## Phase 5: Mission Wrap-Up

When all milestones are done:

```bash
python3 execution/mission.py status <mission.md>
python3 execution/mission.py pause <mission.md>   # or: mission is auto-marked done by gate
python3 execution/brain.py remember --summary "<slug> mission complete: <goal>" --tags "mission,complete,<slug>"
```

Write a wrap-up note in the mission body section. Archive if desired.

---

## Failure Modes and Recovery

| Failure | Recovery |
|---------|----------|
| Feature blocked (dependency missing) | `checkpoint --status blocked`, then `skip --reason` or fix dependency and retry |
| Session ends mid-feature | `resume` → checkpoint shows last active feature |
| Gate fails | Fix failing assertions in contract, re-run `gate` |
| active.json points to deleted file | `python3 execution/mission.py list`, then `activate` the correct file |
| Autonomy stuck at `off` | `/autonomy set medium` at next session start |
| Mission goal changed significantly | `abandon --reason`, create new mission with `new` |

## Quick Reference Commands

```bash
# Start a mission
python3 execution/mission.py new "my goal" --slug my-goal

# Daily resume
python3 execution/mission.py resume

# Feature lifecycle
python3 execution/mission.py checkpoint mission.md --feature F1 --status in_progress
python3 execution/mission.py checkpoint mission.md --feature F1 --status done

# Milestone gate
python3 execution/mission.py gate mission.md --milestone M1

# View progress
python3 execution/mission.py status mission.md
python3 execution/mission.py list

# Pause/resume between missions
python3 execution/mission.py pause mission.md
python3 execution/mission.py activate mission.md

# Cost estimate
python3 execution/mission.py cost mission.md
```

## Integration with /spec

When a feature brief says "use /spec":
1. Run `/spec` normally — this creates a spec + contract sidecar
2. After spec is approved, run:
   ```bash
   python3 execution/mission.py attach-spec mission.md \
     --feature F1 \
     --spec .agent/memory/project/specs/YYYY-MM-DD-<slug>.md \
     --contract .agent/memory/project/specs/YYYY-MM-DD-<slug>-contract.yaml
   ```
3. The mission gate will use this contract when evaluating the milestone.
