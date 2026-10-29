// Generic labelled text/tel/email/url/number/textarea input for the vendor registration form.
// Mirrors components/tickets/TicketFormField.tsx's existing convention (label + input classes,
// focus-visible ring) rather than inventing a new one. id contract: id="vendor-register-<key>".
//
// Opt-in accessibility props (the vendor application form uses them; VendorRegisterForm does not,
// so its labels do not change): `showRequirement` swaps the label to the shared `.nos-form-label` class and
// puts aria-required on a required input (R82: no visible suffix; the one optional field's label
// says so in its own text), `error` renders a linked inline message (aria-describedby + aria-invalid).
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
  maxLength?: number;
  pattern?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'tel' | 'email' | 'text';
  showRequirement?: boolean;
  error?: string;
  inputClassName?: string;
}

const labelClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const requirementLabelClass = 'nos-form-label';
const inputClass =
  'block w-full rounded-sm border border-muted bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-ivory disabled:opacity-60';
const inputErrorClass = 'border-[var(--status-error)]';
const errorClass = 'font-sans text-[14px] text-[var(--status-error)]';

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
  maxLength,
  pattern,
  autoComplete,
  inputMode,
  showRequirement = false,
  error,
  inputClassName,
}: VendorFormFieldProps) {
  const id = `vendor-register-${fieldKey}`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;
  const baseClass = error ? `${inputClass} ${inputErrorClass}` : inputClass;
  const fieldClass = inputClassName ? `${baseClass} ${inputClassName}` : baseClass;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={showRequirement ? requirementLabelClass : labelClass}>
        {label}
      </label>
      {htmlType === 'textarea' ? (
        <textarea
          id={id}
          name={fieldKey}
          required={required}
          aria-required={required ? true : undefined}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${fieldClass} resize-y`}
        />
      ) : (
        <input
          id={id}
          name={fieldKey}
          type={htmlType}
          required={required}
          aria-required={required ? true : undefined}
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          pattern={pattern}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={fieldClass}
        />
      )}
      {error ? (
        <p id={errorId} className={errorClass}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
