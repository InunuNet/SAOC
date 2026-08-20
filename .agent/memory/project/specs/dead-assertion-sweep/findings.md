# Dead-assertion sweep — findings (2026-08-20, read-only audit)

Prompted by two dead assertions found BY ACCIDENT during `payment-provider-seam`, both in one
suite. Neither was found by looking. Scope below is honest about what was NOT covered.

## Scanned
- All contract `command:` fields diffed against every executable under `contracts/checks/`
  (registered-nowhere scan).
- `contract-payfast-m1` A18 cross-checked against current route + adapter source.
- `mission.py` contract auto-discovery vs all 28 mission files' frontmatter.
- Count of scoped `tsconfig.typecheck.json` (21; corroborates the known ~20 figure).

## NOT scanned
Assertion *bodies* in the other ~90 contracts for proximity / wrong-question / result-discarded /
vacuous shapes. **The sweep is incomplete and must not be read as clean.** Both real findings came
from checking a specific claim against source, not from generic pattern matching — a follow-up
sweep should read assertion bodies contract-by-contract.

## Finding 1 — CONFIRMED, highest consequence
`contracts/contract-payfast-m1.yaml:162-172` **A18 asserts the INVERSE of shipped behaviour.**
It claims "source-IP validation genuinely gates the ITN write path… bogus IP → ticket stays
untouched". `app/api/tickets/itn/route.ts:69-86` deliberately does NOT enforce: "LOGGED, NOT
ENFORCED (2026-08-18)… source IP is defense-in-depth only and must never be able to reject a
payment". `sourceIpTrusted` feeds `console.warn` only and gates nothing.

Verified directly by the orchestrator. **This is a DIFFERENT A18 from the one removed during
payment-provider-seam** (that one was a member of `payment-seam-f2`'s
`check-itn-behaviour-unchanged.sh` suite). Two assertions share the number in different contracts;
the orchestrator briefly conflated them and reported this one as already fixed.

Passed 5/5 historically for an unrelated reason (`order-not-found`). LOCAL-ONLY: exits 0 as a skip
without credentials, so it rarely runs and has never meaningfully been red. @architect dispatched
to invert (assert untrusted-IP + valid signature + server confirm STILL reaches `paid`, locking in
the 2026-08-18 decision) or retire, with the silent-skip hazard addressed.

## Finding 2 — CONFIRMED wiring gap / SUSPECTED assertion health
**10 real contracts (~60 assertions) under `.agent/memory/project/specs/` are unreachable by
`mission.py gate`.** `execution/mission.py:769-793` `_existing_contract_for_feature` only
auto-discovers `specs/<mission-slug>/contract-f<N>.yaml`; none of these directory names match any
mission's `slug:`. Affected: admin-signout-revocation, admin-nav-active-state, admin-nav-menu,
order-reconciliation, reconcile-response-accuracy, reply-to-header-fix,
confirmation-page-qr-and-download, ticketing-capacity-reconciliation-hold,
ticketing-position-expiry-write, vendor-page-fixes (f1+f2).

`2026-08-18-production-blockers.md` has `features: []` and `milestones: []` despite `status: done`
— that batch was tracked by dispatch-naming convention only, never entered in the ledger.

**Highest-value orphan: `admin-signout-revocation/contract-f1.yaml`** — a real auth/session
contract whose A3 (cross-user force-sign-out) and A6 (session-replay weaponisation) were, per their
own text, observed failing pre-fix. Only `order-reconciliation` has any evidence of a manual run.
Individual assertion health inside these ten is UNVERIFIED.

## Ruled NOT dead (recorded so they are not re-investigated)
`payment-seam-f2/{code_lines.py, discover_route_pins.py, readiness_gate.py}` and
`ticketing-hardening/_checkin-harness.mts` are library imports used by referenced siblings.
The ~21 `fixtures/*-typecheck.ts` are compiled via their own tsconfig — the known
"invisible to root gate" pattern, not registered-nowhere. Three scope guards
(`contract-check-timeout-enforcement` A7, `contract-payfast-m1-lock-cleanup-fix`
A0-ITN-UNTOUCHED, `contract-payfast-m1-residue-cleanup` A12) are known and expected.

## Recommended order of repair
1. A18 (in progress) — one file, and it currently misdescribes a security boundary.
2. Decide the orphaned-contract question: register the 10 into a tracked mission, or accept that
   ad-hoc missions bypass `mission.py gate` and hand-run `contract.py gate` on each with the
   result recorded durably. `admin-signout-revocation` first, given what A3/A6 guard.
3. Follow-up sweep of the remaining ~90 contracts' assertion bodies.

---

## Follow-up: `admin-signout-revocation/contract-f1.yaml` re-run 2026-08-20 — PASS, 6/6, all real

Re-run against a freshly-built isolated production server (port 3400 via
`contracts/checks/admin-auth-hardening/server-ctl.sh`), then each check re-run directly to see
untruncated output and true exit codes. **No assertion skipped**; all required env vars present,
so no `skipForMissingCredentials` exit-0-as-pass ambiguity arose.

