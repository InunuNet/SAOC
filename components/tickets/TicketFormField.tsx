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
}

export function TicketFormField({
  id,
  label,
  type,
  value,
  onChange,
  disabled,
  error,
}: TicketFormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className="w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 disabled:opacity-60"
      />
      {error ? <p className="font-sans text-[13px] text-accent">{error}</p> : null}
    </div>
  );
}
