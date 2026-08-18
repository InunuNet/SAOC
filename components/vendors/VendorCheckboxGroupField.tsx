// Generic multi-select checkbox group (vendorCategory, paymentMethodsAccepted). id contract:
// outer <fieldset id="vendor-register-<key>"> + <legend>, each option
// <input id="vendor-register-<key>-<optionValue>"> with its own <label htmlFor>.
interface VendorCheckboxGroupOption {
  value: string;
  label: string;
}

interface VendorCheckboxGroupFieldProps {
  fieldKey: string;
  label: string;
  options: VendorCheckboxGroupOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  required: boolean;
}

const legendClass = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted';
const optionLabelClass = 'flex items-center gap-2 font-sans text-[15px] text-ink';
const checkboxClass =
  'h-4 w-4 rounded-sm border border-rule outline-none focus:ring-2 focus:ring-ink/40 disabled:opacity-60';

export function VendorCheckboxGroupField({
  fieldKey,
  label,
  options,
  value,
  onChange,
  disabled,
  required,
}: VendorCheckboxGroupFieldProps) {
  const id = `vendor-register-${fieldKey}`;

  function toggle(optionValue: string, checked: boolean) {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((entry) => entry !== optionValue));
    }
  }

  return (
    <fieldset id={id} className="space-y-2" aria-required={required ? 'true' : undefined}>
      <legend className={legendClass}>
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label key={option.value} htmlFor={optionId} className={optionLabelClass}>
              <input
                id={optionId}
                type="checkbox"
                name={fieldKey}
                value={option.value}
                checked={value.includes(option.value)}
                onChange={(e) => toggle(option.value, e.target.checked)}
                disabled={disabled}
                className={checkboxClass}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
