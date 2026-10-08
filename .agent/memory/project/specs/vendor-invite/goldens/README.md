# Vendor Invite (mission `vendor-invite`, M1/F1) — Decision Record

## The ask, verbatim (Brad, 2026-10-08)

> "We can add the invite a vendor to the admin section thats a good idea, Lee-Ann wants the
> vendor form to be the contract between the SAOC and the Vendor." / "you can dispatch add
> invite to backend."

## Why this exists

Lee-Ann's real-world process is invite-first: the committee already knows which nurseries
they want at the show and invites them. Her vendor form opens "We are pleased to welcome you
as a pre-approved vendor" — the form itself, not the application stage, is the contract. The
site's current flow only supports the opposite direction: public apply → admin review →
code emailed. This feature adds the missing direction without touching the form that is the
contract, and without touching the public apply path at all.

## What actually ships today vs. what the mission brief described

The mission brief (and the stale `docs/vendor-gated-registration-flow.md` M1 section) describes
a single-use HMAC **token** mailed as a `?token=` link. That mechanism was superseded in M4
(`vendor-gated-registration-flow`, F22–F25): approval now mints a **human-readable 4-digit
code** (`lib/vendor-registration-code.ts`), paired with a `?name=&code=` convenience link, with
its own lockout/reissue machinery. This contract is written against the **real, current**
mechanism — `app/api/admin/vendors/applications/[id]/review/route.ts`'s `'approve'` branch — not
the stale token-era description. Reusing "the existing single-use registration token" per the
brief means, concretely, reusing `generateVendorRegistrationCodeId()` +
`normalizeVendorCodeName()` + `sendVendorApprovalConfirmationEmail()`, exactly as approval
already does.

## Persistence: a `vendorApplications` document, already `approved`, marked `origin: 'invited'`

**Decision:** an invite creates one new `vendorApplications` document in a single `.add()` call,
with `status: 'approved'` from the moment it is created (never passing through `'pending'`), plus
a new `origin: 'invited'` field.

