# F9 (vendor-registration) — permit posture: decision record

Full source: mission brief inline F9 and its "Regulatory note" section
(`.agent/memory/project/missions/2026-08-17-vendor-registration.md`).

## What this feature is (and is not)

F4 already collects three regulatory fields as free text with zero validation:
`phytosanitaryPermitNumber`, `citesPermitNumber`, `foodHandlingCertificateNumber`. F9 does
**not** add validation, format checking, or any external-registry lookup for these fields —
whether SAOC is even obliged to verify them is a show-committee question, not an engineering
default (mission brief, verbatim). F9's entire scope is making the unverified status legible in
three places an admin or vendor would actually see it:

1. **Admin review UI** (components/admin/VendorReviewTable.tsx and/or app/admin/vendors/*) —
   render the three fields (previously not rendered anywhere in the review table at all — the
   pre-F9 table shows only business name, contact, category, status, actions) with an adjacent
   note.
2. **Vendor confirmation email** (emails/VendorRegistrationConfirmation.tsx, F5) — the file's
   own pre-existing comment already flags this as deferred: "no regulatory permit
   non-verification note (that is F9's later edit to this same file)".
3. **docs/vendor-registration.md** — a committee-facing sentence, replacing/supplementing the
   doc's existing F9 placeholder line ("Adds a non-verification notice to the confirmation
   copy explaining what SAOC does (and does not) do with permit numbers").

No prop-signature changes are required anywhere: `VendorReviewTable` already receives full
`VendorSubmission[]` rows (the three fields are already on the type), and the email component's
new copy is static text, not data-driven. This is why F5's and F6's own typecheck fixtures
(which pin exact prop interfaces) are expected to need no changes — A6 proves this by re-running
both features' check suites unchanged.

## Why adjacency/sentence-proximity discriminators, not plain grep

A naive "does the string appear anywhere in the file" grep would pass on a note placed in an
unrelated comment, a changelog header, or (for A4) three unrelated sentences that each happen to
contain one of "show committee" / "verification" / "decision" without ever making the claim this
feature requires. This was not a hypothetical: **the real pre-F9 `docs/vendor-registration.md`
independently contains all three of A4's required terms in three unrelated places** — "show
committee" in the F4 validation-scope note (line ~116), "verification" in a QA checklist heading
("Integration checklist for QA/verification", line ~257), and "default" in the rate-limit
constants caveat (line ~218) — and a plain co-occurrence check passed against it during
development before the sentence-proximity fix. A4 and A2 both require the relevant terms/phrases
to co-occur within a bounded window (one sentence for A4, 20 lines for A2), and both are
self-tested against a fixture reproducing exactly this scattered-but-not-connected shape, which
must fail.

## A5's honest limitation

A5 is a negative pattern scan (no `verifyCitesPermit`-shaped identifiers, no
lookup/verify/registry-flavoured names combined with the three field concepts, anywhere under
`lib/`, `app/`, `components/`). Pattern-based negative scans cannot prove universal absence — a
real verification integration written under a sufficiently disguised name would defeat this
specific check without defeating the *intent* behind it. This is a known, accepted limitation,
not a gap this contract silently ignores: it is why F9's own feature description
(`contract-vendor-f9-permit-posture.yaml`) states the same prohibition in narrative form for a
human/QA reviewer, not just in A5's regex list.

## A6 regression — all 6 unchanged F5/F6 checks pass, one file deliberately excluded

Run 2026-08-18: all 7 of F6's check scripts pass unchanged
(`check-additive-patch-injected-time.mjs`, `check-capability-added-and-role-bundles.mjs`,
`check-closed-transition-machine.mjs`, `check-no-pii-in-logs.mjs`, `check-route-wiring.mjs`,
`check-zero-authorization-carrythrough.mjs`, `check-http-fails-closed.sh`), and all of F5's
top-level checks pass unchanged, including A9 (`check-http-rate-limit-per-ip.sh`).

`check-env-scrub-effective.mjs`, which lives in F5's checks directory, is deliberately **not**
invoked standalone by A6's regression runner. It is not an independent assertion in F5's own
contract (`contract-vendor-f5-register-route.yaml` has no A-id for it) — it is an internal
helper that `check-http-rate-limit-per-ip.sh` (A9) invokes itself, WITH the identical
scrub-env prefix it is about to launch the real dev server with (see that script's own "(0)
Self-verifying scrub" comment and this .mjs's own header comment: "invoked by
check-http-rate-limit-per-ip.sh with the identical env prefix it uses to launch the real
server"). An earlier version of A6's regression runner invoked it directly with no scrub
prefix applied, which made it read a real `.env.local` and false-positive as a "regression" on
any machine with real credentials configured — that was a bug in the regression runner, not a
real F5 regression, and not a pre-existing baseline condition. It is fixed: A9 already
exercises `check-env-scrub-effective.mjs` correctly as part of its own run, and the regression
runner now skips it explicitly rather than re-invoking it without the prefix it requires.

## British English / scope note

CITES wording in both the admin note and the email copy stays strictly about permit numbers for
cultivated plant sales (F4's existing framing) — nothing about conservation policy, which is
WOSA's domain, not SAOC's.
