# Golden: `app/api/tickets/checkout/route.ts` diff shape

See README §3-4. Only the provider-resolution seam changes; nothing else in this route (capacity,
pricing, day-selection, idempotency, reservation transaction) is touched.

## Removed

- `providerId: unknown;` from `CheckoutRequestBody`
- `KNOWN_PROVIDER_IDS` constant
- `isValidProviderId()` function
- the block:
  ```ts
  if (!isValidProviderId(body.providerId)) {
    return NextResponse.json(
      { error: 'A valid providerId (payfast or ozow) is required.' },
      { status: 400 }
    );
  }
  const providerId = body.providerId;
  const paymentProvider = resolveProvider(providerId) as PaymentProvider;
  ```
- `import { resolveProvider } from '@/lib/payments';` narrows to just the type imports still
  needed (`PaymentProvider`, `ProviderReadiness`) — `resolveProvider` is still called, just with
  the server-resolved id instead of `body.providerId` (see below), so this import line itself may
  be unchanged; only `KNOWN_PROVIDER_IDS`/`isValidProviderId` are deleted.

## Added, in the SAME textual position `isValidProviderId(body.providerId)` occupied

(strictly before the `if (!client)` CMS guard, after `parseLineItems`)

```ts
import { resolveActiveGateway } from '@/lib/payments/active-gateway';

// ...

const activeGateway = await resolveActiveGateway();
if (!activeGateway) {
  console.error('[tickets/checkout] No active payment gateway is configured.');
  return NextResponse.json(
    { error: 'Payment gateway is not configured. Please try again later.' },
    { status: 500 }
  );
}
const providerId = activeGateway;
const paymentProvider = resolveProvider(providerId) as PaymentProvider;
```

Note the refusal message is BYTE-IDENTICAL to the existing `gatewayReadiness.ready` refusal
further down in the same route — both mean "we cannot safely pick a gateway right now", and a
caller should not be able to distinguish "not configured because Firestore setting missing" from
"not configured because credentials missing" from the response body.

## Unchanged (still present, still using `providerId`/`paymentProvider` as before)

- `gatewayReadiness = paymentProvider.readiness('initiate')` guard and its refusal
- `resolveExpectedGatewayAmount(providerId, ozowSandboxTestModeEnabled)`
- `reserveTicket({ ..., gateway: providerId, ... })`
- `replayGatewayMatches(storedGateway, input.gateway)` inside the transaction — unchanged
  behaviour; `input.gateway` is now server-resolved rather than client-supplied, but the
  stored-order-wins comparison is identical
- `NOTIFY_PATH_BY_PROVIDER_ID[providerId]`
- the JSON response's `providerId` field (server-derived echo, for `CheckoutRedirectNotice`
  display — not re-added as an input)

## `CheckoutRequestBody` after the change

```ts
interface CheckoutRequestBody {
  showId: unknown;
  lineItems: unknown;
}
```

A `providerId` key present in an actual request body is simply never read — `body.providerId`
must not appear anywhere in the file after this change.
