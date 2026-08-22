# F3 (ozow-payment-provider) — live sandbox proof protocol

F3 is a verification feature, not new production code. F1 (Ozow adapter), F2 (checkout wiring,
provider registry) and F2b (real `confirmNotification()`) are all done, gated, Codex-reviewed
per round, and `qa-apex` PASS. F3's job is to prove the whole thing actually works end-to-end in
a real browser against the real deployed dev site, that PayFast still works unaffected, and to
close the mission out with one final full-diff Codex pass and a docs check.

## 0. Prerequisite: this mission's code must actually be deployed before any BrowserAgent runs

As of 2026-08-22, `lib/ozow.ts`, `lib/payments/ozow.ts`, `lib/tickets-notification.ts`,
`app/api/tickets/ozow-itn/`, `components/tickets/ProviderChoice.tsx`, and the F2/F2b changes to
`app/api/tickets/checkout/route.ts`, `app/api/tickets/itn/route.ts`, and `lib/payments/index.ts`
are all **uncommitted, untracked or locally modified** (`git status --short`) — none of it exists
on `origin/main`, and Firebase App Hosting backend `saoc-prod` (project `saoc-webapp`, see
`docs/a7-firebase-checklist.md`) auto-deploys on push to `main`. **There is no separate manual
deploy step or `apphosting.yaml` change required** — this backend's build/deploy pipeline is
already wired and has deployed prior missions' work automatically (confirmed: `firebase
apphosting:backends:list` shows `saoc-prod`'s last `updateTime` as `2026-08-22T01:58:45Z`, i.e. it
already picked up a prior push today — but that rollout PREDATES this mission's HEAD commit time
of `2026-08-22T03:48:55` SAST, which is exactly what `check-deploy-freshness.sh` (A6) catches:
run against the current, still-unpushed tree on 2026-08-22, it correctly FAILS with "backend
'saoc-prod' last rollout (2026-08-22T01:58:45.545243Z) predates HEAD's commit time" — proving the
check discriminates a real not-yet-deployed state rather than passing vacuously).

**What F3 needs as a prerequisite is therefore: commit this mission's changes, push to `main`,
and wait for the rollout to land — not a deploy script.** Per this project's `.claude/rules/
workflow.md`, the orchestrator is the one who commits/pushes (never `@dev`/`@architect`); doing
so is itself gated on the rest of F3's checks (Codex full-diff pass, live purchases) actually
passing first is impossible since the live purchases need the code deployed — so the real order
is:
1. Orchestrator commits the full F1+F2+F2b+F3 diff (all features are otherwise done and gated).
2. Orchestrator pushes to `main`.
3. `check-deploy-freshness.sh` (A6) confirms the push landed AND the backend's rollout picked it
   up, before any BrowserAgent dispatch is trusted.
4. BrowserAgent live-purchase runs (A1/A2) happen against `https://saoc-prod--saoc-webapp.
   europe-west4.hosted.app`.
5. Final full-diff Codex pass (A4) runs against the same pushed diff.

This ordering is why `check-deploy-freshness.sh` exists as its own assertion rather than being
assumed: without it, a BrowserAgent run against a stale rollout would "pass" while testing
old/absent code, and nothing in the live-purchase artifact itself would reveal that.

## 1. The BrowserAgent live-purchase artifact schema

Per this project's `.claude/rules/coding.md` verification hierarchy ("Human input is the last
resort... every `agent_review` assertion is a challenge: can this be automated?"), a live
BrowserAgent purchase run's PASS/FAIL cannot rest on the agent's own prose summary — Codex
GPT-5.5 review has already found real bugs in code Claude wrote and Claude's own `@qa` had
already reviewed on this project (`.claude/rules/workflow.md`'s stated rationale for mandatory
cross-model review); trusting an agent's self-report of its own browser run has the identical
failure mode. So the BrowserAgent run must write a structured JSON artifact to a fixed path, and
a SEPARATE script (`check-live-purchase.mjs`) re-derives PASS/FAIL from that artifact plus a live
Firestore readback — never from the agent's chat output.

Artifact path convention (BrowserAgent writes here; each run gets its own file, orchestrator
picks the path when dispatching):

```
.agent/memory/scratch/ozow-f3-live-runs/<provider>-<ISO-timestamp>.json
```

Schema:

```json
{
  "provider": "ozow",
  "orderId": "<the Firestore orders/{id} document id, read from the app itself — not guessed>",
  "bookingRef": "<the booking reference shown on the confirmation page>",
  "startedAt": "2026-08-22T12:00:00Z",
  "completedAt": "2026-08-22T12:03:40Z",
  "steps": [
    { "name": "load-checkout-page", "pass": true, "screenshot": "01-checkout.png", "detail": "..." },
    { "name": "select-provider", "pass": true, "screenshot": "02-provider-select.png", "detail": "selected Ozow via ProviderChoice.tsx control" },
    { "name": "submit-checkout-initiate", "pass": true, "screenshot": "03-initiate.png", "detail": "POST /api/tickets/checkout returned 200 with redirect fields" },
    { "name": "redirect-to-gateway-sandbox", "pass": true, "screenshot": "04-gateway-sandbox.png", "detail": "landed on Ozow sandbox hosted page" },
    { "name": "complete-sandbox-payment", "pass": true, "screenshot": "05-sandbox-complete.png", "detail": "completed the sandbox payment flow (e.g. EFT-simulate/Complete button)" },
    { "name": "gateway-notification-received", "pass": true, "screenshot": null, "detail": "confirmed via Cloud Logging that /api/tickets/ozow-itn was hit and returned 200" },
    { "name": "order-reaches-paid", "pass": true, "screenshot": null, "detail": "polled Firestore orders/{orderId}.status until 'paid'" },
    { "name": "confirmation-page-shows-paid", "pass": true, "screenshot": "06-confirmation.png", "detail": "confirmation page rendered the paid state and booking reference" }
  ],
  "allStepsPassed": true
}
```

Screenshots are stored alongside the JSON in the same `ozow-f3-live-runs/` directory; the
`screenshot` field is a relative filename or `null` for steps that are verified by log/Firestore
inspection rather than visually (e.g. the webhook landing — there is nothing new to see in the
browser at that instant).

`check-live-purchase.mjs` requires ALL EIGHT named steps present with `pass === true` (a run
missing a step, or a run with any step `pass: false`, fails outright — this is a strict
allow-list, not "at least N steps passed") AND `allStepsPassed === true`, THEN independently reads
`orders/{orderId}` from live Firestore and asserts `status === 'paid'` and `gateway ===` the
expected provider id. The Firestore readback is the actual proof; the JSON schema is what makes
the BrowserAgent's own run auditable and stops a shortcut where the agent claims success without
having actually walked every step.

## 2. Two runs are required, not one

- `ozow-<timestamp>.json`, `expected-gateway=ozow` — the mission's actual subject.
- `payfast-<timestamp>.json`, `expected-gateway=payfast` — the regression proof for F2's
  registry/routing refactor, run against the SAME deployed build. This is not optional: F2's
  refactor touched `app/api/tickets/itn/route.ts` (extracted into `lib/tickets-notification.ts`)
  and `lib/checkout-reservation.ts` (gateway field threading), both on PayFast's live path. A
  contract assertion (F2's A4) already proves PayFast's ITN behaviour is unchanged at the request/
  response level; this proves the SAME thing end-to-end through a real browser and a real
  sandbox redirect, which is the standard this project has held itself to since the original
  `payment-provider-seam` mission's own F3.

Both runs' artifacts are checked independently (A1, A2); a combined check (A3) re-reads both
orders and additionally asserts their `gateway` fields are NOT equal to each other and each
exactly matches its own expected provider — guarding against the specific failure mode where
both orders accidentally end up tagged with the same gateway (e.g. a stale/cached provider
selection) even though each individually "reached paid."

## 3. Final full-mission-diff Codex GPT-5.5 pass (A4)

Per `.claude/rules/workflow.md`: "Codex is explicitly not a chain-dispatched subagent... the
orchestrator runs this directly via Bash." F1/F2/F2b each already had a per-round Codex pass
(all of which found and fixed real bugs — the readiness stub in F2b, the amount-display casing
bug and the replay/settlement gateway-mismatch bugs in F2). F3 additionally requires ONE MORE
pass across the ENTIRE mission diff as a single unit — not the latest round alone — because a
per-round review cannot see interactions between rounds (e.g. F2b's confirmNotification() fix
combined with F2's routing wiring, reviewed together for the first time here).

This is expressed as assertion A4 with a real, runnable command
(`git diff main...HEAD | execution/codex_qa.sh`), but it is expensive (an LLM call, not a
deterministic check) and is intended to be run ONCE by the orchestrator as part of closing this
feature out, not on every contract-gate re-run thereafter. Treat a re-run as free money spent
for no new information once it has passed once for a given diff; re-run it for real if the diff
changes after this pass (e.g. a fix is required in response to an A4 finding).

## 4. Docs completeness (A5)

`docs/payment-gateway-research-2026-08.md`'s HMAC→plain-SHA512 correction and
`docs/payment-seam.md`'s Ozow adapter section were both already written during F1/F2/F2b (see
`docs/payment-seam.md` §"Ozow adapter — `lib/payments/ozow.ts`" and the correction note at the
top of §2 in the research doc, both confirmed present on 2026-08-22 while writing this contract).
A5 is a grep-based regression guard confirming they are STILL present and still name the right
content — not a new writing task for F3.
