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
