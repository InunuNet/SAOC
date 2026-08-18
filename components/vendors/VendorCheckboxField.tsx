// Generic single checkbox (termsAccepted). id contract: id="vendor-register-<key>" +
// <label htmlFor="vendor-register-<key>">.
interface VendorCheckboxFieldProps {
  fieldKey: string;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  required: boolean;
}

const checkboxClass =
  'h-4 w-4 rounded-sm border border-rule outline-none focus:ring-2 focus:ring-ink/40 disabled:opacity-60';
const labelClass = 'flex items-start gap-2.5 font-sans text-[15px] leading-relaxed text-ink';

export function VendorCheckboxField({
  fieldKey,
  label,
  value,
  onChange,
  disabled,
  required,
}: VendorCheckboxFieldProps) {
  const id = `vendor-register-${fieldKey}`;

  return (
    <label htmlFor={id} className={labelClass}>
      <input
        id={id}
        type="checkbox"
        name={fieldKey}
        required={required}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={`${checkboxClass} mt-0.5`}
      />
      <span>
        {label}
      </span>
    </label>
  );
}
