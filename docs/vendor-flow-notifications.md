# Vendor flow notifications — admin and confirmation emails

**Code:** Five new lib modules and four email templates, three route/handler edits.

**Contract:** [`contracts/contract-vendor-flow-notifications.yaml`](../contracts/contract-vendor-flow-notifications.yaml), feature F1 — 10 assertions (A1-A10). Golden spec: [`contracts/golden/vendor-flow-notifications/README.md`](../contracts/golden/vendor-flow-notifications/README.md).

**Status:** Contract gate PASSED 10/10 (phase all, `--run-checks`). Dataset residue guard clear across 149 documents.

---

## What this feature is

G1 from `.agent/memory/project/specs/vendor-flow-gaps/README.md` — four new notification emails at three mission-critical moments, plus the previously-missing vendor-facing "we received your application" confirmation.

**Four emails, all new:**
1. **Vendor application received** — vendor-facing. Subject: *We received your vendor application — SAOC*. Sent to `contactEmail` immediately after application submission. Acknowledges receipt; no invented brand colours or permit-status speculation.
2. **New vendor application submitted** — admin-facing. Subject: *New vendor application submitted — SAOC*. Sent to all addresses in `ADMIN_EMAIL_ALLOWLIST` immediately after a vendor submits their short application.
3. **New vendor registration submitted** — admin-facing. Subject: *New vendor registration submitted — SAOC*. Sent to all addresses in `ADMIN_EMAIL_ALLOWLIST` immediately after a vendor completes full registration (gated by token, M1).
4. **Vendor stand payment received** — admin-facing. Subject: *Vendor stand payment received — SAOC*. Sent to all addresses in `ADMIN_EMAIL_ALLOWLIST` after stand payment clears (PayFast ITN verified, amount guarded).

---

## Admin recipient resolution and the authorization boundary

Admin recipients are resolved via a single, read-only function: `lib/vendor-admin-notify-recipients.ts:getVendorAdminNotifyRecipients()`. It reads `process.env.ADMIN_EMAIL_ALLOWLIST` with the exact same parse that `lib/admin-auth.ts`'s private `parseAllowlist()` already uses:

- Comma-split
- Trim whitespace from each entry
- Lowercase
- Filter empty strings

**Why this function is deliberately NOT added to or imported from `lib/admin-auth.ts`:**

`lib/admin-auth.ts` is the live `/admin` login authorization boundary. A notification-recipient resolver has zero authorization meaning — it does not gate access, does not verify credentials, does not affect who can log in. Keeping it in a separate module enforces this separation structurally: the notification surface imports neither `lib/admin-auth.ts` nor `lib/admin-roles.ts`, and neither of those imports the notification resolver in return. Reusing the VALUE of `ADMIN_EMAIL_ALLOWLIST` (the email addresses) is safe; reusing its ENFORCEMENT MEANING (the authorization policy itself) would blur the boundary.

**The resolve-and-loop pattern for multiple recipients:**

The three admin-notice senders each call `getVendorAdminNotifyRecipients()` once and loop over the result via `Promise.all`, calling `mailer.send({ to: <each address>, subject: ..., react: ... })` once per recipient. If the allowlist is empty, the sender logs a single, non-PII warning and no-ops:

```
[vendor-application-admin-notice] ADMIN_EMAIL_ALLOWLIST resolved zero recipients — no admin notice sent.
```

This is the only `console.*` call permitted in any of the three admin-notice modules — businessName, contactPersonName, or contactEmail never reach a log line.

---

## Failure isolation: sends never block the vendor's action

Every email send, whether vendor-facing or admin-facing, is independently wrapped in the **real** `deliverConfirmationEmailAfterCommit()` from `lib/confirmation-email.ts`. This wrapper:

- Awaits the send
- Swallows both synchronous throws and async rejections
- Calls a passed `onError` callback with the real error (a generic message + `error.message`, with no PII)
- Never rethrows

A failed notification email **never** fails the underlying Firestore write, never rolls back a committed application or payment, and never fails the route's 200/201 response. The vendor's own action is always protected.

### Three wiring locations

1. **`app/api/vendors/apply/route.ts`** — immediately after `ref = await .collection(VENDOR_APPLICATIONS_COLLECTION).add(...)` commits, fires TWO independent sends via `deliverConfirmationEmailAfterCommit`:
   - Vendor-facing: `sendVendorApplicationConfirmationEmail()`
   - Admin-facing: `sendVendorApplicationAdminNoticeEmail()`