**Why this, not a status spliced onto `vendorSubmissions`, and not a third collection:**
`vendorApplications` already carries every field an approved-with-a-code application needs
(`registrationCodeId`, `registrationCodeNameSlug`, `registrationCodeExpiresAt`, etc.) and the
entire review list, reissue-code action, and `verifyVendorRegistrationCode()` lookup already key
off this one collection. A third collection would duplicate all of that machinery for no benefit;
splicing onto `vendorSubmissions` would violate the M1 decision (recorded in
`vendor-gated-registration-flow`'s own golden README) that applications and submissions are
permanently distinct entities. `origin` is additive, optional, and absent (meaning `'public'` by
convention) on every one of the ~dozens of pre-mission documents — no backfill migration needed.

**Why `status: 'approved'` directly, never `'pending'`:** `decideVendorApplicationTransition()`'s
closed machine (`lib/vendor-application-review.ts`) is `pending --approve--> approved`. An invite
has no human on the other end to approve — the inviting admin's action **is** the approval. Routing
an invite through a fake intermediate `pending` state and then auto-transitioning it would be
security theatre: nobody reviews it, so nothing is actually gated by passing through that state,
and it would need a second, invite-only actor to immediately self-approve, which
`decideVendorApplicationTransition()` deliberately has no concept of (and should not grow one —
its whole value is being a small, closed, authorization-blind machine). Writing the final state
directly, atomically, with `reviewedBy`/`reviewedAt` set to the inviting admin and `now`, is the
honest representation: this admin reviewed it by inviting it.

## Why `vendorCategory` and `indicativeBoothCount` become optional, not sentinel-valued

An invited vendor has told the committee nothing yet about their product categories or stand
count — that is precisely the information the full registration form (the actual contract) will
collect. Three options were considered:

1. **Invent a placeholder** (`vendorCategory: ['other']` — except there is no `'other'` member in
   the 14-item closed set; or `indicativeBoothCount: 0`, which reads as "zero stands requested,"
   a false statement). Rejected: this is exactly the "no invented data" failure mode —
   fabricating a value nobody supplied.
2. **A sentinel like `-1` or an empty array `[]`.** Rejected: `[]` would pass the type checker
   but is indistinguishable from "the vendor checked no categories," a different false
   statement; a magic-number sentinel on `indicativeBoothCount` invites exactly the kind of bug
   this project's own `firestore-undefined-write-safety` incident was about — a value that looks
   present but means absent.
3. **Make the fields genuinely optional** (chosen). `vendorCategory?: VendorApplicationCategory[]`
   and `indicativeBoothCount?: number` represent "not yet known" by being absent, which is what
   they actually are for an invited, not-yet-self-reported vendor. The one place in the entire
   repository (outside `lib/vendor-applications.ts`'s own public-apply validator, which is
   untouched and still requires both fields for the public path) that read either field
   non-optionally was `components/admin/VendorApplicationReviewTable.tsx` — confirmed by a
   repo-wide grep before this decision was made, not assumed. That is the one render guard this
   contract requires (A7).

## Duplicate-invite eligibility: case-insensitive email match, `declined` is not a conflict

**Decision:** before creating an invite document, the route fetches the full
`vendorApplications` collection (same full-`.get()` pattern the existing admin list route at
`app/api/admin/vendors/applications/route.ts` already uses) and runs a pure decision function,
`decideVendorApplicationInviteEligibility()`, against it:

- An existing `'pending'` application for the same `contactEmail` (compared
  case-insensitively) blocks the invite — the committee should review that submission via the
  existing approve/decline action, not create a second, parallel document for the same vendor.
- An existing `'approved'` application for the same email blocks the invite — that vendor
  already has a live code; the existing **Reissue code** action
  (`POST /api/admin/vendors/applications/[id]/reissue-code`) is the correct tool to resend or
  refresh it, not a second document with a second, independent code.
- An existing `'declined'` application for the same email does **not** block the invite. A
  decline is a point-in-time committee decision; nothing in the spec or Lee-Ann's process
  suggests it should permanently blacklist a vendor from ever being invited in a later cycle.
  The new invite is a fully independent document — it does not resurrect or modify the declined
  one.

**Known, accepted limitation — full-collection scan, not an indexed query.** Firestore's
equality `where()` is case-sensitive, so a case-insensitive duplicate check cannot be expressed
as a single indexed query without maintaining a second, lowercased mirror field — out of scope
for an admin tool whose expected volume is dozens of invites per show cycle, not thousands. The
existing GET list route already fetches the whole collection for the same reason. If
`vendorApplications` ever grows past a few hundred documents this becomes the wrong tradeoff;
noted here for whoever revisits it.

## Email: the existing approval email, verbatim — and the one copy GAP for Brad

**Decision:** the invite route calls the exact existing
`sendVendorApprovalConfirmationEmail()` (`lib/vendor-approval-confirmation.ts`) and the exact
existing `emails/VendorApprovalConfirmation.tsx` template — no new email module, no new
institutional copy. This is a direct instruction from the brief ("Reuse the EXISTING approval
email template and copy. No new institutional copy... If a new sentence is unavoidable, list it
as a GAP for Brad instead of writing it.")

**GAP for Brad:** the existing template's subject line, when a `registrationLink` is present, is
*"Your SAOC vendor application has been approved."* For an invited vendor, there was no prior
application from them to approve — the phrase is slightly inaccurate in that direction. Lee-Ann's
own vendor-form document opens with *"We are pleased to welcome you as a pre-approved vendor"* —
a framing that would fit an invite more naturally. This contract does **not** write that new
sentence or branch the subject line by `origin`, because doing so is an institutional-copy
decision this contract has no authority to make unilaterally. Flagging it here for Brad/Lee-Ann
to decide; until then, invited vendors receive the same "application has been approved" email
public applicants get.

## Why no admin-notice email fires on invite

`docs/vendor-flow-notifications.md` wires three admin-facing notices at three moments: a vendor
submits an application, a vendor completes full registration, a vendor's stand payment clears.
All three exist so **other** admins learn about something a vendor did. An invite is the inverse:
the acting admin is the one who did it. Firing "new vendor application submitted" at the admin
who just submitted it themselves (via the invite form) would be a self-notification with zero
information value, and it would require either lying about who the email is "about" or inventing
a fourth, invite-specific admin-notice template — out of scope per the brief's "no new
institutional copy" instruction, and not asked for. Other committee members already see the new
`approved`/`origin: invited` row the next time they load `/admin/vendors/applications`. A8 encodes
this as a structural absence check so a future change can't silently reintroduce admin-notice
noise on this path without the contract being revisited.

## Hard no-touch constraint: three files belong to a concurrent branch

A concurrent branch (NOS Site, vendor-form mission) is editing
`lib/vendor-approval-confirmation.ts`, `emails/VendorApprovalConfirmation.tsx`, and
`app/api/admin/vendors/[id]/review/route.ts` for per-day staff fields, against the same
`origin/main` this branch is built from. This feature **calls**
`sendVendorApprovalConfirmationEmail()` — exactly as the existing
`app/api/admin/vendors/applications/[id]/review/route.ts:223` already does today — but must
**never modify** any of those three files' content. Calling a shared function is normal reuse;
editing a file someone else is actively changing on a sibling branch is how two concurrent
missions silently clobber each other at merge time.

**Enforced as A11, a real `git diff --quiet origin/main -- <path>` check, not a promise in
prose.** The `[id]` directory segment in `app/api/admin/vendors/[id]/review/route.ts` is passed
through git's `:(literal)` pathspec magic (`":(literal)app/api/admin/vendors/[id]/review/route.ts"`),
because git's default pathspec matching treats `[id]` as a glob character class (matching a
single literal `i` or `d`), which would silently fail to match the real, literally-bracketed
directory name. Verified directly against this repository before being written into the
contract: `git diff --quiet origin/main -- "app/api/admin/vendors/[id]/review/route.ts"` and the
`:(literal)`-prefixed form were both confirmed to resolve to the correct file via
`git log -- ":(literal)...”`.

**If F1's own needs ever seem to require a change to one of these three files** (for example, if
the email needs a new field this feature's invite path alone would supply), the correct response
is to stop and flag the conflict for Brad/the orchestrator to sequence between the two branches —
never to resolve it unilaterally by editing the file anyway. A11 will catch that regardless, but
the right failure mode is "flagged before being attempted," not "caught by the gate after the
fact."

## Capability gating

Reuses `review-vendor-applications` via `lib/admin-auth.ts`'s `hasCapability()`, identically to
the existing review and reissue-code routes in the same directory. No new capability string is
introduced anywhere (A8 also checks this, as an absence proof).

## Firestore undefined-write safety

`buildVendorApplicationInvite()` follows the exact pattern `buildVendorApplication()` already
established (see `docs/firestore-undefined-write-safety.md`): every field copied individually,
never a `{ ...input }` spread (so a caller cannot smuggle `status`/`origin`/`id` through the type
system even if they bypass TypeScript), wrapped in `stripUndefinedProperties()` before the object
ever reaches `.add()`. `tradingName`, `vendorCategory`, `indicativeBoothCount` are never assigned
a key at all for an invite-built document — not `undefined`, not `null`, not `[]` — genuinely
absent, matching what "not yet known" means for these three.

## Timestamp serialisation

No change needed. `lib/firestore-serialization.ts`'s `serializeVendorApplication()` already
converts any Timestamp-shaped value structurally (duck-typed `.toDate()`), at any depth, under
any key name — an invite-created document is read back through the exact same GET list route and
the exact same serializer as every publicly-applied document, with zero special-casing.

## What this contract does NOT prove

- Real Resend delivery (A2's wiring proof and the reused `sendVendorApprovalConfirmationEmail`
  module's own existing coverage are composition-level, not a live send).
- The admin UI's visual design (no new colours, fonts, or layout primitives are introduced;
  `VendorInviteForm.tsx` reuses the existing error-banner and button class-name vocabulary
  verbatim).
- Behaviour at a `vendorApplications` collection size where the full-collection-scan duplicate
  check becomes the wrong tradeoff (see "Known, accepted limitation" above).
- Whether Brad/Lee-Ann resolve the subject-line copy GAP, or how.
