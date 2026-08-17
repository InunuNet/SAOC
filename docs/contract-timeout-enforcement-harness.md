# Contract Timeout Enforcement (Athanor Harness)

**Contract:** `contracts/contract-check-timeout-enforcement.yaml` (8/8). Gated green.

**CRITICAL:** This fix is Athanor harness code (shared template in `execution/contract.py`). It **MUST be PR'd upstream to InunuNet/Athanor** before any `make update-template` run, or the fix will be silently reverted and the fixture-leak issue will reopen with no warning.

---

## The Root Cause

`execution/contract.py`'s `normalize_contract()` function never copied the `timeout_seconds` field when normalizing the `{phase, checks}` schema every contract here uses. Consequence: **every per-check timeout was silently ignored and every assertion ran at the hardcoded 60-second ceiling**.

This is the root cause of [fixture-leak-hardening.md](fixture-leak-hardening.md) **Path 2** — the timeout ceiling below lock-wait ceiling race that killed processes before fixture cleanup completed.

---

## The Three Bugs (All Fixed)

### Bug 1: Dropped copy in `normalize_contract()`
The schema normalizer copied most fields but omitted `timeout_seconds`. Assertions with explicit timeout values in the YAML inherited the global default instead.

### Bug 2: Truthiness `or` in `check_cmd()`
```python
timeout = check.get('timeout_seconds') or 60
```
If `timeout_seconds` was present but `0` (a valid timeout), the `or 60` fallback would still trigger, overriding the intent.

### Bug 3: `--phase all` branch in `gate_cmd()`
The `gate_cmd()` function's `--phase all` branch completely omitted the `timeout_seconds` field entirely, forcing the fallback everywhere.

---

## The Fix (4 Minimal Edits)

1. Copy `timeout_seconds` in `normalize_contract()` when creating the normalized schema
2. Change `or` to `is not None` for proper falsey-value handling
3. Include `timeout_seconds` in the `--phase all` branch
4. Minor clarification: use `if timeout_seconds is not None` (26 ins / 5 del total)

---

## Proof

Runtime effect verified by `@qa` via monkeypatching: subprocess.run was captured for payfast-m1 check IDs to verify the actual timeout kwarg passed to Python's subprocess module matched the YAML declarations:

```
120, 120, 120, 120, 150, 150, 180
```

Matches the yaml exactly: A18–A21 (120s), A30/A31 (150s), A34 (180s).

---

## Known Limitations

All pre-existing, not fixed this session:

- **`validate_cmd` never called** — check values are rejected by `validate_cmd()` but never invoked from `check_cmd()`/`gate_cmd()`, so rejected values still reach the runner (`true` → timeout=1, string → raw TypeError)
- **No upper bound** — `timeout_seconds: 999999999999` would parse and cause an unhandled OverflowError
- **`is not None` untested** — the change from `or` to `is not None` is structurally correct but not covered by any existing assertion

These are honest ceilings; documenting them prevents false claims of complete validation.

---

## Upstream Action Required

**Status:** Commit sha and PR instructions are in this repository's git log (commit that ships this fix). The fix is isolated to `execution/contract.py` and does not affect SAOC codebase outside the harness.

To PR this upstream:
1. Create a branch on InunuNet/Athanor
2. Apply the same four edits to their `execution/contract.py`
3. File a pull request with reference to this session's diagnosis
4. Once merged, `make update-template` in this repo will be safe

**If this is not PR'd upstream:** The next `make update-template` run will overwrite `execution/contract.py` with the broken upstream version, silently reverting the fix, and reopen the fixture-leak vulnerability with no warning.

---

## Related

- [Fixture Leak Hardening](fixture-leak-hardening.md) — Path 2 root cause and implications
- [Ticketing Hardening](ticketing-hardening.md) — the payfast-m1 contract that this fix enables