2. **`lib/vendor-registration-handler.ts` + `app/api/vendors/register/route.ts`** — the handler gains a new dep `sendAdminNotice(input: { businessName, contactPersonName, vendorSubmissionId }): Promise<void>`. Immediately AFTER the existing vendor-facing confirmation send, a second `deliverConfirmationEmailAfterCommit` fires, calling the injected `sendAdminNotice` closure. The route wires this as a closure calling the real `sendVendorSubmissionAdminNoticeEmail()`, keeping the handler network-agnostic.

3. **`lib/vendor-stand-payment-notification.ts`** — strictly OUTSIDE the `db.runTransaction(...)` callback (never inside it), after the transaction resolves, fires the admin notice via `deliverConfirmationEmailAfterCommit`.

---

## The Firestore transaction-retry bug and its fix

This is the most subtle and valuable part of the feature. **The problem:**

When `db.runTransaction()` encounters contention (concurrent writes touching the same documents), Firestore re-invokes the entire callback from scratch. If the callback reads data into a variable declared **outside** the callback:

```ts
let notice = null;  // ❌ Declared outside the callback
await db.runTransaction(async (transaction) => {
  // first attempt reads data, sets notice = { ... }
  // contention causes abort and retry
  // SECOND attempt runs from the top with notice still holding the STALE value from attempt 1
  // if the second attempt early-returns (e.g. because a guard check changes the outcome),
  // notice now carries bogus data from a write that was never committed
});
```

This caused admin notification emails to fire for transactions that committed nothing — a duplicate gateway ITN retry was sufficient to trigger it. A notification mailer would send "payment received" to admins even though the Firestore transaction rolled back.

**The fix:** Reset the variable to its initial state as the **very first statement** inside the transaction callback:

```ts
let paidNotice: PaidNotice | null = null;  // ✓ Declared outside

await db.runTransaction(async (transaction) => {
  paidNotice = null;  // ✓ Reset as first statement — runs every retry from scratch
  
  // ... actual transaction logic ...
  if (status === 'paid') {
    paidNotice = { ... };  // only assigned if this path runs to completion
  }
});
```

This is now applied in `lib/vendor-stand-payment-notification.ts`. The payment admin notice is only sent if `paidNotice` is non-null after the transaction completes — which can only happen if the transaction's own 'paid' branch ran successfully and was never retried.

---

## Why A5-A8 were not enough, and what A10 adds

The contract's first eight assertions (A1-A9) proved many properties:

- **A5 & A6:** Admin-notice modules import `getVendorAdminNotifyRecipients()` and call `mailer.send`, AND they never reference `contactEmail`/`businessName`/`contactPersonName` in the `to:` argument.
- **A7:** Even with a rejecting mailer, sends fire but resolve (never throw) and call `onError` once.
- **A8:** No business data logged.

**The gap:** A5 is a source-text scan — it proves a module *calls* the resolver and has the right variable names in the `to:` argument. It does NOT prove the addresses actually passed to `mailer.send` are the resolver's output, unchanged. @qa found this by adding `recipients.push('attacker@evil.com')` immediately after the resolver call in one of the modules — all of A5/A6/A7/A8 stayed green, because none of them compared the actual sent addresses against the resolver's result.

**A10's approach:** Compose the REAL resolver with each REAL admin-notice sender under a fixture mailer that records every `to:` address. Assert the recorded set is IDENTICAL to a fresh resolver call — same addresses, same count. A10 was RED-verified against both the attacker mutation and a dropped-recipient mutation; A5-A8 stayed green against both, while A10 caught both.

This is an instance of the "assertion satisfiable by something that isn't the real property" defect class already tracked in `.agent/memory/project/learned.md` — A10 closes this gap for notifications.

---

## Two accepted limitations

Both are inherited from shared modules and could only be closed by editing those modules, which this contract's "Minimal Scope" rule prohibits.

### (a) A5's authorization-boundary guard is substring-based, not AST-based

`lib/vendor-admin-notify-recipients.ts` contains a comment and A5 checks that the raw file text does NOT contain `'lib/admin-auth'` or `'lib/admin-roles'` substrings. This catches a literal `import ... from '@/lib/admin-auth'` anywhere in the file.

