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

## A6 regression — one pre-existing, unrelated failure observed

Run 2026-08-18, against the repository baseline (before any F9 edits):

- All 7 of F6's check scripts pass unchanged (`check-additive-patch-injected-time.mjs`,
  `check-capability-added-and-role-bundles.mjs`, `check-closed-transition-machine.mjs`,
  `check-no-pii-in-logs.mjs`, `check-route-wiring.mjs`,
  `check-zero-authorization-carrythrough.mjs`, `check-http-fails-closed.sh`).
- 7 of F5's 8 check scripts pass unchanged. **`check-env-scrub-effective.mjs` fails in this
  sandbox** — it asserts that `FIREBASE_ADMIN_*`/`NEXT_PUBLIC_FIREBASE_*` are empty after the
  real Next.js env-loading path runs, and fails because this development environment has a real
  `.env.local` with live-looking values loaded. This failure is **present on the unmodified
  baseline, before any F9 file is touched** — it is an environment condition of this sandbox
  (a populated `.env.local`), not a regression F9 introduces. A6/the regression runner will
  faithfully report this failure if run in the same conditions; that is correct behaviour, not
  a bug in A6. It is not F9's place to alter F5's own check script or its pass/fail semantics.
  If A6 is red only on `check-env-scrub-effective.mjs`, re-verify F9's own edits (A1-A5) did not
  touch anything email/env-related before treating it as a real F9 regression.

## British English / scope note

CITES wording in both the admin note and the email copy stays strictly about permit numbers for
cultivated plant sales (F4's existing framing) — nothing about conservation policy, which is
WOSA's domain, not SAOC's.
