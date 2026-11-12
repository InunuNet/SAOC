---
description: Agent dispatch names by convention and the retry effort ladder.
paths:
  - ".agent/agents/*.md"
  - ".claude/agents/*.md"
---

# Agent Dispatch Names

Name every Agent-tool dispatch by convention, in text: `Role_Model_Mn-Fn_Slug`, for example
`Dev_Son5_M1-F1_HomeScaffolding`. Role is Dev, QA, Arch or Docs; Model is a short tier tag
(Son5, Opu5, Fab5); Mn-Fn is the milestone and feature id; Slug is the mission or feature in
PascalCase. No subprocess renders it.

Retry after a QA FAIL on the same feature+role climbs one rung: first dispatch sonnet5, retry 1
opus5, retry 2+ fable5 (ceiling). Pass the tier as the Agent tool's `model:`.
