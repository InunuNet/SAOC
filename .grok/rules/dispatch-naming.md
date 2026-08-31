# Structured Agent Dispatch Names

Before every Agent-tool dispatch, shell out to:

```
python3 execution/dispatch_name.py --role <role> --model <model> --mission <mission-slug> --milestone <id> --feature <id>
```

Use its stdout as the Agent tool's `name:` parameter. It renders
`{RoleAbbr}_{ModelAbbr}_M{n}-F{n}_{MissionPascal}` (e.g. `Dev_Son5_M1-F1_HomeScaffolding`),
always satisfying the Agent tool's name regex `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`. The
milestone/feature segment sits right after role/model so fleet-view UIs that truncate long
names with a tail ellipsis never clip it; only the mission-slug segment (at the tail) is
ever truncated.

Abbreviation tables and normalization rules are fixed — see
`.agent/memory/project/specs/agent-dispatch-naming/goldens/dispatch_name_cases_f2.md`. Do not
invent alternate abbreviations. The helper (`render_dispatch_name` in
`execution/dispatch_name.py`) is a pure function of its five inputs; it does not read
active.json or mission state itself.

## Escalating effort on retries

Trigger: the orchestrator re-dispatches the **same feature ID to the same role** after a prior
dispatch for that feature+role ended in a QA FAIL (or was otherwise redone). The retry count is
tracked informally — it's the Nth time this feature+role pair has been dispatched this mission,
which the orchestrator already knows from its own dispatch history/checkpoint notes. No new
state file is added for this.

Model-tier is the only escalation lever that exists in this harness today (no
reasoning-effort/thinking-budget axis exists in the Agent tool or agent frontmatter). Ladder (3
rungs, ceiling at fable5):

| retry count | model tier |
|---|---|
| 0 (first dispatch) | sonnet5 |
| 1 (1st re-dispatch) | opus5 |
| 2+ (2nd+ re-dispatch) | fable5 (ceiling — does not climb further) |

Pass `--retry N` to `dispatch_name.py`. Stdout (the dispatch name) is unchanged; only when
`--retry` > 0 does it also print an advisory suggestion to stderr:

```
python3 execution/dispatch_name.py --role dev --model 'Sonnet 5' --mission home-scaffolding --milestone M1 --feature F1 --retry 1
# stdout: Dev_Son5_M1-F1_HomeScaffolding
# stderr: # escalation suggestion: retry 1 -> recommended model tier 'opus5'
```

This is advisory only — the orchestrator reads the suggestion and, if it agrees, passes the
suggested tier as both `--model` (so the rendered name reflects it) and the Agent tool's
`model:` param.
