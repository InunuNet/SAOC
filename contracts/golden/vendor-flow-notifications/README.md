# G1 (vendor-flow-notifications) — admin notification emails: decision record

Source: `.agent/memory/project/specs/vendor-flow-gaps/README.md` § G1 (the spec, already cites
every real call site), the three existing vendor-email senders
(`lib/vendor-registration-confirmation.ts`, `lib/vendor-approval-confirmation.ts`,
`lib/vendor-stand-payment-notice.ts`), `lib/confirmation-email.ts`'s
`deliverConfirmationEmailAfterCommit` (ticketing-foundation F10/F11's write-commits-first,
email-never-blocks posture — the same generic wrapper, never reimplemented), `lib/admin-auth.ts`
(`ADMIN_EMAIL_ALLOWLIST`, read-only reuse), and `app/api/admin/checkin/route.ts:60-73`'s
never-block audit-write pattern.

## What this feature is

Five new files, three edits. No new Firestore collection, no new admin capability, no second
admin-roster env var.

**New sender modules** (mirroring the three existing vendor-email modules' injectable-mailer
shape exactly — `deps.mailer` defaults to `{ send: sendEmail }`, zero `console.*` calls,
`from: FORMS_FROM_ADDRESS`):

1. `lib/vendor-application-confirmation.ts` + `emails/VendorApplicationConfirmation.tsx` —
   the missing vendor-facing "we received your application" email (the fifth gap folded into
   G1 per the spec). Subject: `'We received your vendor application — SAOC'`. Modelled on
   `emails/VendorRegistrationConfirmation.tsx`'s plain-acknowledgement copy — no invented
   brand colours/typography, no permit non-verification note (that belongs to F9's scope, not
   this one).
2. `lib/vendor-application-admin-notice.ts` + `emails/VendorApplicationAdminNotice.tsx` —
   admin notice on application submitted. Subject:
   `'New vendor application submitted — SAOC'`.
3. `lib/vendor-submission-admin-notice.ts` + `emails/VendorSubmissionAdminNotice.tsx` — admin
   notice on full registration submitted. Subject:
   `'New vendor registration submitted — SAOC'`.
4. `lib/vendor-payment-admin-notice.ts` + `emails/VendorPaymentAdminNotice.tsx` — admin notice
   on stand payment received. Subject: `'Vendor stand payment received — SAOC'`.

**New shared recipient resolver:**

5. `lib/vendor-admin-notify-recipients.ts` — exports
   `getVendorAdminNotifyRecipients(): string[]`, reading `process.env.ADMIN_EMAIL_ALLOWLIST`
   with the exact same parse (comma-split, trim, lowercase, filter empty) `lib/admin-auth.ts`'s
   private `parseAllowlist()` already uses. This is the ONLY function in the new surface that
   reads `process.env`. **Deliberately not exported from or added to `lib/admin-auth.ts`** —
   that file is the live `/admin` login authorization boundary; a notification-recipient
   resolver has zero authorization meaning and must not live inside, import from, or be
   imported by that boundary (same "zero authorization meaning" property F5/F8 already hold
   for vendor-facing sends). Contains no `console.*` call referencing the resolved list.

**Wiring edits** (three call sites, one per mission event):

- `app/api/vendors/apply/route.ts` — after `ref = await ...add(...)` commits, fires BOTH the
  new vendor confirmation (1) and the new admin notice (2), each independently wrapped in the
  real `deliverConfirmationEmailAfterCommit`. A `resolveSiteUrl()` helper is added locally
  (same `DEFAULT_SITE_URL = 'https://saoc.co.za'` / `process.env.SITE_URL` fallback pattern
  `lib/confirmation-email.ts` and the F5 admin review route already each duplicate locally,
  for the same reason: the fallback is private to its own module and `SITE_URL` is
  runtime-only).
