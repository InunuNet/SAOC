# Golden: checkout UI diff shape

See README §5.

## Deleted entirely

- `components/tickets/ProviderChoice.tsx`

## `components/tickets/TicketPurchaseForm.tsx`

Remove:
```tsx
import { ProviderChoice } from '@/components/tickets/ProviderChoice';
```
and:
```tsx
<ProviderChoice
  value={cart.providerId}
  onChange={cart.setProviderId}
  disabled={cart.status === 'submitting'}
/>
```
The submit button's label simplifies from:
```tsx
{cart.status === 'submitting' ? `Redirecting to ${providerLabel(cart.providerId)}…` : buyButtonLabel}
```
to:
```tsx
{cart.status === 'submitting' ? 'Redirecting…' : buyButtonLabel}
```
(`providerLabel` import stays only if still used elsewhere in the file; if this was its only use
in `TicketPurchaseForm.tsx`, remove the import too. `CheckoutRedirectNotice` — rendered above,
post-redirect — keeps using `providerLabel` independently in its own file, unaffected.)

## `components/tickets/useTicketCart.ts`

Remove:
- `const DEFAULT_PROVIDER_ID = 'ozow';` and its doc comment
- `const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);`
- `providerId,` / `setProviderId,` from the returned object
- `providerId` from the POST body: `JSON.stringify({ showId: NATIONAL_SHOW_ID, lineItems, providerId })`
  becomes `JSON.stringify({ showId: NATIONAL_SHOW_ID, lineItems })`

Keep unchanged: `data.providerId ?? providerId` in the response-parsing branch becomes just
`data.providerId` — the redirect state still needs the SERVER's returned providerId to pass to
`CheckoutRedirectNotice`, there is simply no local `providerId` variable left to fall back to.
