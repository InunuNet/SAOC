// Generic multi-select checkbox group (vendorCategory, paymentMethodsAccepted). id contract:
// outer <fieldset id="vendor-register-<key>"> + <legend>, each option
// <input id="vendor-register-<key>-<optionValue>"> with its own <label htmlFor>.
//
// Opt-in accessibility props (VendorApplyForm uses them; other callers do not, so their legends
// do not change): `showRequirement` appends "(required)" to the legend, `error` renders a linked
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
const optionLabelClass = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
// A native checkbox ignores author borders (computed border-width 0), so the box is drawn: a
// 1px muted border (5.2:1, WCAG 1.4.11), primary fill when checked, ivory tick.
const checkboxClass =
  "grid h-5 w-5 shrink-0 appearance-none place-content-center rounded-sm border border-muted bg-ivory outline-none checked:bg-primary after:-mt-0.5 after:block after:h-2.5 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-ivory after:opacity-0 after:content-[''] checked:after:opacity-100 focus:ring-2 focus:ring-ink/40 disabled:opacity-60";
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
  const requirement = required ? '(required)' : '(optional)';

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
      <legend className={legendClass}>
        {showRequirement ? `${label} ${requirement}` : label}
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
