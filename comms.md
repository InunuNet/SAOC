# comms.md — SAOC → Athanor

## 2026-08-17 — HARNESS DEFECT: `execution/contract.py` silently ignores every per-check `timeout_seconds`

**For Athena. This one affects every Athanor project, not just SAOC.** Fixed locally in SAOC
commit `821f0c7`; needs upstreaming to `InunuNet/Athanor` before it is lost.

### The defect

`execution/contract.py` supports two assertion schemas. Every contract written by `@architect`
uses the dict form:

```yaml
assertions:
  phase: 4
  checks:
    - id: A18
      command: node contracts/checks/...
      timeout_seconds: 120
```

`normalize_contract()` (~line 128-144) converts each check into the internal assertion shape and
builds:

```python
"verify": {"kind": "shell", "cmd": cmd}
```

**It never copies `timeout_seconds`.** `check_cmd()` then reads
`verify.get("timeout_seconds") or getattr(args, "timeout_seconds", 60)` — the key is never
present, so every shell assertion in every `{phase, checks}` contract has always run at the 60s
CLI default, regardless of what it declared.

Two further bugs found in the same area:

2. That `or` is a truthiness trap — a legitimately declared `0` falls through to the default.
3. `gate_cmd()`'s `--phase all` loop builds each phase's Namespace **without** a
   `timeout_seconds` field at all, so even after fixing #1, `gate --phase all --run-checks
   --timeout-seconds N` still reverts to 60s. The `max` and numeric-phase branches are fine.

### Why it mattered here

SAOC had a P1 Firestore fixture leak: ~17 orphaned test documents. Root cause was a kill-ceiling
inversion — `contract.py` killed assertions at 60s while the suite's `LOCK_WAIT_MS` was 90s. A
killed check released its lock (synchronous `process.on('exit')`) but lost the awaited cleanup
sweep in its `finally`. Cleanup lost, lock did not, so it leaked silently.

The obvious fix was to raise `timeout_seconds` on the affected assertions. **That fix passed
24/24 with a QA PASS while doing nothing at all**, because the field was being dropped. Every
assertion verified the *declaration* (the yaml says 120s); none verified the *effect* (the
subprocess actually receives 120s).

### The fix

Four minimal edits, 26 insertions / 5 deletions, single file:

1. `normalize_contract()` — copy `timeout_seconds` into the verify dict when present.
2. `check_cmd()` — explicit `is not None` instead of `or`.
3. `gate_cmd()` `--phase all` branch — include `timeout_seconds` in the Namespace.
4. `validate_cmd()` — reject non-positive-int `timeout_seconds` at validate time (`bool`
   excluded explicitly, since it is an `int` subclass).

Verified by runtime effect, not declaration: `subprocess.run` was monkeypatched to capture the
actual `timeout` kwarg for real assertion IDs — 120/120/120/120/150/150/180, matching the yaml
exactly. A paired fixture proves the kill fires: a check declaring 2s while sleeping 6s exits 0
pre-fix and exits 1 post-fix with `Command timed out after 2s`.

### Known gaps left open (pre-existing, recorded not fixed)

- `validate_cmd()` is **never called from** `check_cmd()` or `gate_cmd()`. Every value validate
  rejects still reaches the runner by the normal path: `true` silently becomes `timeout=1`,
  `false` becomes `0` (instant kill), a string produces a raw `TypeError` traceback rather than a
  clean FAIL.
- No upper bound on the integer — `999999999999` passes validate, then crashes `check_cmd` with
  an unhandled `OverflowError`.
- Edit 2 (`is not None`) is correct but **untested by any assertion** — reverting it changes no
  outcome, because the `0` case is caught at validate time before `check_cmd` runs.

### Action requested

PR `execution/contract.py` upstream to `InunuNet/Athanor`. Until then, the next
`make update-template` in any project silently reverts it and reopens the leak with no warning.
SAOC boot currently reports 3.7.109 → 3.7.112 available, so that revert is genuinely pending.

Worth checking whether other projects' past "flaky check" attributions were actually this.

---

## Cross-cutting lessons from the same session

Recorded in SAOC's `learned.md`; likely to generalise.

**A fix can be green and inert.** When a fix's mechanism is a config value, at least one
assertion must prove the value reaches the thing it configures. Asserting that the config *says*
the right thing is not a test.

**The root cause got walked past twice.** An agent observed an assertion killed at 60s while its
yaml declared 180s, diagnosed exactly why, and filed it as an out-of-scope pre-existing quirk. It
was the root cause of the contract it was implementing. When an anomaly's mechanism matches the
bug you are fixing, it is a candidate root cause — even when it lives in someone else's file.

**Guards sitting outside the path they guard.** Found three times in one session: `validate_cmd`
unreachable from the runner; a lock-timeout invariant check that followed only one hardcoded
import hop (defeated by QA with a barrel import); and a residue detector comparing counts rather
than identities, blind to same-count-different-membership. For any guard, ask what path actually
reaches it and whether it can observe the failure it exists to catch.

**Mutation-test per edit, not per feature.** Reverting each of the four `contract.py` edits
individually surfaced one that was correct but proven by nothing. Feature-level mutation would
have missed it.

— Athanor (SAOC), 2026-08-17
