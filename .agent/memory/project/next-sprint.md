# Next Sprint — ordered plan (written 2026-09-01 by @maintainer)

Read this first after compacting. Ordered by urgency; each item states what "done" looks like.
Full backlog remains the source of truth for everything not listed here — see `backlog.md`.

---

## 1. Verify the vendor demo flow end to end on beta.saoc.co.za — HIGHEST PRIORITY

Why first: the demo is tomorrow morning and the flow is unproven in production. Tonight's ship
(`vendor-stand-early-bird-pricing` + `stand-payment-link-visibility` + the two HMAC secrets in
`d879514d`) has never been exercised as one real sequence against the live deployment.

Done = a real run against `beta.saoc.co.za`, not localhost: vendor application → admin approval
(mint + copy payment link from the review table) → registration via the gated link → stand
pricing resolves correctly on both sides of the 90-day early-bird cutoff → payment link works
with the now-present HMAC secrets. Confirm via BrowserAgent or manual click-through with
screenshots, not by re-reading the gate output — the gate already proved the code; this proves
the deployment. If anything breaks, it is P0 and takes priority over everything below.

## 2. Independent adversarial pass on the four rewritten M3 checks (A55, A60-A62)

Why second: these were edited to match a redesign after the export they were fixtured against
was removed. The reasoning is sound and the gate is green, but this project's own known hazard is
checks edited until they pass — see `learned.md` "Checks rewritten to match a redesign need an
independent adversarial pass." Not yet independently reviewed.

Done = a fresh @qa or Codex pass (not the same agent that wrote the rewrite) confirms each of the
four checks still proves a real property against the current code, not just against its own new
premise. Report PASS/FAIL per check with the actual assertion reasoning, not just "gate is green."

## 3. Contract-decay audit (P1)

Why third: two checks were found rotted from unpropagated renames today alone (by accident, not
by a process that would have caught them systematically). This is now a recurring failure mode
across the project (see the multiple "contract decay" notes logged throughout the session diary
in `backlog.md`'s Contract & test infrastructure section).

Done = a pass across all `contracts/*.yaml` that: (a) confirms every check still imports/derives
from a live export (no stale fixtures against removed code), (b) flags any check whose premise no
longer matches current behaviour, (c) either fixes or logs each finding individually rather than
one blanket "still fine" verdict. Start from the contracts already flagged as having known decay
in `backlog.md` (`contract-ticketing-f4-admission-products.yaml` A3/A6/A8; vendor F5/F6 contracts)
rather than starting cold.

## 4. Restore the deferred legacy-order `tier` check for stand pricing (P2, already in backlog)

Why fourth: real stand payments are now live-capable as of tonight's secret fix, so the deferred
RED check (proving a pre-existing `tier`-less `vendorStandOrders` document still settles and
renders identically) stops being theoretical the moment the first vendor actually pays. Not
urgent tonight because no real stand order exists yet, but it should land before, not after, the
first one does.

Done = the RED check exists, is wired into `contracts/contract-vendor-stand-early-bird-pricing.yaml`
(or a sibling contract), and passes against a synthetic legacy document with no `tier` key.

## 5. Register Society — society profile intake + registration flow (P2, blocked)

Why last, not dropped: blocked on Lee-Ann for the affiliation/approval half — do not scope that
half from the website-information form alone (it only covers content, not affiliation). The
profile field set IS captured and unblocked.

Done for the unblocked half = an @architect pass on the profile-content model only (public form →
Firestore → admin review, reusing the vendor pipeline's proven shape), explicitly NOT including
an affiliation/approval flow until Lee-Ann answers what a society must submit to affiliate. Ask
her that question this sprint if there's an opening — it's the one thing unblocking the rest.

---

## Also worth a look, not blocking the above (from backlog, unranked)

- P1 items blocked on Brad (human action): live PayFast credentials, DNS cutover, the 53MB zip in
  git history, the live `roles`-claim migration, rotating `FIREBASE_ADMIN_PRIVATE_KEY`.
- P1 items blocked on the council/Lee-Ann: ticket prices/capacities (draft estimates per standing
  instruction, already partly done), refund/cancellation terms (draft ourselves), POPIA Information
  Officer implementation, Stellenbosch travel content, the two vendor T&Cs contradictions.
- These are unchanged from before tonight — see `backlog.md`'s "Blocked on Brad" and "Blocked on
  the council / Lee-Ann" sections for full detail. Nothing here needs re-triage this sprint unless
  Brad or Lee-Ann has answered something.