- `lib/vendor-registration-handler.ts` — `VendorRegistrationHandlerDeps` gains
  `sendAdminNotice(input: { businessName: string; contactPersonName: string;
  vendorSubmissionId: string }): Promise<void>`. Immediately after the EXISTING step 7
  (`deliverConfirmationEmailAfterCommit(() => deps.sendConfirmationEmail(...), deps.onEmailError)`),
  a second, independent
  `deliverConfirmationEmailAfterCommit(() => deps.sendAdminNotice({ businessName: built.businessName,
  contactPersonName: built.contactPersonName, vendorSubmissionId: writeResult.id }),
  deps.onEmailError)` call is added, reusing the same injected `onEmailError` (no new error
  channel — matches the existing single-callback shape, and neither failure path ever carries
  PII). `app/api/vendors/register/route.ts` supplies `sendAdminNotice` as a closure that calls
  `sendVendorSubmissionAdminNoticeEmail({ ...input, reviewUrl: `${resolveSiteUrl()}/admin/vendors` })`
  — the handler itself stays network/URL-agnostic, exactly like `sendConfirmationEmail`'s
  existing wiring.
- `lib/vendor-stand-payment-notification.ts` — inside the `status === 'paid'` branch, AFTER
  the amount guard passes and BEFORE `transaction.update(standOrderRef, ...)`, the handler adds
  `const submissionDoc = await transaction.get(submissionRef);` (a read, positioned before the
  first write in the transaction callback — Firestore requires every `transaction.get()` in a
  transaction to happen before any `transaction.set/update/delete` in that same transaction;
  every read that already existed in this function runs before every write that already existed,
  and this one is no exception) and records `{ businessName, contactPersonName, standOrderRef:
  notification.reference }` from `submissionDoc.data()` into a `let paidNotice = null` variable
  declared before `db.runTransaction(...)`, assigned only on this path. Strictly AFTER
  `await db.runTransaction(...)` resolves (i.e. OUTSIDE the transaction callback entirely — a
  transaction can retry, so a side effect inside it would double-send on every retry), `if
  (paidNotice) { await deliverConfirmationEmailAfterCommit(() =>
  sendVendorPaymentAdminNoticeEmail({ ...paidNotice, reviewUrl: `${resolveSiteUrl()}/admin/vendors` }),
  onError) }` fires once. A `resolveSiteUrl()` helper is added locally, same pattern as above.

## The review-link judgement call

The spec text names `/admin/vendors/applications/{id}` and (by extension) a per-submission
detail URL as the review link target. **Neither exists in this repository.**
`app/admin/vendors/applications/page.tsx` and `app/admin/vendors/page.tsx` are both flat list
views — grep confirms neither reads a `useSearchParams`/dynamic `[id]` segment, and there is no
`app/admin/vendors/applications/[id]/` or `app/admin/vendors/[id]/` PAGE route (the *API*
routes `app/api/admin/vendors/applications/[id]/review/route.ts` and
`app/api/admin/vendors/[id]/review/route.ts` exist, but those are POST-only admin actions, not
GET-able pages a mailto link can land on). Linking to a URL that 404s in every admin's inbox
would be a worse regression than no link at all.

**Decision: every review link in this feature points at the existing LIST page** —
`{SITE_URL}/admin/vendors/applications` for the application-submitted notice,
`{SITE_URL}/admin/vendors` for both the registration-submitted and payment-received notices
(the full-submission review workflow and the stand-payment status both live on
`app/admin/vendors/page.tsx` today, per its own `statusById[doc.id] =
doc.data().status as VendorStandOrderStatus` read). This is scoped, minimal, and true — an
admin clicking the link lands on a real, already-auth-gated page listing the item in question,
not a 404. Building a per-id deep-linkable detail route is a real, separate feature (a new
page, presumably with a query-param-driven highlight/scroll-to, which neither list page
currently supports) — out of scope for G1, which is emails, not admin UI. Flag this explicitly
for Brad/the team lead rather than silently inventing the page: **if a deep link to the exact
row is wanted, that is a follow-up feature, not a silent scope-add here.**

## Recipients — read-only reuse, never gating, never a second roster

`ADMIN_EMAIL_ALLOWLIST` is `/admin` login authorization state today (`lib/admin-auth.ts`'s
`isEmailAllowlisted`, gating actual sign-in). Reusing its VALUE as a notification recipient
list is safe and explicitly endorsed by the spec; reusing its ENFORCEMENT MEANING would not be
— nothing in the new surface imports `lib/admin-auth.ts` or `lib/admin-roles.ts`, and nothing
about a failed or successful send affects any admin's ability to log in. Per the team lead's
standing decision, no second roster env var (`VENDOR_NOTIFY_EMAIL_ALLOWLIST` or similar) is
introduced — `getVendorAdminNotifyRecipients()` reads `ADMIN_EMAIL_ALLOWLIST` and nothing else,
and every new `lib/*.ts` file's only `process.env` reference, if any, is that one call inside
that one resolver.

