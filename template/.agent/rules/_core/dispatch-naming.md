# Structured Agent Dispatch Names

Before every Agent-tool dispatch, render the name:

```
python3 execution/dispatch_name.py --role <role> --model <model> \
    --mission <mission-slug> --milestone <id> --feature <id>
```

Use its stdout **verbatim** as the Agent tool's `name:`. It renders
`{RoleAbbr}_{ModelAbbr}_M{n}-F{n}_{MissionPascal}` — e.g.
`Dev_Son5_M1-F1_HomeScaffolding` — and always satisfies the tool's name regex.

The abbreviation tables and normalisation rules are fixed, and they live in
`execution/dispatch_name.py`. Do not invent alternates and do not hand-render a
name; `python3 execution/dispatch_name.py --help` gives the exact argument list.
`render_dispatch_name()` is a pure function of its five inputs — it does not read
mission state, so a wrong milestone silently produces a wrong name.

## Escalating effort on a retry

When the same feature ID is re-dispatched to the same role after a QA FAIL, climb
one rung. The retry count is the Nth dispatch of that feature+role this mission;
no state file tracks it.

| retry | model tier |
|---|---|
| 0 (first dispatch) | sonnet5 |
| 1 | opus5 |
| 2+ | fable5 (ceiling — it does not climb further) |

`--retry N` leaves stdout unchanged and prints an advisory suggestion to stderr.
It is advice: if you take it, pass the suggested tier as both `--model` and the
Agent tool's `model:` parameter.
