# Token Budget

Athanor exists to **preserve** tokens, not to spend them. A mission that burns
quota proving it was thorough has failed, whatever colour its gate printed.

## The dispatch budget is a cap, not a guideline

Per feature, for the whole mission:

| dispatch | budget |
|---|---|
| `@dev` (or a direct fix) | 1 |
| `@qa` | 1 |
| `@architect` | 1, and only when the feature declares a design decision |
| everything else — `@analyst`, `@docs`, extra reviewers | **0 by default** |

Seven QA passes and five analysts on one feature is the failure this rule
exists to stop. A second reviewer is not diligence, it is the same question
asked again at full price.

**Exceeding the cap requires the operator to say so, in the mission.** Not your
judgment that the work "warranted" it. If you believe a feature needs more,
say what you would spend it on and ask — in one line, not a proposal.

## Script-level fixes take no chain at all

A change to one script, with a reproducible symptom and a verifiable fix, is
done by fixing it and proving it. No architect, no spec, no QA round. Gate
green plus one verification is the **ceiling**, not the floor.

The chain in `workflow.md` is for features that touch several files or turn on
a design decision. Running it on a one-line fix is how a harness inverts:
consuming the operator's time instead of returning it.

## Prefer the cheapest tool that answers the question

In order: a deterministic script, then a targeted read, then a single agent.
A script that runs every time costs one write and answers forever; an agent
that reasons it out again costs every time and can be wrong differently each
time. Reach for the model when the task needs judgment, not recall.

Never fan out agents to search when you know the file. Never re-derive a fact
this session already established.

## Verification is proportional to blast radius

Prove the fix, not your thoroughness. One measurement that would have caught
the defect beats five that restate it. Record the measurement — a before/after
count, an exit code, a diff — and stop.

## When quota is short, say so and narrow

Running out mid-mission and leaving the tree half-changed is worse than
shipping two of five features cleanly. Finish what you started, commit it,
report exactly what you did not reach and why.
