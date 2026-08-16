# PayFast ITN Signature Defect — Root Cause, Fix, and Verification

**Status:** Payment-security defect identified and partially fixed.

**Contract:** `contracts/contract-payfast-itn-signature.yaml` (8 assertions: 6 pass, 2 blocked on route pin).

**Severity:** High. No ticket has ever reached `paid` in this project's history. The defect was not observable until a real sandbox purchase was completed end to end on 2026-08-15.

---

## Executive Summary

When PayFast posts an ITN (Instant Transaction Notification) to `/api/tickets/itn`, the handler verifies the payload's cryptographic signature as its first security check (guard 1). The project's signature verification reused a single parameter-string builder that was correct for the *outbound* checkout signing path but fundamentally wrong for the *inbound* ITN verification path. PayFast's two algorithms differ in three rules: inbound does NOT skip blank fields, does NOT trim values, and iterates posted (received) order rather than insertion order.

Real PayFast ITNs always contain multiple blank fields (`name_last`, `custom_str1..5`, `custom_int1..5`, frequently `item_description`). When recomputed with blank-skip enabled, the digest can never match. **This is the sole reason every real sandbox ITN has been rejected at guard 1, even though payment was genuinely completed on PayFast's side.**

The fix is additive only: two new functions in `lib/payfast.ts` (`buildPayfastNotifyParamString`, `generateNotifySignature`) that implement PayFast's inbound algorithm correctly. The outbound path remains untouched and working. However, the route file is sha256-pinned, so updating its two call sites to use the new functions requires a documented re-pin ceremony before this fix can ship. As of 2026-08-16, the new functions are in `lib/payfast.ts` but the route has not been updated.

---

## The Defect Explained

### Two algorithms, one builder, collision

`lib/payfast.ts` exports `buildPayfastParamString` and `generateSignature`. These implement PayFast's **outbound** signing algorithm (used to sign the checkout form sent to PayFast). The algorithm is correct for that use case — PayFast has been accepting our checkout signatures (evidence: sandbox purchases do complete, and ITNs do arrive, meaning the checkout form was validly signed).

When an ITN arrives, `app/api/tickets/itn/route.ts` line 89 calls `generateSignature(fields, passphrase)` to recompute the signature and verify the payload wasn't tampered with. This reuse is the defect. **The ITN verification algorithm is different** — it's documented separately by PayFast under "Step 4.3: Conduct security checks" → "Verify the signature". The differences are binding:

1. **Outbound** (checkout): iterate insertion order, **skip blank fields**, **trim() every value**, then append `&passphrase=urlencode(trim(passphrase))`.
2. **Inbound** (ITN): iterate posted (received) order, **include all fields** (even blank), **urlencode() directly on the raw value** (no trim), then append `&passphrase=urlencode(passphrase)` (no trim on passphrase either).

PayFast's own reference implementation (`contracts/golden/payfast-itn-signature/inbound-algorithm.golden.md`, fetched from their docs verbatim on 2026-08-15) confirms both algorithms in PHP. The key distinction:

**Outbound (checkout):**
```php
if($val !== '') {  // ← SKIP blank fields
    $pfOutput .= $key .'='. urlencode( trim( $val ) ) .'&';
}
```

**Inbound (ITN):**
```php
// No blank check, no trim
$pfParamString .= $key .'='. urlencode( $val ) .'&';
```

### Why this only became observable on 2026-08-15

The project's Firestore `tickets` collection contains 4 `reserved` documents with no ticket ever reaching `paid` in this project's history. These were *not* evidence of a webhook bug — they are orphaned reservations with no completed payment. The signature defect only became observable when a purchase was actually completed end to end.

On 2026-08-15 at 17:27:46Z and 17:28:36Z, two ITN POSTs arrived in Cloud Logging (`saoc-webapp` project, `[tickets/itn]` filter). Both were rejected at guard 1 with identical error:

```
[tickets/itn] Signature mismatch — rejecting ITN
```