`sendEmail`'s real signature (`lib/email.ts`) takes `to: string`, singular — deliberately NOT
widened to `string | string[]` here (that would be an edit to a shared module every other
sender also depends on, for a property only the three new admin-notice senders need — the
CLAUDE.md "Minimal Scope" rule). Instead, each of the three admin-notice sender modules loops
over `getVendorAdminNotifyRecipients()` and calls `mailer.send({ to: <each address>, ... })`
once per recipient via `Promise.all`, keeping the injected `mailer` interface identically
narrow (`send(args: { to: string; subject: string; react: ReactElement }): Promise<void>`) to
the three existing vendor-email modules. If the allowlist is empty, the sender no-ops (zero
sends) after one non-PII `console.warn('[<module>] ADMIN_EMAIL_ALLOWLIST resolved zero
recipients — no admin notice sent.')` — the ONLY permitted `console.*` call in any of the three
admin-notice modules, and it must never appear with any business/contact field logged alongside
it.

## Never blocks the vendor's own action — the load-bearing property

Every one of the three wiring edits uses the REAL `deliverConfirmationEmailAfterCommit`
(`lib/confirmation-email.ts`), never a reimplemented try/catch — same reasoning F8's own
decision record already gives: this property is proven ONCE, generically, by F10/F11's own
tests, and every new call site's job is to prove it didn't reintroduce a second, unwrapped path.
The admin-notice send always fires strictly AFTER the vendor-facing write (and, at the two
routes that already send a vendor-facing email, after that email attempt too) — one mission
event never sends only one side of the pair, and a failure on either side never rolls back or
blocks the other.

## What this contract does NOT prove

- A real Resend delivery (every check is offline/credential-free, fixture mailers only, same
  posture as every prior vendor-email contract in this project).
- The admin review LIST pages' own rendering/filtering behaviour — untouched by this feature.
- Per-recipient failure isolation (if `Promise.all` rejects because ONE of several admin
  addresses' sends failed, the WHOLE admin-notice attempt is treated as failed by
  `deliverConfirmationEmailAfterCommit` — the other admins on the list do not separately get a
  best-effort send in that scenario). Not requested by the spec; the load-bearing property is
  that the vendor's own action is never blocked, which holds regardless.
- Firestore write-safety (`docs/firestore-undefined-write-safety.md`) — not applicable here.
  This feature adds one new Firestore READ (`transaction.get(submissionRef)` in the payment
  notification handler) and zero new Firestore WRITE builders; every existing write in the
  three touched routes/handlers is unchanged by this feature.

## Two accepted limitations (architect pass, 2026-09-02, after @qa's vacuous-check finding)

