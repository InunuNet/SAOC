# F1 — exact shapes dev must implement

Rationale for every judgement call lives in `README.md`. This file is the literal spec.

## `lib/supporter-registrations.ts`

```ts
export const SUPPORTER_REGISTRATIONS_COLLECTION = 'supporterRegistrations';

export type SupporterRegistrationStatus = 'pending' | 'confirmed' | 'unsubscribed';

// What a caller submits.
export interface SupporterRegistrationRawInput {
  email?: unknown;
  firstName?: unknown;
  consentMarketing?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[]; // e.g. ['email is required', 'consentMarketing must be true']
}

// Validates raw, untyped input. Rules:
//  - email: required; must be a string; trimmed; must match a standard email shape; max 254
//    chars after trim. Error names the field as "email".
//  - firstName: optional; if present must be a string; trimmed; max 60 chars. Error names the
//    field as "firstName".
//  - consentMarketing: required; must be the LITERAL boolean `true` -- `"true"`, `1`, `"on"`,
//    and `false` all fail. Error names the field as "consentMarketing". This is the field this
//    contract's A3 exercises hardest -- see README "Consent design".
export function validateSupporterRegistrationInput(raw: unknown): ValidationResult;

// The normalized, ready-to-persist shape (no `id` -- assigned by Firestore on write).
export interface SupporterRegistration {
  email: string;         // trimmed + lowercased
  firstName: string | null;
  consentMarketing: true;
  consentTimestamp: Date;   // = `now`, never client-supplied
  status: SupporterRegistrationStatus;
  source: string;            // e.g. 'website-registration-form' -- caller-supplied, not user input
  createdAt: Date;           // = `now`
  confirmedAt: Date | null;  // null until F2's confirm route flips it
  unsubscribedAt: Date | null;
}

// Only called after validateSupporterRegistrationInput has returned `valid: true` on the
// SAME raw input -- callers must not call this on unvalidated input. Normalizes
// email/firstName exactly as validation checked them. `source` is a handler-supplied
// constant, not part of raw input.
export function buildSupporterRegistration(
  input: { email: string; firstName: string | null; consentMarketing: true },
  now: Date,
  source: string,
): Omit<SupporterRegistration, 'status' | 'confirmedAt' | 'unsubscribedAt'> & {
  status: 'pending';
  confirmedAt: null;
  unsubscribedAt: null;
};
```

## `lib/supporter-registration-token.ts`

```ts
export type SupporterRegistrationTokenPurpose = 'confirm' | 'unsubscribe' | 'erase';

export const SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;        // 24h
export const SUPPORTER_MANAGE_TOKEN_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 400;   // ~400d

export interface MintSupporterRegistrationTokenInput {
  registrationId: string;
  purpose: SupporterRegistrationTokenPurpose;
  secret: string;
  now: Date;
  ttlMs?: number; // defaults to CONFIRM or MANAGE default based on `purpose`
}

export interface MintedSupporterRegistrationToken {
  token: string;
  expiresAt: Date;
}

export function mintSupporterRegistrationToken(
  input: MintSupporterRegistrationTokenInput,
): MintedSupporterRegistrationToken;

export type SupporterRegistrationTokenVerification =
  | { ok: true; registrationId: string; purpose: SupporterRegistrationTokenPurpose; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' | 'wrong-purpose' };

export interface VerifySupporterRegistrationTokenInput {
  token: string;
  expectedPurpose: SupporterRegistrationTokenPurpose;
  secret: string;
  now: Date;
}

// Signature is checked BEFORE purpose (mirrors lib/recovery-token.ts's ordering) -- a
// wrong-purpose result is only ever returned for a token whose signature already verified.
export function verifySupporterRegistrationToken(
  input: VerifySupporterRegistrationTokenInput,
): SupporterRegistrationTokenVerification;
```

