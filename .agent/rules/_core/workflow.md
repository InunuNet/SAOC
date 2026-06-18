# Workflow Chain — Mandatory Every Session

## Decision Tree (run before ANY substantive work)

```
1. Active mission?   → python3 execution/mission.py resume → follow checkpoint
2. Multi-session?    → /mission new FIRST
3. 3+ files / design?→ /spec FIRST (autonomy=off until spec approved)
4. <3 files, clear?  → write contract.yaml FIRST
5. Trivial?          → handle directly (no chain)
```

## The Chain (skip nothing)

```
[mission|spec] → @architect (contract + golden files)
→ @dev (implement against golden files only)
→ @qa (adversarial; inputs from orchestrator/@architect, NOT @dev)
→ @docs (README + docs/<feature>.md)
→ contract.py gate (all assertions green)
→ @maintainer (learned.md + brain wrap-up)
→ commit
```

## Hard Rules

- **No contract.yaml → no @dev dispatch.**
- **No golden files → no @dev dispatch.**
- **@dev never writes QA inputs or the contract.**
- **DONE = gate green + docs updated + brain wrapped. Nothing less.**
- **Trivial = read, status, single command. Everything else uses the chain.**
- **Chain Continuous** — Never pause between chain steps waiting for user confirmation. Once a mission is active, proceed @architect→@dev→@qa→@docs→gate→@maintainer without stopping. Only pause at mission boundaries or on BLOCKED verdict.
