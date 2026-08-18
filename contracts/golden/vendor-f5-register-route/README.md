# F5 (vendor-registration) — `POST /api/vendors/register`: decision record

## Scope boundary — what F5 is, and what it deliberately is NOT

F5 ships the public submission route only: validate a raw HTTP body against F4's real
`validateVendorSubmissionInput`/`buildVendorSubmission` (`lib/vendor-submissions.ts`), write
exactly one `vendorSubmissions` document, and send a best-effort confirmation email. It does
**not** build the admin review UI or the `review-vendor-applications` capability (F6), **not**
the booth-fee/proof-of-payment path (F7, gated on an open question), **not** the booth-allocation
email (F8, sent from F6's approval action, not from this route), and **not** the regulatory
permit non-verification notice in the confirmation copy (F9's job — this route's email is a
plain receipt acknowledgement only; F9 later edits the copy, it does not need to reopen this
route). The human end-to-end proof spanning all of F5-F8 is F10's job, not this contract's.

## The four new modules `@dev` must implement, and why the split

The core design decision: **`POST /api/vendors/register` is split into a thin Next.js route file
and a pure, fully-injectable orchestrator**, mirroring the split `lib/confirmation-email.ts`
already established between `deliverConfirmationEmailAfterCommit` (generic, reusable) and its
caller. This is the only way to prove "the route delegates to the REAL validation/build
functions, commits before emailing, and never emails on a failed commit" **offline, without a
live Firestore project or a live Resend key** — a route handler that inlines all of this
directly against `firebase-admin`/`resend` imports cannot be exercised that way; the ITN route
(`app/api/tickets/itn/route.ts`) gets away with inlining because its correctness is proven by the
F10 contract's HTTP-round-trip script instead, at higher cost (a full dev server boot) and lower
per-branch coverage. F5 chooses the cheaper, more precise proof.

1. **`lib/vendor-registration-handler.ts` (new)** — the pure orchestrator:
   ```ts
   export interface VendorRegistrationWriteResult { id: string }
   export interface VendorRegistrationHandlerDeps {
     now: Date;
     rateLimitKey: string;
     getPriorAttempts(key: string): VendorRegistrationAttemptRecord[];
     recordAttempt(key: string, at: Date): void;
     write(doc: Omit<VendorSubmission, 'id'>): Promise<VendorRegistrationWriteResult>;
     sendConfirmationEmail(input: VendorRegistrationConfirmationInput): Promise<void>;
     onEmailError(error: unknown): void;
   }
   export interface VendorRegistrationHandlerResult {
     status: number;
     body:
       | { success: true; id: string }
       | { error: string; fieldErrors?: string[] }
       | { error: string; retryAfterMs: number };
   }
   export async function handleVendorRegistration(
     rawInput: unknown,
     deps: VendorRegistrationHandlerDeps,
   ): Promise<VendorRegistrationHandlerResult>
   ```
   Order of operations, all inside this one function, none skippable or reorderable without
   breaking A4/A5/A6 below:
   1. `decision = decideVendorRegistrationRateLimit(deps.rateLimitKey, deps.now, deps.getPriorAttempts(deps.rateLimitKey))`.
   2. `deps.recordAttempt(deps.rateLimitKey, deps.now)` — recorded **unconditionally**, whether
      or not the decision allows the request, so a caller hammering the endpoint during a block
      keeps re-extending its own `retryAfterMs` rather than getting a free re-roll once the
      first window's attempts age out mid-hammer.
   3. If `!decision.allowed` → return `{ status: 429, body: { error: '...', retryAfterMs } }`
      **before parsing/validating `rawInput` at all** — rate-limited callers never reach
      validation, Firestore, or email.
   4. `validateVendorSubmissionInput(rawInput)` (the REAL F4 function, imported, never
      reimplemented) → invalid → `{ status: 400, body: { error: '...', fieldErrors: errors } }`.
   5. `buildVendorSubmission(rawInput as VendorSubmissionDraft, deps.now)` (the REAL F4 function)
      — the cast is safe only because step 4 already proved the shape; no field is
      re-validated or transformed a second time here.
   6. `await deps.write(built)` — if this throws, return 500 immediately and **never call
      `deps.sendConfirmationEmail` or `deliverConfirmationEmailAfterCommit`** (A4).
   7. On a successful write, `await deliverConfirmationEmailAfterCommit(() =>
      deps.sendConfirmationEmail({ businessName, contactPersonName, contactEmail }),
      deps.onEmailError)` — reusing the REAL, already-shipped, generic
      `deliverConfirmationEmailAfterCommit` from `lib/confirmation-email.ts` (ticketing-foundation
      F10/F11) verbatim, not a re-implementation of "try/catch and swallow." A rejecting
      `sendConfirmationEmail` must never change the eventual response.
   8. Return `{ status: 201, body: { success: true, id: writeResult.id } }`.

2. **`lib/vendor-registration-rate-limit.ts` (new)**:
   ```ts
   export const VENDOR_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 3;
   export const VENDOR_REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
   export interface VendorRegistrationAttemptRecord { key: string; at: Date }
   export function decideVendorRegistrationRateLimit(
     key: string, now: Date, priorAttempts: VendorRegistrationAttemptRecord[],
   ): RateLimitDecision // RateLimitDecision imported from lib/resend-rate-limit.ts, NOT redeclared
   export interface VendorRegistrationRateLimitStore {
     getPriorAttempts(key: string): VendorRegistrationAttemptRecord[];
     recordAttempt(key: string, at: Date): void;
   }
   export function createInMemoryVendorRegistrationRateLimitStore(): VendorRegistrationRateLimitStore
   ```
   `decideVendorRegistrationRateLimit` **delegates to the real `decideRateLimit()`**
   (`lib/resend-rate-limit.ts`, F6/ticketing-foundation) with these two constants passed as
   `maxAttempts`/`windowMs` overrides — it must not reimplement the sliding-window arithmetic a
   second time, and must not reuse `RESEND_RATE_LIMIT_MAX_ATTEMPTS`/`RESEND_RATE_LIMIT_WINDOW_MS`
   (those numbers are tuned for a resend-my-tickets flow, not a one-shot public registration
   form; 3/hour was chosen deliberately lower — see "Judgement calls" below).
   `createInMemoryVendorRegistrationRateLimitStore()` is the only impure piece: a module-level
   array wrapped in the two methods above. **Not persistent across cold starts or multiple
   server instances** — see "What this contract does NOT prove."

3. **`lib/vendor-registration-confirmation.ts` (new)**:
   ```ts
   export interface VendorRegistrationConfirmationInput {
     businessName: string; contactPersonName: string; contactEmail: string;
   }
   export interface VendorRegistrationConfirmationMailer {
     send(args: { to: string; subject: string; react: ReactElement }): Promise<void>;
   }
   export interface SendVendorRegistrationConfirmationDeps { mailer?: VendorRegistrationConfirmationMailer }
   export async function sendVendorRegistrationConfirmationEmail(
     input: VendorRegistrationConfirmationInput,
     deps?: SendVendorRegistrationConfirmationDeps,
   ): Promise<void>
   ```
   `deps.mailer` defaults to `{ send: sendEmail }` (the REAL `lib/email.ts` export) — same
   injectable-fake pattern as `lib/confirmation-email.ts`'s `ConfirmationEmailMailer`, so a
   fixture test needs zero Resend adapter code. Renders `emails/VendorRegistrationConfirmation.tsx`
   (new, modelled on `emails/ContactConfirmation.tsx` — plain acknowledgement copy only, no
   brand colours/typography invented per the project's "no invented brand assets" rule, no
   permit non-verification note — that's F9's later edit to this same file). **Contains no
   `console.*` call anywhere in its body** — same rule `lib/confirmation-email.ts`'s
   `sendConfirmationEmail` already follows, for the same reason: `contactEmail`/`businessName`
   are POPIA-relevant submitter PII and must never reach a log line.

4. **`app/api/vendors/register/route.ts` (new)** — the thin wrapper. Reads the raw JSON body
   (malformed JSON → 400 before the handler is even called), derives a rate-limit key from the
   request's `x-forwarded-for` header (see "Judgement calls" below for why this is a documented
   best-effort, not a security boundary), wires the **real** Admin SDK write (`initAdmin()` +
   `getFirestore().collection(VENDOR_SUBMISSIONS_COLLECTION).add(built)`), the real confirmation
   email, and the real in-memory rate-limit store singleton (created once at module scope, so it
   survives warm invocations only) into `handleVendorRegistration`'s `deps`, and translates its
   `VendorRegistrationHandlerResult` into a `NextResponse` — adding a `Retry-After` header
   (seconds, rounded up) only on the 429 branch. Contains no validation, build, or email-content
   logic of its own — every property this contract proves about validation/commit-ordering/rate
   limiting is proven against `handleVendorRegistration` directly, never against this file, so
   `route.ts` staying thin is verifiable by inspection, not by a further offline check.

