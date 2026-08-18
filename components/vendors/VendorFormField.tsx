// Generic labelled text/tel/email/url/number/textarea input for the vendor registration form.
// Mirrors components/tickets/TicketFormField.tsx's existing convention (label + input classes,
// focus-visible ring) rather than inventing a new one. id contract: id="vendor-register-<key>".
interface VendorFormFieldProps {
  fieldKey: string;
  label: string;
  htmlType: 'text' | 'tel' | 'email' | 'url' | 'number' | 'textarea';
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  required: boolean;
  min?: number;
  step?: number;
  placeholder?: string;
}

const labelClass = 'font-mono text-[11px] uppercase tracking-[0.16em] text-muted';
const inputClass =
  'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 disabled:opacity-60';

export function VendorFormField({
  fieldKey,
  label,
  htmlType,
  value,
  onChange,
  disabled,
  required,
  min,
  step,
  placeholder,
}: VendorFormFieldProps) {
  const id = `vendor-register-${fieldKey}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {htmlType === 'textarea' ? (
        <textarea
          id={id}
          name={fieldKey}
          required={required}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`${inputClass} resize-y`}
        />
      ) : (
        <input
          id={id}
          name={fieldKey}
          type={htmlType}
          required={required}
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