Wire format, secret, and constant-time comparison: identical approach to
`lib/recovery-token.ts` (`createHmac('sha256', secret)`, `timingSafeEqual` guarded against a
length mismatch) -- reuse that file's `constantTimeEqual` rather than re-implementing it.

## `lib/supporter-registration-rate-limit.ts`

```ts
export const SUPPORTER_REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SUPPORTER_REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h

export interface SupporterRegistrationAttemptRecord {
  key: string;
  at: Date;
}

// Delegates to the REAL decideRateLimit() (lib/resend-rate-limit.ts) with the two constants
// above as overrides -- no reimplemented sliding-window arithmetic (same pattern as
// lib/vendor-registration-rate-limit.ts).
export function decideSupporterRegistrationRateLimit(
  key: string,
  now: Date,
  priorAttempts: SupporterRegistrationAttemptRecord[],
): import('./resend-rate-limit').RateLimitDecision;

export interface SupporterRegistrationRateLimitStore {
  getPriorAttempts(key: string): SupporterRegistrationAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
}

export function createInMemorySupporterRegistrationRateLimitStore(): SupporterRegistrationRateLimitStore;

// --- Independent throttle: per-email confirmation-send cooldown (the mail-bomb defense) ---

export const SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export interface EmailCooldownDecision {
  allowed: boolean;
  retryAfterMs: number | null; // null when allowed
}

// `lastSentAt: null` (never sent before) is always allowed. Otherwise allowed iff
// `now - lastSentAt >= SUPPORTER_CONFIRMATION_EMAIL_COOLDOWN_MS`.
export function decideConfirmationEmailCooldown(
  now: Date,
  lastSentAt: Date | null,
): EmailCooldownDecision;

export interface SupporterConfirmationCooldownStore {
  getLastSentAt(email: string): Date | null;
  recordSent(email: string, at: Date): void;
}

export function createInMemorySupporterConfirmationCooldownStore(): SupporterConfirmationCooldownStore;
```

## `lib/supporter-registration-handler.ts`

```ts
export interface ExistingSupporterRegistration {
  id: string;
  status: SupporterRegistrationStatus; // real Firestore impl only ever returns 'pending' | 'confirmed' here -- see below
}

export interface SupporterRegistrationHandlerDeps {
  now: Date;
  source: string;

  rateLimitKey: string;
  getPriorAttempts: (key: string) => SupporterRegistrationAttemptRecord[];
  recordAttempt: (key: string, at: Date) => void;

  // MUST exclude status: 'unsubscribed' documents -- a previously-unsubscribed email is
  // always treated by this handler as having no existing record (fresh consent on re-opt-in).
  // See README "Consent design -- Re-consent on re-opt-in."
  findByEmail: (email: string) => Promise<ExistingSupporterRegistration | null>;

  getLastConfirmationSentAt: (email: string) => Date | null;
  recordConfirmationSent: (email: string, at: Date) => void;

  write: (doc: ReturnType<typeof buildSupporterRegistration>) => Promise<{ id: string }>;
  refreshConsent: (id: string, consentTimestamp: Date) => Promise<void>; // resend path only

  mintConfirmToken: (registrationId: string) => MintedSupporterRegistrationToken;
  sendConfirmationEmail: (input: SupporterRegistrationConfirmationInput) => Promise<void>;
  onEmailError?: (error: unknown) => void;
}

export type SupporterRegistrationHandlerResult =
  | { status: 201 | 200; body: { success: true } }
  | { status: 400; body: { success: false; fieldErrors: string[] } }
  | { status: 429; body: { success: false; retryAfterMs: number } }
  | { status: 500; body: { success: false; error: string } };

export async function handleSupporterRegistration(
  rawInput: unknown,
  deps: SupporterRegistrationHandlerDeps,
): Promise<SupporterRegistrationHandlerResult>;
```

**Order of operations** (each step gates the next; a step that refuses must call none of the
steps after it):

