# check-timeout-enforcement — golden reference

## The defect, with file:line evidence

`execution/contract.py` supports two assertion schemas:

1. **@architect dict format** (what every contract in this repo uses):
   `assertions: {phase: N, checks: [{id, description, command, timeout_seconds}]}`
2. **Internal list format**: `assertions: [{id, verify: {kind, cmd, timeout_seconds}}]`

`normalize_contract()` converts format 1 into format 2 so the rest of the file only
has to deal with one shape. The conversion happens at **`execution/contract.py:128-144`**:

```python
assertion_list.append({
    "id": cid,
    "description": desc,
    "verify": {
        "kind": "shell",
        "cmd": cmd,
    },
    "required": check.get("required", False),
})
```

`check["timeout_seconds"]` is read nowhere in this block. It is simply dropped on
the floor during conversion.

Two call sites then read `timeout_seconds` back off the (now-incomplete) `verify`
dict:

- **`check_cmd()` at line 275**:
  `timeout = verify.get("timeout_seconds") or getattr(args, "timeout_seconds", 60)`
  — always `None or 60` (or whatever `--timeout-seconds` was passed), because
  `verify` never had the key.
- **`gate_cmd()`'s `--phase all` loop, lines 522-528**: builds a fresh
  `argparse.Namespace` per phase that omits `timeout_seconds` entirely, so
  `_gate_single_phase`'s `getattr(args, "timeout_seconds", 60)` at line 443 falls
  back to the hardcoded default **even if the operator passed `--timeout-seconds`
  on the CLI**. This is a second, independent bug — the single-numeric-phase and
  `max` branches pass `args` straight through and don't have it.

**Net effect: every per-check `timeout_seconds` declared anywhere in this project's
contracts has always been silently ignored. Every shell assertion has always run
under a 60s kill ceiling (or whatever the CLI `--timeout-seconds` default said),
full stop.**

Confirmed empirically (per the task brief): `contract-payfast-m1.yaml` and
`contract-payfast-m1-lock-cleanup-fix.yaml` both parse to `assertions` as a dict
with keys `['phase','checks']`; check entries have keys
`['id','description','command','timeout_seconds']`; neither file has a top-level
`phases` key at authoring time (so they run through exactly this normalizer).

## Why this made the just-landed lock-cleanup fix inert

`contract-payfast-m1-lock-cleanup-fix.yaml` raised A18-A21 to 120s, A30/A31 to
150s, and A34 to 180s specifically to close a
`60s kill ceiling < 90s LOCK_WAIT_MS` inversion
(`contracts/checks/ticketing-hardening/_shared.mjs:484`,
`LOCK_WAIT_MS = 90_000`) that was SIGKILLing checks mid-run and orphaning
Firestore fixture docs. Those raised numbers were never enforced — the checks
still ran under the real 60s ceiling the whole time, because `normalize_contract()`
threw the declared value away before `check_cmd()` ever saw it. The inversion the
lock-cleanup-fix contract believed it had closed was, mechanically, still wide
open. This defect is upstream of and orthogonal to everything that contract fixed;
none of its own work is wrong, its numbers were just never load-bearing.

## Runtime-effect proof design (not declaration-grepping)

The lesson this whole defect teaches is that A2/A3-style invariant checks in the
lock-cleanup-fix contract — "yaml declares >= 120s" — were true and meaningless,
because nothing downstream of the declaration ever read it. A grep on a yaml file
proves the yaml says a number; it proves nothing about what `subprocess.run(...,
timeout=)` was actually called with.

So every primary assertion here (A1-A5) drives the *behavior* of a real subprocess
through the real `contract.py` code path, using paired fixtures that sleep for a
known duration against a known declared `timeout_seconds`, deliberately straddling
that duration on either side:

- **A1/A2 (fixture-declared-timeouts.yaml)** — `FIX-SURVIVE` sleeps 3s under a
  declared 8s ceiling (must complete); `FIX-KILL` sleeps 6s under a declared 2s
  ceiling (must be SIGKILLed). Both run through `contract.py check` with **no**
  `--timeout-seconds` flag, so the CLI default is 60s — comfortably long enough to
  let a 6s sleep finish. If the declared value were still being dropped,
  `FIX-KILL` would silently pass (6s completes under the 60s default) instead of
  failing with `"timed out after 2s"`. This differential is the actual proof:
  pre-fix, A2 fails (the underlying check wrongly exits 0 and the evidence string
  never appears); post-fix, A2 passes (the underlying check correctly exits 1 with
  that exact evidence string). No amount of yaml-declaration-grepping can produce
  this signal.
- **A3** exercises the same fixture through `gate --run-checks`, not just direct
  `check`, closing the gap between "the primitive works" and "the thing the gate
  actually calls works."
