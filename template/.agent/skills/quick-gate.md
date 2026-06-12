# quick-gate

Run the phase 4 contract gate on the active mission without manually constructing the contract path.

## When to use
After @docs completes and before @maintainer/wrap-up. Replaces the manual step of finding and running `contract.py gate`.

## Usage
```bash
bash execution/skills/quick_gate.sh
```

## What it does
Reads `active.json` → derives slug → finds matching `contract-f1.yaml` → runs `contract.py gate --phase 4 --run-checks`

## Token cost
One line vs ~20 tokens of path construction reasoning per mission.