1. IP rate limit: `decideSupporterRegistrationRateLimit(deps.rateLimitKey, deps.now,
   deps.getPriorAttempts(deps.rateLimitKey))`. `deps.recordAttempt` is called
   UNCONDITIONALLY, before the allow/deny branch (same "always record, then branch" order as
   `lib/vendor-registration-rate-limit.ts`'s caller). Not allowed → `429`, body
   `{ success: false, retryAfterMs }`, nothing below runs.
2. `validateSupporterRegistrationInput(rawInput)`. Invalid → `400`, body
   `{ success: false, fieldErrors: result.errors }` (the SAME array the real validator
   returned -- no parallel validation, no rewritten message), nothing below runs.
3. `buildSupporterRegistration(validated, deps.now, deps.source)`.
4. `existing = await deps.findByEmail(built.email)`.
5. Branch on `existing`:
   - `existing === null` → `deps.write(built)` → `mintConfirmToken(id)` →
     `sendConfirmationEmail(...)` (failure caught, `onEmailError` called, response
     UNCHANGED — same commit-before-email, non-fatal-email posture as
     `lib/vendor-registration-handler.ts`) → `recordConfirmationSent(built.email, deps.now)`.
   - `existing.status === 'confirmed'` → no write, no token mint, no email send at all.
   - `existing.status === 'pending'` → check
     `decideConfirmationEmailCooldown(deps.now, deps.getLastConfirmationSentAt(built.email))`.
     Not allowed → no write, no token mint, no email send (silently suppressed). Allowed →
     `deps.refreshConsent(existing.id, deps.now)` → mint/send/record exactly as the
     `existing === null` branch, but against `existing.id` instead of a new write.
6. **Every reachable success path returns the exact same `{ status: 200 or 201, body: {
   success: true } }` shape** — no field differs by branch (see A8). Whether `200` or `201` is
   used may differ by branch (write vs. no write) but the **body** must be identical JSON in
   every case, since the body is what a caller can inspect to enumerate.

## `lib/supporter-registration-confirmation.ts` + `emails/SupporterRegistrationConfirmation.tsx`

```ts
export interface SupporterRegistrationConfirmationInput {
  to: string;
  firstName: string | null;
  confirmUrl: string; // absolute URL, e.g. https://saoc.co.za/api/supporters/confirm?token=...
}

export interface SupporterRegistrationConfirmationMailer {
  send(args: { to: string; subject: string; react: React.ReactElement; from: string }): Promise<void>;
}

export interface SendSupporterRegistrationConfirmationDeps {
  mailer?: SupporterRegistrationConfirmationMailer; // defaults to lib/email.ts's real sendEmail
}

export async function sendSupporterRegistrationConfirmationEmail(
  input: SupporterRegistrationConfirmationInput,
  deps?: SendSupporterRegistrationConfirmationDeps,
): Promise<void>;
```

`emails/SupporterRegistrationConfirmation.tsx` — modelled on
`emails/VendorRegistrationConfirmation.tsx` (plain acknowledgement copy, no invented brand
colours/typography), props `{ firstName: string | null; confirmUrl: string }`. Its rendered
output (via `react-dom/server`'s `renderToStaticMarkup`, checked by A9) **must contain**, as
plain text once tags are stripped:

- A sentence stating SAOC will **not share or sell** the registrant's information (the literal
  promise Brad asked for — not paraphrased away).
- The literal `confirmUrl` value, present as an `href` on a real link (not only as visible
  text) — the confirm link must be clickable, not just describable.
- A mention that the link expires (does not need an exact duration in the checked text, but
  must say the link is time-limited) — matches `confirmUrl` being minted with a real,
  non-infinite TTL (`SUPPORTER_CONFIRM_TOKEN_DEFAULT_TTL_MS`).

Contains **no `console.*` call anywhere in its body** and never logs `input.to` or
`input.firstName` — same POPIA-relevant no-PII-in-logs posture as
`lib/vendor-registration-confirmation.ts`.
