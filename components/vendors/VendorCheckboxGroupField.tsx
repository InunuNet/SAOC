// Generic multi-select checkbox group (vendorCategory, paymentMethodsAccepted). id contract:
// outer <fieldset id="vendor-register-<key>"> + <legend>, each option
// <input id="vendor-register-<key>-<optionValue>"> with its own <label htmlFor>.
//
// Opt-in accessibility props (VendorApplyForm uses them; other callers do not, so their legends
// do not change): `showRequirement` marks an optional legend "(optional)" and uses the shared `.nos-form-label` class, `error` renders a linked
// inline message. A fieldset takes no required-state ARIA attribute, so the requirement is stated in the legend.
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
  showRequirement?: boolean;
  error?: string;
}

const legendClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const requirementLegendClass = 'nos-form-label';
const optionLabelClass = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
// Native control (exempt from WCAG 1.4.11); the label row keeps a 44px hit area.
const checkboxClass =
  'h-4 w-4 shrink-0 accent-primary outline-none focus:ring-2 focus:ring-ink/40 disabled:opacity-60';
const errorClass = 'font-sans text-[14px] text-[var(--status-error)]';

export function VendorCheckboxGroupField({
  fieldKey,
  label,
  options,
  value,
  onChange,
  disabled,
  required,
  showRequirement = false,
  error,
}: VendorCheckboxGroupFieldProps) {
  const id = `vendor-register-${fieldKey}`;
  const errorId = `${id}-error`;
  const requirement = required ? '' : ' (optional)';

  function toggle(optionValue: string, checked: boolean) {
    if (checked) {
      onChange([...value, optionValue]);
    } else {
      onChange(value.filter((entry) => entry !== optionValue));
    }
  }

  return (
    <fieldset
      id={id}
      className="space-y-2"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className={showRequirement ? requirementLegendClass : legendClass}>
        {showRequirement ? `${label}${requirement}` : label}
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
      {error ? (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
