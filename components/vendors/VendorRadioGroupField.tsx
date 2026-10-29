// Generic single-select radio group (boothType). id contract: outer
// <fieldset id="vendor-register-<key>"> + <legend>, each option
// <input id="vendor-register-<key>-<optionValue>">.
interface VendorRadioGroupOption {
  value: string;
  label: string;
}

interface VendorRadioGroupFieldProps {
  fieldKey: string;
  label: string;
  options: VendorRadioGroupOption[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required: boolean;
}

const legendClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const optionLabelClass = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';
const radioClass =
  'size-6 border border-rule outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60';

export function VendorRadioGroupField({
  fieldKey,
  label,
  options,
  value,
  onChange,
  disabled,
  required,
}: VendorRadioGroupFieldProps) {
  const id = `vendor-register-${fieldKey}`;

  return (
    <fieldset id={id} className="space-y-2" aria-required={required ? 'true' : undefined}>
      <legend className={legendClass}>
        {label}
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const optionId = `${id}-${option.value}`;
          return (
            <label key={option.value} htmlFor={optionId} className={optionLabelClass}>
              <input
                id={optionId}
                type="radio"
                name={fieldKey}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                disabled={disabled}
                className={radioClass}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