**What it does NOT catch:**
- A re-exported alias from a third module that itself imports `admin-auth` (e.g. `import { helper } from '@/lib/shared'` where `@/lib/shared` re-exports from `admin-auth`)
- A dynamically constructed import path (e.g. `const path = 'admin-' + 'auth'; import(path)`)
- A future rename of either module

**Why it's accepted:** Closing this would require either a real AST-based static-analysis tool (proportionate for a security-critical feature; disproportionate for one guard in one file) or a runtime dependency-graph check (possible but not attempted here). The guard is effective against the common case and is maintained as a barrier; this limitation is noted for operators and future developers.

### (b) Narrow mailer interfaces omit `from`, yet every call site passes it

Each admin-notice sender's mailer interface declares:
```ts
send(args: { to: string; subject: string; react: React.ReactElement }): Promise<void>
```

But every call site passes `from: FORMS_FROM_ADDRESS` as well. TypeScript's excess-property check normally rejects this — but doesn't here, because the actual type at call sites is a union:

```ts
deps.mailer ?? { send: sendEmail }  // Union of narrow type and sendEmail's real type
```

TypeScript's excess-property check is suppressed when ANY arm of a union accepts the property. `sendEmail` declares `from`, so the object literal is valid under that arm and accepted for all arms.

**Practical impact:** None at runtime (the `from` field reaches `sendEmail` or a fixture that should accept it). But the narrowness of these interfaces is not actually enforced by the type system.

**Why it's accepted:** Fixing it would require widening every narrow mailer interface to declare `from` explicitly, or restructuring the default-fallback pattern — a cross-cutting change touching shared code used by several other vendor-email senders (outside this contract's scope per "Minimal Scope").

---

## A critical trap: `tsconfig.json` excludes `contracts/`, so fixture health is not typechecked

The project's `pnpm type-check` command does not run TypeScript against files under `contracts/`, including check scripts and their fixtures. This means:

- A fixture can carry stale or incorrect data shapes for years.
- A "clean typecheck" result says nothing about whether contract checks will actually run correctly.
- A fixture that uses a field name or value removed in a prior mission (e.g., M2's field changes) will silently fail only when the check is actually executed.

**Example from this mission:** The F5 `check-commit-before-email.mjs` fixture (`contracts/checks/vendor-f5-register-route/`) used `vendorCategory: ['plant-sales']` and omitted the now-required `boothSize` field — changes from M2. This check went silently RED for an unknown period because no typecheck caught it. It was discovered and fixed during this mission's architect pass, and verified as now passing via `npx tsx contracts/checks/vendor-f5-register-route/check-commit-before-email.mjs`.

**Implication:** Every check author and maintainer must:
1. Assume fixtures can drift silently.
2. Periodically run checks manually to verify they actually pass, not just trust the build.
3. Update fixtures whenever document schemas change, even if the fixture is not directly in your feature's scope.

---

## Sending order

Sends fire in this order (non-negotiable for the admin-notice senders):

1. **Firestore write commits** (e.g., `ref = await .add(...)`)
2. **First `deliverConfirmationEmailAfterCommit` call** (vendor-facing, if any)
3. **Second `deliverConfirmationEmailAfterCommit` call** (admin-facing)

No notification send ever happens before the write. Neither send is retried or re-ordered if the other fails. Both are independent and parallel (both are wrapped in separate `await` statements in sequence, allowing either to fail without affecting the other).

---

## Contract assertions summary

| ID | Description |
|----|-------------|
| A1 | TypeScript strict-mode build passes (`pnpm type-check`) |
| A2 | Apply route wiring: both vendor and admin sends, wrapped, after write |
| A3 | Register handler wiring: admin send after existing vendor send |
| A4 | Payment notification: transaction.get() before write, send outside transaction |
| A5 | Recipients read from allowlist only, never from vendor data |
| A6 | Resolver called and called correctly by each admin-notice module |
| A7 | Failed mailer send resolves, logs onError, never throws |
| A8 | No PII in logs |
| A9 | Lint passes |
| A10 | Recipients exact match — real resolver output verified against real senders under fixture mailer |

---

## What this contract does NOT prove

- Real Resend deliveries (every check uses fixture mailers).
- Admin review list pages' rendering or filtering.
- Per-recipient failure isolation when multiple admins are on the allowlist (if one send fails, the entire admin-notice attempt is treated as failed).
- Firestore write safety (this feature adds zero new write builders; every read/write logic is unchanged from prior missions).
