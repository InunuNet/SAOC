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