## Judgement calls

- **Rate-limit numbers (3 attempts / hour, IP-keyed)**: the mission brief names no specific
  number. 3/hour is deliberately tighter than F6's resend-my-tickets 5/hour — a resend is a
  legitimate buyer re-requesting their own tickets (repeatable, low-value), whereas a vendor
  registration is normally a one-shot act per business; three attempts comfortably covers a
  legitimate user who mistypes a required field twice, without giving a script room to flood
  `vendorSubmissions` with dozens of drafts per hour from one address. Placeholder, not a
  Council-approved value — flag if Lee-Ann/Brad want it tuned.
- **Rate-limit key is IP-derived from `x-forwarded-for`, not authenticated in any way**: this
  route has zero auth by design (public, unauthenticated submission), so there is no stable
  per-caller identity to key on besides network origin. `x-forwarded-for`'s first hop is
  client-supplied and therefore **spoofable by a direct caller who sets the header itself** —
  unlike `lib/payfast.ts`'s `getClientIp()` (which trusts PayFast's own known, fixed proxy
  topology and reads the *second-to-last* hop for that reason), there is no such fixed,
  known-trustworthy proxy chain documented for Firebase App Hosting in this repo, so this
  contract does **not** reuse `getClientIp()` here — doing so would silently borrow a trust
  assumption that doesn't hold for this route's actual deployment topology. Explicitly scoped
  as an **abuse deterrent, not a security boundary**: the zero-authorization posture below means
  a rate-limit bypass can only produce submission spam (more `vendorSubmissions` documents,
  more emails), never a privilege escalation, a data leak, or unauthorized access to another
  vendor's submission. If Brad/Lee-Ann later confirm Firebase App Hosting's real proxy header
  contract, tightening this key is a one-line change inside `route.ts` only — `handleVendorRegistration`
  itself is agnostic to how the key string was derived.
