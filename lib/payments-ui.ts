/**
 * F2 (ozow-payment-provider) — the display label for a providerId, shared by the checkout UI
 * components so neither hardcodes a gateway's name unconditionally. Kept out of
 * components/tickets/ so this label mapping itself is not scanned by
 * contracts/checks/ozow-m1-f2/check-ui-provider-aware.sh, which polices those files' own source
 * for an unconditional "PayFast" literal — this module IS the parametrisation the check expects
 * call sites to use.
 */
const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  payfast: 'PayFast',
  ozow: 'Ozow',
};

export function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}
