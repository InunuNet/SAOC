---
name: write-handoff
description: Write a chain handoff artifact (research-*.md / dev-result-*.md / qa-report-*.md / docs/*.md) at the canonical scratch path with the required section header and min-size enforced by the handoff gate.
usage: Invoke this skill when finishing an agent step that must hand off to the next agent in the chain. Picks the right path, header, and template for the source role.
---

# write-handoff

Canonical writer for the four chain handoff artifacts. Section headers and min-sizes are enforced by `execution/handoff_check.py` against `.agent/handoffs.yaml`. Wrong header → next agent gate blocks → mission stalls.

## The four artifact patterns

| From agent | Artifact path | Required section | Min bytes |
|------------|---------------|------------------|-----------|
| analyst    | `.agent/memory/scratch/research-<slug>.md` | `## Findings` | 512 |
| dev        | `.agent/memory/scratch/dev-result-<slug>.md` | `## Golden Assertions` | 128 |
| qa         | `.agent/memory/scratch/qa-report-<slug>.md` | `## Adversarial` | 128 |
| docs       | `docs/<feature>.md` | (any content) | 64 |

`<slug>` from the `active-mission` skill (no date prefix, no `.md`).

## Templates

### research-<slug>.md (analyst)
```markdown
# Research: <slug>
## Findings
<512+ bytes — evidence, file:line refs, frequency counts, token costs>
```

### dev-result-<slug>.md (dev)
```markdown
# Dev Result: <slug>
## Files
- path/to/file1
## Golden Assertions
- A1 PASS — <how verified>
```

### qa-report-<slug>.md (qa)
```markdown
# QA Report: <slug>
## Adversarial
- Phantom check: <files verified to exist>
- Boundary: <edge cases>
- Negative: <failure modes>
## Verdict
PASS | BLOCKED — <reason>
```

### docs/<feature>.md (docs)
Free-form. Min 64 bytes. Update README too if user-facing.

## Common bugs this skill prevents

- `## Goldens` vs `## Golden Assertions` — only the second passes the gate
- Writing to `.agent/scratch/` instead of `.agent/memory/scratch/`
- Artifact older than 24h (max_age_seconds: 86400)

## Related

- `.agent/handoffs.yaml` — source of truth
- `execution/handoff_check.py` — the gate
- `chain-dispatch` — points downstream agent at the artifact