- **In-memory rate-limit store, not Firestore-backed**: a Firestore-backed attempt counter would
  survive cold starts and multiple instances, but adds a second Firestore write per request (one
  for the attempt counter, one for the submission) and a new failure mode (counter write fails,
  does that block or allow the request?) that the mission brief does not ask this feature to
  solve. The in-memory store is honest about its own limits (see below) and keeps F5's Firestore
  usage to exactly the one collection the brief names.
- **`deps.recordAttempt` called before the `decision.allowed` check is read**, not after: this
  makes a rate-limited caller's own retries count against themselves (the window keeps sliding
  forward with each hit), rather than a caller being able to "wait out" the block by repeatedly
  polling — polling itself re-arms the block each time it lands inside the window.

## Zero-authorization posture carried through

Nothing in `handleVendorRegistration`, the rate-limit modules, or the route imports
`lib/admin-auth.ts` or `lib/admin-roles.ts`. A successful submission response body is exactly
`{ success: true, id: string }` — never the full submission payload echoed back, never a
`status` field a client could misread as an approval signal (the mission brief's F6 owns the
only status transitions that matter). This mirrors `lib/vendor-submissions.ts`'s own module-doc
comment (F4) verbatim: nothing here grants a capability, admin surface access, or role.

## What this contract does NOT prove

- **A real Firestore write actually lands a `vendorSubmissions` document, and a real Resend send
  actually delivers an email.** `deps.write`/`deps.sendConfirmationEmail` are proven offline
  against fakes only (A3-A6). The live round trip against a real Firebase project and a real
  Resend key is F10's human-proof job, not this contract's.
- **The in-memory rate-limit store's behaviour across a cold start or multiple concurrent
  Firebase App Hosting instances.** A11/A9's HTTP round trip proves enforcement within ONE warm
  server process (the only thing an ephemeral-port `next dev` instance can demonstrate); it
  cannot prove or disprove cross-instance consistency, which depends on Firebase App Hosting's
  actual scaling behaviour and is out of scope for an offline gate.
- **`x-forwarded-for` reflects the true original client IP in the deployed environment.** This
  contract proves the route reads and uses whatever value is in that header — not that Firebase
  App Hosting's front end can be trusted not to let a caller override it. See "Judgement calls"
  above.
