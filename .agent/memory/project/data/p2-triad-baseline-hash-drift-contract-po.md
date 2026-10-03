# p2-triad-baseline-hash-drift-contract-po

**[P2] Pre-existing triad baseline hash drift.**
`python3 execution/checks/verify_f2_baseline_hash_consistency.py` exits 1 —
`contracts/contract-policy-pages.yaml` was edited after its sha256 was pinned into
`execution/triad-baseline-exempt.sha256` (recorded `1e6efc2b6389…`, live `98877d135601…`).
Any later edit to a grandfathered-exempt contract re-arms triad enforcement per the
`nos-design-system` precedent — this is exactly that re-arm, just not yet actioned. Found
2026-10-03 during `menu-system-layout4` close-out.
