# Required split: outbound signing vs inbound verification

`lib/payfast.ts` currently has ONE parameter-string builder
(`buildPayfastParamString`, trim + skip-blank) shared by both directions. PayFast's own
docs specify two DIFFERENT algorithms (see `inbound-algorithm.golden.md`). The fix is to
split them, not to "fix" the single shared function — changing `buildPayfastParamString`'s
behaviour would break the outbound checkout signing, which is currently correct and working.

## Functions required in `lib/payfast.ts`

1. **`phpUrlEncode(value: string): string`** — UNCHANGED. Already correct (RFC1738 /
   PHP `urlencode()` semantics, uppercase hex). Reused by both directions.

2. **`buildPayfastParamString(fields: Record<string, string>): string`** — UNCHANGED.
   Outbound only: insertion order, skip `value === ''`, `phpUrlEncode(value.trim())`.

3. **`generateSignature(fields, passphrase?): string`** — UNCHANGED. Outbound only.
   Built on `buildPayfastParamString`; appends
   `&passphrase=${phpUrlEncode(passphrase.trim())}` only if `passphrase` is truthy.

4. **NEW `buildPayfastNotifyParamString(fields: Record<string, string>): string`** —
   Inbound only. Iterate `Object.entries(fields)` in the GIVEN order (caller is
   responsible for passing fields in the exact order PayFast posted them — see call-site
   notes below), **do not skip blank values**, **do not trim**, `phpUrlEncode(value)`
   directly. Join with `&`. No filtering of any kind.

5. **NEW `generateNotifySignature(fields, passphrase?): string`** — Inbound only. Built
   on `buildPayfastNotifyParamString`. Appends
   `&passphrase=${phpUrlEncode(passphrase)}` (NO `.trim()` on the passphrase either —
   the docs' `pfValidSignature` calls `urlencode($pfPassphrase)` with no `trim()`) only
   if `passphrase` is truthy. Returns lowercase hex MD5 digest (`createHash('md5')...`,
   matching the existing convention).

## Call sites that MUST change (both inside the sha256-pinned `app/api/tickets/itn/route.ts`)

- **Line 89** (guard 1, signature check):
  `const expectedSignature = generateSignature(fields, passphrase);`
  →
  `const expectedSignature = generateNotifySignature(fields, passphrase);`

- **Line 193** (guard 4, server-confirm POST body):
  `body: buildPayfastParamString(fields),`
  →
  `body: buildPayfastNotifyParamString(fields),`

- Import statement (lines 7–13) must add `buildPayfastNotifyParamString` and
  `generateNotifySignature` to the named imports from `@/lib/payfast`.

- `parseOrderedFields` (lines 62–74) already preserves posted order via
  `new URLSearchParams(raw)` iteration and already excludes `signature` from the
  returned `fields` object — no change needed here. (Caveat: `fields` is a plain JS
  object; per the JS spec, non-numeric-string keys preserve insertion order, and every
  PayFast field name is non-numeric, so this is safe. If any future field name is a bare
  integer string, this ordering guarantee would silently break — out of scope for this
  fix, flagged as a risk below.)

## Call site that MUST NOT change

- `app/api/tickets/checkout/route.ts:406` —
  `const signature = generateSignature(signedFields, passphrase);` stays exactly as is.
  This is the outbound path; changing it would break checkout signing, which currently
  works (evidence: PayFast has accepted these payments).

## Verification harness

`contracts/golden/payfast-itn-signature/verify_itn_signature.ts` (run via `tsx`) imports
these five names from `lib/payfast.ts` and exercises all four required properties against
the fixtures in this directory. See `contract-payfast-itn-signature.yaml` assertions A1–A4
for exact invocation and what each one is proven to reject.