Each was checked for tonight's failure shapes rather than accepted on its green:
- **A1** behavioural revocation — re-presents the SAME cookie after DELETE; would fail against
  dead code or a swallowed error.
- **A2** unconditional cookie clear — 3 sub-cases (absent / garbage / well-formed fake JWT), each
  asserting `max-age=0`; catches an implementation that only clears on successful uid resolution.
- **A3** crafted-uid attack — authenticates as fixture A, sends B's uid in body/query, proves B's
  cookie still works AND A's own is revoked. A real cross-user probe, not a source grep.
- **A4** — **deliberately weak by its own description** (presence of a doc comment, not
  behaviour). Its pass was explicitly NOT treated as strong evidence. Greps re-run by hand and
  confirmed adjacent to the real call site, not a coincidental match.
- **A5** handler reads no body/query — verified against route source.
- **A6** (the Codex 2026-08-19 replay finding) — **the model assertion of the whole corpus.** Both
  buggy and fixed code return 200 on a replayed revocation, so HTTP status cannot distinguish
  them. It therefore uses a SECOND INDEPENDENT OBSERVABLE — `tokensValidAfterTime` from the Admin
  SDK: first DELETE changes it, replay returns 200 but leaves it UNCHANGED. **Measured through a
  channel the bug cannot fake.** This is the technique the weak assertions in this repo all lack.

**SCOPE CAVEAT — does not transfer.** Every check targeted `http://127.0.0.1:3400`, a locally
built server from the current working tree. **The DEPLOYED admin surface remains unverified**, and
the deployed allowlist divergence (parsed length 1 vs 5 local) still blocks that. No secret or
config was touched.

**Conclusion: the orphan-contract worry was right to raise and wrong in this instance.** Being
unreachable by `mission.py gate` did not mean stale — this contract is accurate against current
code. The wiring gap is still real; the assertions behind it are not automatically rotten.

---

## Second sweep, 2026-08-20 — assertion BODIES, money/admission/auth families

**PARTIAL COVERAGE: 7 of 23 contracts read in full.** NOT read (do not treat as clean):
`contract-admin-auth-{f3-provisioning,f4-google,f5-federated}.yaml`, `contract-d5-admin-dashboard`,
`contract-ticketing-f1`..`f9`, `-f11`, `-hardening`, `-m1-m2`, `-show-window-lookup`.
Next priority: `ticketing-hardening` and `ticketing-m1-m2` (largest, oldest, most surface).

### CONFIRMED — `contract-payfast-itn-signature.yaml:102-108` A7 is red against CORRECT code
It pins the literal `generateSignature(signedFields, passphrase)` in
`app/api/tickets/checkout/route.ts`. **Tonight's own commit `0b39a86` moved outbound signing into
`lib/payments/payfast.ts:231`.** Verified by orchestrator: the grep exits 1.

**Opposite failure direction from the rest of the night** — it hides no defect; it reports a FALSE
REGRESSION. The danger is that someone "fixes" it by restoring signing into the route, undoing the
seam.

**How we shipped it: we ran only the payment-seam contracts.** F2's A5b discovers every assertion
touching the rewired ROUTE FILE — which is why the route's five golden pins were found — but
nothing does the equivalent for **SYMBOLS THE SEAM MOVED BETWEEN FILES**. `generateSignature` left
the route; A7 pinned it there; no discovery walked that edge.

**Backlog (assessment requested, build deferred):** a discovery check that, given symbols relocated
by a change, finds every contract assertion whose `command:` references those symbols alongside a
path they no longer occupy. `discover_route_pins.py` already parses `command:` fields via YAML.

### Read and SOUND (verified by running commands / git history, not by description text)
- `contract-admin-auth-hardening` — the strongest in the repo: real HTTP round trips, a genuine
  negative control (A-NEGCTL-01 proves the probe harness itself CAN fail), fail-closed enumeration
  over 4 unenumerated states, and A-STATE-02 proving `checkRevoked` is actually wired rather than
  an unused parameter. It explicitly documents why `contract-d5-admin-dashboard` D5-04 was a
  false-green grep.
- `contract-payfast-m1-lock-cleanup-fix` — every behavioural claim pairs with a "prove it can
  actually fail" step (A3, A10, A14, A19) plus a self-test.
- `contract-ticketing-checkout-orders` A3-A6 — run directly; pass for the stated reason.
- `contract-payfast-m1-residue-cleanup` A10 — includes deliberate NEAR-MISS documents that must
  NOT match. A real negative control.
- `contract-ticketing-f10-itn-repin` A8 — pin matches `09adc6fc…`. Its *description prose* still
  cites the old hash `253c15c4…`: stale prose, not a functional defect, since the command checks
  the live golden file.

**Note the ratio: 1 finding in 7 contracts.** The corpus is in better shape than the night's early
findings implied — the weak assertions cluster in `payfast-m1`, which is also the oldest and most
frequently amended.
