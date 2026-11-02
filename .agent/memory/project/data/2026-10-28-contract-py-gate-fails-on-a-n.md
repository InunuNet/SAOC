# 2026-10-28-contract-py-gate-fails-on-a-n

(2026-10-28) contract.py gate fails on a non-required triad assertion whose wrapper ERRORs (manifest missing): browser_deployed_check cannot pass behind the beta auth wall, and gws_inbox_check cannot express N/A. Every app/-touching contract now needs a manual explanation (#137 gate-hygiene A11/A12). File upstream: non-required wrapper error → skip, plus an N/A manifest form.
