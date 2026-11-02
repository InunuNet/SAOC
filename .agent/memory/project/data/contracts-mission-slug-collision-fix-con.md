# contracts-mission-slug-collision-fix-con

**contracts/mission-slug-collision-fix/contract-f1.yaml still fails `validate --strict`** (2026-10-28, from NOS Site) — A1/A2 use multiline `python3 -c`; #126 was meant to fix it. Route to an architect: rewrite A1/A2 as script-file checks, then prove `contract.py validate --strict` exits 0.