@qa proved A5-A8 all stayed green under a mutation that pushed `'attacker@evil.com'` onto the
resolved recipient list inside `lib/vendor-application-admin-notice.ts`, immediately after the
`getVendorAdminNotifyRecipients()` call. **A10 — `check-recipients-exact-match.mjs`** was added
specifically to close that gap: it composes the REAL resolver and each REAL admin-notice sender
under a fixture mailer, and asserts the exact set (and count) of `to:` addresses actually sent
to is identical to a fresh, independent resolver call — no addition, omission, or substitution.
It was RED-verified against both the exact `recipients.push('attacker@evil.com')` mutation and a
dropped-recipient mutation (`getVendorAdminNotifyRecipients().slice(1)`), one at a time, each
reverted and confirmed via `md5`/`diff` before the next; A5-A8 stayed green under both, as @qa
found, while A10 caught both. Two limitations remain even after this fix, both accepted rather
than further chased, because closing them would need a change to a shared module used by
several other features (`lib/email.ts`'s `sendEmail` signature) — out of this contract's scope
per the CLAUDE.md "Minimal Scope" rule:

**(a) A5's admin-auth non-import guard is a substring test, not a real static-analysis check.**
`check-recipients-allowlist-only.mjs:125-127` is `/lib\/admin-auth|lib\/admin-roles/.test(source)`
run against the raw file text of `lib/vendor-admin-notify-recipients.ts`. It catches a literal
`import ... from '@/lib/admin-auth'` (or `'@/lib/admin-roles'`) string appearing anywhere in the
file — including inside a comment, which is itself a minor false-positive risk in the other
direction. **It does NOT catch**: a re-exported alias from a third module that itself imports
`admin-auth`/`admin-roles`; a dynamically constructed import path (e.g. built from a template
literal or concatenation); or any future rename of either module. This is the same class of
"assertion satisfiable by something that isn't the real property" this project tracks in
`.agent/memory/project/learned.md`, scoped down here to a specific known blind spot rather than
a general defect the contract claims to have eliminated. Accepted because closing it fully would
require either an AST-based import check (a real static-analysis tool, not a grep — a
disproportionate build for one guard in one file) or a runtime provenance check (which A10's
composition approach could in principle be extended to prove structurally, e.g. asserting the
resolver module's own dependency graph at runtime contains neither module — not attempted here,
flagged as a possible future strengthening if this guard is ever specifically targeted).

**(b) The narrow mailer interfaces don't provide the excess-property protection they appear to.**
All three admin-notice mailer interfaces (e.g.
`VendorApplicationAdminNoticeMailer.send(args: { to: string; subject: string; react:
ReactElement }): Promise<void>`) omit `from` from their declared parameter shape, yet every
call site in this feature passes `from: FORMS_FROM_ADDRESS` (see
`lib/vendor-application-admin-notice.ts`'s `mailer.send({ to, subject, react, from:
FORMS_FROM_ADDRESS })`). TypeScript's excess-property check — which would normally reject an
object literal carrying a property the target type doesn't declare — does NOT fire here, because
the call-site type is not `VendorApplicationAdminNoticeMailer` directly: `deps.mailer ??
{ send: sendEmail }` produces a UNION of the injected (narrow) type and `{ send: typeof
sendEmail }`, and `sendEmail`'s own real parameter type DOES declare `from`. TypeScript's excess
property check is suppressed for a value whose type is (or has been widened to, via a
fallback expression like this) a union containing a wider member — the object literal is valid
under at least one arm of the union, so it's accepted for all arms. **No runtime impact**
(`from` is simply passed to the real `sendEmail` implementation on the default path, and to
whatever a fixture mailer chooses to accept/ignore on the injected-mailer path), but this means
the narrowness of these interfaces is NOT actually enforced by the type system in the way it
visually appears to be — and the practical consequence is that **any injected fixture mailer
used in a test must itself be prepared to accept a `from` property**, even though the
interface's type signature suggests it need not be. `A1` (`pnpm type-check`) does not and cannot
catch this — it's not a type error, it's a soundness gap in how excess-property checking
interacts with default-fallback unions. Not fixed here because fixing it (either widening every
narrow mailer interface to declare `from` explicitly, or restructuring the `deps.mailer ??
{ send: sendEmail }` fallback pattern) would touch the shared shape every vendor-email sender in
this project already uses identically — a cross-cutting change out of scope for this contract.

**Also note:** `tsconfig.json` **excludes** `contracts/` from the project's TypeScript
compilation root, so `pnpm type-check` (A1) never typechecks any fixture, check script, or
inline payload under `contracts/checks/`. This is precisely why the F5 `check-commit-before-email.mjs`
fixture (`contracts/checks/vendor-f5-register-route/check-commit-before-email.mjs`) went stale
and silently red for an unknown period after M2 changed `VENDOR_CATEGORIES` and tightened
`boothSize` to required: the fixture's `vendorCategory: ['plant-sales']` (a category M2 removed)
and missing `boothSize` field were never caught by any typecheck, only by actually running the
check (`npx tsx contracts/checks/vendor-f5-register-route/check-commit-before-email.mjs`), which
this mission's architect pass did and found FAILing all five of its assertions — repaired as
part of this same pass (see `contracts/checks/vendor-f5-register-route/check-commit-before-email.mjs`'s
own inline "FIXTURE NOTE"). Any check-script author relying on "the build would have caught it"
should not — nothing under `contracts/` gets that protection, and a stale fixture can sit
silently red exactly like this one did.
