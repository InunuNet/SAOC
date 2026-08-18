# Golden: F1 — outbound mail carries a real `reply-to` address

## The problem

`lib/email.ts` sends every category of outbound mail (ticket confirmations, contact-form
receipts, vendor registration/approval receipts) with no `reply_to` header at all. Resend
"Enable Receiving" is deliberately OFF for both sending subdomains (`tickets.saoc.co.za`,
`forms.saoc.co.za`) — send-only by design — so `FROM` doubles as a dead end: a buyer who hits
Reply on a ticket confirmation sends mail into a mailbox that accepts nothing. Brad asked for
outbound mail to carry `reply_to: info@saoc.co.za` so replies land somewhere real.

## Decision

**Single choke point, not per-call-site wiring.** `lib/email.ts`'s `sendEmail()` is the one
function every category already funnels through (`lib/confirmation-email.ts`,
`lib/vendor-registration-confirmation.ts`, `lib/vendor-approval-confirmation.ts`,
`app/api/contact/route.ts`). The reply-to value is computed INSIDE `sendEmail()`'s payload
construction, not accepted as a parameter — so no current or future call site can opt out or
forget it by omitting an argument. This mirrors the project's existing pattern for
`TICKETS_FROM_ADDRESS`/`FORMS_FROM_ADDRESS`: a resolved-at-call-time constant, not a
caller-supplied value.

**Applies to every category, including forms mail.** `noreply@forms.saoc.co.za` is honest about
not accepting replies, but a real reply-to is still strictly better for a contact-form
submitter or a vendor than a `noreply` dead end. There is no category-specific reason to
exclude forms mail, so `reply_to` is uniform across `TICKETS_FROM_ADDRESS` and
`FORMS_FROM_ADDRESS` sends alike — one rule, no exceptions to remember later.

**Env-configurable with a safe, always-on default — same shape as the FROM addresses.**
`RESEND_REPLY_TO` env var, defaulting to `info@saoc.co.za` when unset OR set to an empty/
whitespace-only string. A missing or blank env var must NOT disable the header, throw, or fail
the send — reply-to is a delivery-quality improvement, not a security control, and this
project's own defect history (`project_secret_corruption_class`) is about configs failing in
ways nobody notices. Fail OPEN to the hardcoded default here, mirroring
`TICKETS_FROM_ADDRESS ?? '...'` / `FORMS_FROM_ADDRESS ?? '...'`.

**Resend SDK field name is `replyTo` (camelCase), not `reply_to`.** Confirmed against
`resend@6.12.4`'s `CreateEmailBaseOptions` type (`node_modules/.../resend/dist/index.d.mts`,
`replyTo?: string | string[]`). The wire-level Resend API JSON key is `reply_to`, but the SDK's
`emails.send()` call accepts `replyTo`. Use `replyTo` in the TypeScript call.

## Required shape in `lib/email.ts`

1. A constant `DEFAULT_REPLY_TO = 'info@saoc.co.za'`.
2. An exported, PURE function (no network call, no Resend client construction) that resolves
   the effective reply-to value from `process.env.RESEND_REPLY_TO`, trimming and falling back
   to `DEFAULT_REPLY_TO` on missing/empty/whitespace-only. Suggested name:
   `resolveReplyTo(): string`.
3. An exported, PURE function that builds the exact object handed to
   `getResend().emails.send(...)` — including `replyTo: resolveReplyTo()` — WITHOUT
   constructing the Resend client or touching the network. Suggested name:
   `buildEmailPayload(args: { to, subject, react, from }): { to, subject, react, from, replyTo: string }`.
4. `sendEmail()` itself becomes a thin wrapper: `getResend().emails.send(buildEmailPayload(args))`,
   preserving its existing external signature (`{ to, subject, react, from }`) so no call site
   changes.

This split exists SPECIFICALLY so the property can be verified without hitting Resend's API or
mocking the SDK — the assertion imports `buildEmailPayload`/`resolveReplyTo` directly.

## Why not a grep-only assertion

