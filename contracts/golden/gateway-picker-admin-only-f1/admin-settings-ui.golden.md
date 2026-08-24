# Golden: `app/admin/settings/page.tsx` addition

See README §6. Add a second control block below the existing sandbox-test-mode checkbox, inside
the same page (same layout gate, no new route segment). New state: `gateway: GatewayId | null`,
`gatewayLoading`, `gatewaySaving`, `gatewayError` — parallel to the existing `enabled`/`loading`/
`saving`/`error` state, fetched/PUT against `/api/admin/settings/active-payment-gateway`.

```tsx
<div className="mt-6 max-w-[520px] border border-rule bg-bone px-6 py-6">
  <span className="block font-sans text-[15px] text-ink">Active payment gateway</span>
  <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
    Customers no longer choose a gateway at checkout — this is used for every purchase.
  </span>
  <div className="mt-3 flex gap-4">
    {(['ozow', 'payfast'] as const).map((option) => (
      <label key={option} className="flex items-center gap-2 font-sans text-[15px] text-ink">
        <input
          type="radio"
          name="activeGateway"
          value={option}
          checked={gateway === option}
          disabled={gatewayLoading || gatewaySaving}
          onChange={() => void handleGatewayChange(option)}
        />
        {option === 'ozow' ? 'Ozow' : 'PayFast'}
      </label>
    ))}
  </div>
  {gateway === null && !gatewayLoading ? (
    <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-red-700">
      No gateway is set — checkout will refuse purchases until one is chosen.
    </p>
  ) : null}
  {gatewayError ? (
    <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-red-700">
      {gatewayError}
    </p>
  ) : null}
</div>
```

The "no gateway set" warning is load-bearing, not decoration: it is the admin-visible surface of
the fail-closed refusal in `resolveActiveGateway()` (README §3) — an admin looking at this page
must be able to see that checkout is currently unable to charge anyone, not just discover it via
a support ticket.
