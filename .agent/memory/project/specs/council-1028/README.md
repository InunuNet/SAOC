# council-1028

Two contracts from the council correction sheets of 2026-10-27 and NOS Design ruling COUNCIL-1 (root comms.md, 2026-10-28).

- `council-copy-fixes/` : ten code-string corrections (typos and the reviewer's own words). Starts now, on main. `goldens/copy-map.json` drives every check.
- `council-design-1/` : SAOC side of COUNCIL-1 (C1 footer lockup, C3 button caps, C4 two families, C5 society link icons). Built on main AFTER the saoc-design-consistency wave merges (its checks import `../../../backlog-wave-1028/saoc-design-consistency/checks/lib.mjs`). Step 0 for @dev is `checks/baseline.mjs capture`.

Both validate with `/opt/homebrew/opt/python@3.14/bin/python3.14 execution/contract.py validate --strict <contract.yaml>`.
