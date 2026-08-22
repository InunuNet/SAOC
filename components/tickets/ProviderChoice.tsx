import { providerLabel } from '@/lib/payments-ui';

// F2 (ozow-payment-provider) — the buyer-facing gateway picker the checkout POST body's
// providerId comes from. Copy/markup only, existing design tokens (CLAUDE.md's no-invented-
// brand-assets rule; spec §4 explicitly authorises this without a Claude Design handoff) — same
// convention as components/vendors/VendorRadioGroupField.tsx. Ozow listed first: Brad's
// direction is that it is now the client's preferred gateway, not merely equal to PayFast.
const PROVIDER_OPTIONS = ['ozow', 'payfast'] as const;

const legendClass = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted';
const optionLabelClass = 'flex items-center gap-2 font-sans text-[15px] text-ink';
const radioClass =
  'h-4 w-4 border border-rule outline-none focus:ring-2 focus:ring-ink/40 disabled:opacity-60';

interface ProviderChoiceProps {
  value: string;
  onChange: (providerId: string) => void;
  disabled: boolean;
}

export function ProviderChoice({ value, onChange, disabled }: ProviderChoiceProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={legendClass}>Pay with</legend>
      <div className="flex gap-4">
        {PROVIDER_OPTIONS.map((option) => {
          const optionId = `checkout-provider-${option}`;
          return (
            <label key={option} htmlFor={optionId} className={optionLabelClass}>
              <input
                id={optionId}
                type="radio"
                name="providerId"
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                disabled={disabled}
                className={radioClass}
              />
              {providerLabel(option)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