Both had null or malformed `m_payment_id`, so payload corruption during transmission was considered and ruled out by examining the PayFast Sandbox logs. The real reason: PayFast's ITN body always includes blank fields like `name_last=''` and `custom_str1=''`. When `generateSignature` recomputed the digest with `buildPayfastParamString` (which skips `''` values), it produced a digest that could not possibly match PayFast's own computed signature.

**Verification:** Query Cloud Logging for the two rejected ITNs:

```
resource.type="cloud_run_revision"
resource.labels.service_name="saoc-webapp"
textPayload=~"[tickets/itn] Signature mismatch"
```

Both arrived on 2026-08-15 17:27–17:28Z, the same minute the purchase was completed in PayFast Sandbox.

---

## The Fix: Separate Algorithm Implementations

`lib/payfast.ts` now exports two new functions alongside the existing outbound ones:

```ts
export function buildPayfastNotifyParamString(fields: Record<string, string>): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    pairs.push(`${key}=${phpUrlEncode(value)}`);  // ← No trim, no blank-skip
  }
  return pairs.join('&');
}

export function generateNotifySignature(
  fields: Record<string, string>,
  passphrase?: string | null
): string {
  let paramString = buildPayfastNotifyParamString(fields);
  if (passphrase) {
    paramString += `&passphrase=${phpUrlEncode(passphrase)}`;  // ← No trim on passphrase
  }
  return createHash('md5').update(paramString).digest('hex');
}
```

These are deliberately separate from the outbound functions. A prior version of this file unified them (reusing `buildPayfastParamString` for both paths), which was the bug. **Do not unify them again** — the two algorithms are genuinely different and must stay separate to catch any future confusion.

**Why separate functions are better:**
- The inbound algorithm is load-bearing and security-critical. A future developer touching `buildPayfastParamString` will not accidentally break it.
- Tests and contract assertions can independently verify each algorithm.
- The code documents the defect and the fix by its structure.

### Outbound path: untouched and still working

The checkout flow in `app/api/tickets/checkout/route.ts` line 406 continues to call `generateSignature(signedFields, passphrase)` — this is correct and remains correct. Checkout signatures have been accepted by PayFast since the outbound algorithm is correct. This will not change.

### Inbound path: requires route update

When the `app/api/tickets/itn/route.ts` pin is lifted (see below), the route must be updated at two call sites:

- **Line 89** (guard 1, signature verification):
  - Old: `const expectedSignature = generateSignature(fields, passphrase);`
  - New: `const expectedSignature = generateNotifySignature(fields, passphrase);`

- **Line 193** (guard 4, server-confirm POST body):
  - Old: `body: buildPayfastParamString(fields)`
  - New: `body: buildPayfastNotifyParamString(fields)`

Both changes are required. Guard 4 calls PayFast's `/eng/query/validate` endpoint, which expects the **same** parameter string (inbound algorithm) as the signature check. The server-confirm body has the identical defect and must change too.

---

## Known Remaining Defect: `parseOrderedFields` Divergence

In the pinned route, line 69 uses `continue` where PayFast's reference implementation uses `break`. This is dormant today because PayFast posts `signature` last (line 68 encounters it, executes `continue`, loop exits naturally), but it is a genuine divergence from the spec.

PayFast's documented code iterates posted variables and stops **at** the signature field:
```php
foreach( $pfData as $key => $val ) {
    if( $key !== 'signature' ) {
        $pfParamString .= ...
    } else {
        break;  // ← Stop iteration when signature is found
    }
}
```

The project's code continues instead:
```ts
for (const [key, value] of params) {
    if (key === 'signature') {
        signature = value;
        continue;  // ← Skip this iteration, continue the loop
    }
    fields[key] = value;
}
```

If PayFast's field order changes and `signature` no longer arrives last, `continue` would still process any fields after it (building the digest over too many fields), while PayFast's `break` would have stopped at `signature` and produced a different digest. This is **not fixed by the current planned change** and exists in the pinned file.

---

## Verification Strategy

### 1. Contract Assertions (8 assertions, 6 pass, 2 blocked)

Run the contract:

```bash
pnpm contract contracts/contract-payfast-itn-signature.yaml
```

