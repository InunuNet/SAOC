# p3-verify-manual-only-contracts-validate

**[P3] verify_manual_only_contracts_validate counts 0 manual_only contracts** although sec-03/contract.yaml now has a top-level `manual_only:` block (2026-10-29) — the validator likely scans only contracts/*.yaml, not spec contracts. Blind spot; extend its glob or document the scope.