This file's own project history records the exact failure mode: a `grep -q "info@saoc.co.za"
lib/email.ts` is satisfied by a comment, a docstring, or a variable that is never read by the
actual send path (this project's audited "assertion satisfiable by something that isn't the
real property" defect class, recurred 3x on this file already — see
`project_contract_checks_mutate_live_content` and the P1 weak-assertion audit in git log
`c668ca2`). The assertion below instead executes the real payload-building code path and
inspects the resulting object's `replyTo` field under multiple env states, so nothing short of
correctly wiring `replyTo` into `buildEmailPayload`'s return value can pass it.

## Acceptance protocol (@qa runs `execution/checks/verify_reply_to.ts` via tsx)

1. Import `buildEmailPayload` and `resolveReplyTo` from `lib/email.ts` — no other import, no
   Resend client, no network.
2. With `RESEND_REPLY_TO` unset: `resolveReplyTo()` returns exactly `'info@saoc.co.za'`, and
   `buildEmailPayload({...fixture tickets-category args...}).replyTo` also equals it.
3. With `RESEND_REPLY_TO=''` (empty string) and `RESEND_REPLY_TO='   '` (whitespace only):
   both still resolve to `'info@saoc.co.za'` — a blank env var must not disable the header.
4. With `RESEND_REPLY_TO='ops@example.test'` set: both functions resolve to
   `'ops@example.test'` — env override actually takes effect.
5. Call `buildEmailPayload` once with `from: TICKETS_FROM_ADDRESS` and once with
   `from: FORMS_FROM_ADDRESS` (both imported for real from `lib/email.ts`) — both payloads
   carry the SAME non-empty `replyTo`, proving forms mail is not excluded.
6. Any failed expectation exits non-zero with a clear message naming which case failed.

## Addendum 2026-08-18 — harness broke `next build`, fixed, and closed structurally

@qa caught `execution/checks/verify_reply_to.ts:32` using `await import('../../lib/email.ts')`
with an explicit `.ts` extension. `tsx` resolves that fine (which is why A4 read PASS), but
`next build`'s separate whole-project `tsc` pass rejects it: `tsconfig.json`'s `include` sweeps
in `**/*.ts` project-wide and `execution/` was not in `exclude` (only `node_modules`,
`contracts`, `functions` were) — so the harness file itself became part of the shipped app's
typecheck. Fixed by dropping the extension (`'../../lib/email'`; `moduleResolution: bundler`
resolves it without one, and `tsx` still runs it correctly).

This is the same defect class that took down every App Hosting auto-deploy earlier in this
session (a file that was never meant to be part of the Next.js build got swept into it anyway
by `tsconfig.json`'s broad `include`/narrow `exclude`). Closed two ways, not one:

1. **Instance fix** — the harness no longer uses a `.ts`-extension import (done, this file).
2. **Structural fix** — `tsconfig.json` should exclude `execution/` the same way it already
   excludes `contracts/` and `functions/`: harness/check scripts are not shipped app code and
   should never have been in scope for `next build`'s typecheck. Specified for `@dev` to add
   (`tsconfig.json` is app source, not the architect's file to edit directly) — see A9.
3. **Regression guard regardless of #2** — A8 runs the real `next build`, not a proxy for it.
   Both A1-A3 (grep-based shape checks) and A4 (the `tsx` harness run) stayed green under the
   exact bug that broke this the first time; only actually building catches it. If a later
   change reintroduces the `execution/` exclude gap, A9 will likely catch it structurally, but
   A8 is what actually proves the deployable artifact is intact regardless of whether that
   line quietly regresses.

## Non-goals

- No change to `TICKETS_FROM_ADDRESS` / `FORMS_FROM_ADDRESS` values or their env var names.
- No change to any call site's arguments (`lib/confirmation-email.ts`,
  `lib/vendor-registration-confirmation.ts`, `lib/vendor-approval-confirmation.ts`,
  `app/api/contact/route.ts` all keep calling `sendEmail`/`mailer.send` exactly as today).
- No live Resend send, no DNS/receiving change — "Enable Receiving" staying OFF on the sending
  subdomains is unaffected; `info@saoc.co.za` is a DIFFERENT, already-real inbox.
