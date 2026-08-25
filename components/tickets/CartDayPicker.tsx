// F5 (ticketing-f5-day-attendees) — one day-select row PER UNIT in the cart, grouped by
// ticket type, rendered ONLY for requiresDaySelection types with quantity > 0. Same
// shape/precedent as CartAttendeeFields.tsx. Its entire list of selectable days comes from
// the `showDays` prop and nothing else — no literal date/day-name anywhere in this file.
export type DayPickerErrors = Record<string, string>;

interface CartDayPickerProps {
  ticketTypes: { slug: string; name: string; requiresDaySelection: boolean }[];
  quantities: Record<string, number>;
  showDays: string[];
  chosenDayByType: Record<string, string[]>;
  errors: DayPickerErrors;
  disabled: boolean;
  onChosenDayChange: (slug: string, index: number, value: string) => void;
}

export function dayPickerRowKey(slug: string, index: number): string {
  return `${slug}-${index}`;
}

export function CartDayPicker({
  ticketTypes,
  quantities,
  showDays,
  chosenDayByType,
  errors,
  disabled,
  onChosenDayChange,
}: CartDayPickerProps) {
  const activeTypes = ticketTypes.filter(
    (t) => t.requiresDaySelection && (quantities[t.slug] ?? 0) > 0
  );
  if (activeTypes.length === 0) return null;

  return (
    <div className="space-y-6">
      {activeTypes.map((type) => {
        const quantity = quantities[type.slug] ?? 0;
        const rows = chosenDayByType[type.slug] ?? [];
        return (
          <fieldset key={type.slug} className="space-y-3">
            <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              {type.name} — chosen day
            </legend>
            {Array.from({ length: quantity }, (_, index) => {
              const key = dayPickerRowKey(type.slug, index);
              const value = rows[index] ?? '';
              const error = errors[key];
              const inputId = `chosen-day-${key}`;
              return (
                <div key={key} className="space-y-1.5 border border-rule/60 p-4">
                  <label
                    htmlFor={inputId}
                    className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted"
                  >
                    {type.name} {index + 1} — day
                  </label>
                  <select
                    id={inputId}
                    required
                    value={value}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    onChange={(e) => onChosenDayChange(type.slug, index, e.target.value)}
                    className="w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink transition-colors focus:border-ink/40 disabled:opacity-60"
                  >
                    <option value="" disabled>
                      Select a day
                    </option>
                    {showDays.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  {error ? (
                    <p
                      role="alert"
                      className="border border-primary-800 bg-bone px-4 py-3 font-sans text-[13px] text-primary-800"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