- **A4 (fixture-cli-fallback.yaml)** isolates the *second* bug (the `--phase all`
  Namespace) with a single-check, single-phase fixture so its exit code is
  unambiguous, and drives it specifically through `--phase all --run-checks
  --timeout-seconds 2` against a 5s sleep with no declared `timeout_seconds` at
  all — i.e. it only has the CLI value to fall back on. Pre-fix this loop drops
  the CLI value and the phase wrongly passes; post-fix it's honoured and the
  phase correctly fails.
- **A5 (fixture-list-format.yaml)** is the regression control — the sibling
  internal-list-format schema never goes through the buggy conversion branch and
  must be provably unaffected by whatever the fix changes.
- **A6 (fixture-zero-timeout.yaml)** is the truthiness-trap fix: `0 or X`
  evaluates to `X` in Python, so a declared `timeout_seconds: 0` was
  indistinguishable from "not declared." Decided semantics: **0 (or negative) is
  invalid, not "unlimited" and not "use the default"** — `validate` must reject it
  outright rather than silently reinterpreting it. The runtime check itself should
  also move to an explicit `is not None` test as defense in depth, so this class of
  trap can't recur even if some future caller skips `validate`.
- **A7** is the standing hard constraint (itn/route.ts untouched) — this fix has
  no legitimate reason to touch it, so it's asserted as a guard, not because the
  fix logic requires it.
- **A8** re-validates constraint 5: composes the already-shipped
  `check-known-ids-timeouts.mjs` (built for the lock-cleanup-fix contract's A4)
  with A1-A4's proof that declarations are now actually enforced, to confirm the
  original inversion (`60s kill ceiling < 90s LOCK_WAIT_MS`) is genuinely closed —
  without re-running the live, credentialed payfast-m1 suite, which is out of
  scope for this fix and unnecessary: A1-A4 already prove the enforcement
  mechanism generically at the exact layer those checks route through.

## The bootstrap problem, and how it's resolved

Every assertion in `contract-check-timeout-enforcement.yaml` itself declares an
explicit `timeout_seconds` — which, by the very nature of this defect, only
actually governs anything once dev's fix has landed in `execution/contract.py`.
This isn't circular in practice, because of workflow ordering: architect writes a
purely declarative contract (no code runs) → **dev implements the fix** → only
then do qa/gate ever execute these assertions. By the time any assertion here
actually runs, `execution/contract.py` already has the fix, so each assertion's
own `timeout_seconds` (15-30s) is genuinely enforced when it runs.

Belt-and-suspenders: even if some assertion here were ever executed against a
*pre-fix* `contract.py` (e.g. someone runs `contract check` by hand before the fix
lands), none of A1-A8's own declared `timeout_seconds` values (10-30s) would be
starved — they're all comfortably below the pre-fix 60s CLI default anyway, so the
outer harness call would still complete without spuriously timing out; only the
*verdict* (pass/fail) of A1-A6 would be wrong pre-fix, which is exactly the
signal the gate is supposed to catch.

## Upstream PR requirement — regression risk

`execution/contract.py` is Athanor harness template code, not SAOC application
code. Per this project's rule (`.claude/rules/scope.md` / standing user guidance
for harness defects): **fix locally in this repo AND open a PR upstream to
InunuNet/Athanor.** Do not fix only here.

**Explicit regression risk:** if this fix lands only in the local
`execution/contract.py` copy and is never PR'd upstream, the next
`make update-template` run will silently overwrite it with the unfixed template
version, reopening this exact defect (and re-inverting the payfast-m1 lock-wait
fix) with no warning at update time. The fix must be small, self-contained, and
cleanly portable as a template patch:

1. In `normalize_contract()`'s checks-conversion loop (~line 136), copy
   `check.get("timeout_seconds")` into the `verify` dict when present.
2. In `check_cmd()` (~line 275), change
   `verify.get("timeout_seconds") or getattr(args, "timeout_seconds", 60)` to an
   explicit `is not None` check.
3. In `gate_cmd()`'s `--phase all` loop (~line 522-528), add
   `timeout_seconds=getattr(args, "timeout_seconds", 60)` to the `Namespace` it
   constructs.
4. In `validate_cmd()`, reject any shell-kind assertion whose `timeout_seconds` is
   present and not a positive integer.

None of these touch the contract schema, the CLI surface, or any other command —
minimal, mechanical, and should apply cleanly as an upstream patch.

## Constraints carried from the task brief

- `app/api/tickets/itn/route.ts` is sha256-pinned — never touched (asserted, A7).
- No Firestore document is deleted by this fix or its fixtures; the fixtures in
  this contract only ever run `sleep`/`exit` — no Firestore access at all. Live
  `DOOR-QR-*` fixtures and `SAOC-2027-ZNYT37Z88MSH` are untouched, unreferenced,
  and out of scope for this fix.
- Zero `agent_review` assertions — all 8 are `shell`, binary, machine-verifiable.
