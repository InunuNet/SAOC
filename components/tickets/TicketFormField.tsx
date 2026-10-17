// F2 (ticketing-pages) — labelled text input shared by name/email fields in
// TicketPurchaseForm. No hooks of its own; inherits the client boundary from its
// parent form.
interface TicketFormFieldProps {
  id: string;
  label: string;
  type: 'text' | 'email';
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  autoComplete?: 'name' | 'email';
}

export function TicketFormField({
  id,
  label,
  type,
  value,
  onChange,
  disabled,
  error,
  autoComplete,
}: TicketFormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-sans text-[14px] font-medium text-[var(--ink-700)]">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted transition-colors focus:border-ink/40 disabled:opacity-60"
      />
      {error ? (
        <p
          role="alert"
          className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[14px] text-primary-800"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