**Currently passing (6/8):**
- **A1:** `generateNotifySignature` reproduces the independently-computed MD5 for a realistic sandbox ITN fixture (posted order, no trim, no blank-skip). Rejects the broken variant where the function doesn't exist or reuses the outbound builder.
- **A2:** Altering `amount_gross` in the ITN body changes the signature `generateNotifySignature` computes; the tampered fixture (unchanged signature, altered amount) fails verification.
- **A3:** `buildPayfastNotifyParamString` (inbound) and `buildPayfastParamString` (outbound) produce **different** output on fixtures containing blank fields, proving the split is real.
- **A4:** `buildPayfastParamString` (outbound) still trims values and skips blank fields (outbound path untouched).
- **A7:** `checkout/route.ts:406` still calls `generateSignature` (outbound path not changed).
- **A8:** `lib/payfast.ts` exports both new inbound functions by name.

**Currently blocked (2/8):** A5 and A6 require the route to call the new functions. Cannot pass until the route's sha256 pin is lifted and the file is updated.

### 2. Sandbox Verification (Manual, End-to-End)

Once the route is updated and re-pinned:

1. **Set credentials in `.env.local`:**
   ```bash
   PAYFAST_SANDBOX_MERCHANT_ID=<sandbox-id>
   PAYFAST_SANDBOX_MERCHANT_KEY=<sandbox-key>
   PAYFAST_SANDBOX_PASSPHRASE=<sandbox-passphrase>
   ```

2. **Run regression tests:**
   ```bash
   pnpm exec tsx scripts/verify-payfast-signature.ts
   pnpm exec tsx scripts/verify-payfast-itn-ip.ts
   ```

3. **Drive a complete checkout and purchase via PayFast Sandbox:**
   - Start the dev server: `pnpm dev`
   - Navigate to `/tickets` (once the buy-flow UI is built in F4/F5)
   - Complete a payment in PayFast Sandbox

4. **Verify the ticket reached `paid` in Firestore:**
   - Check the `tickets` collection for the booking reference
   - Confirm `status: 'paid'`, `pf_payment_id` is set, `purchasedAt` has a value
   - Cloud Logging should show no `[tickets/itn] Signature mismatch` errors

5. **Verify no errors in Cloud Logging:**
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="saoc-webapp"
   textPayload=~"[tickets/itn]"
   ```
   Should show successful completions, no guard-1 rejections.

### 3. Difference Verification (Independent Implementation)

The contract's `verify_itn_signature.ts` (in `contracts/golden/payfast-itn-signature/`) independently implements the inbound algorithm and cross-verifies against the library's functions. It uses a realistic PayFast ITN fixture and a tampered variant. Run via contract assertion A1–A2.

---

## Timeline and Deployment Sequence

1. **Status quo (as of 2026-08-16):**
   - `lib/payfast.ts` has the new functions (`generateNotifySignature`, `buildPayfastNotifyParamString`)
   - `app/api/tickets/itn/route.ts` is sha256-pinned and still uses the old functions
   - Contract assertions A1–A4, A7–A8 pass; A5–A6 fail (route not updated)

2. **To complete the fix (requires human action first):**
   - A human lifts the sha256 pin on `app/api/tickets/itn/route.ts`
   - Update the two call sites (lines 89 and 193) to use the new functions
   - Update the pinned hash file (`contracts/golden/ticketing-hardening/itn-route.golden.sha256`)
   - Run the contract again — all 8 assertions should pass
   - Commit

3. **Then dispatch @dev if the contract is not green after human edits** — it is not: A5 and A6 will still fail because the route has not been updated.

---

## Related

- **Integration overview:** [docs/payfast-integration.md](payfast-integration.md) — payment flow design and security boundaries
- **Hardening:** [docs/ticketing-hardening.md](ticketing-hardening.md) — other ticketing defects fixed alongside this one
- **Schema:** [docs/firestore-ticket-schema.md](firestore-ticket-schema.md)
- **Contract:** `contracts/contract-payfast-itn-signature.yaml`
- **Golden files:** `contracts/golden/payfast-itn-signature/` — inbound algorithm reference, fixtures, verification script
- **PayFast docs:** https://developers.payfast.co.za/docs
