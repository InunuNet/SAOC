// F3 (ticketing-flow-redesign) — one row PER DAY, each with its own quantity stepper,
// for the Day Visitor dedicated single-type buy screen. Every day comes from the
// `showDays` prop and nothing else — same single-source-of-truth rule CartDayPicker.tsx
// already follows. See contracts/golden/ticketing-flow-redesign-f3/README.md §2.
interface DayQuantityPickerProps {
  showDays: string[];
  quantitiesByDay: Record<string, number>;
  onQuantityChange: (day: string, quantity: number) => void;
  disabled: boolean;
}

export function DayQuantityPicker({
  showDays,
  quantitiesByDay,
  onQuantityChange,
  disabled,
}: DayQuantityPickerProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        Tickets per day
      </legend>
      {showDays.map((day) => {
        const quantity = quantitiesByDay[day] ?? 0;
        const inputId = `day-quantity-${day}`;
        return (
          <div
            key={day}
            role="group"
            aria-label={day}
            className="flex items-center justify-between gap-3 border border-rule/60 p-4"
          >
            <span className="font-sans text-[15px] text-ink">{day}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(day, Math.max(0, quantity - 1))}
                disabled={disabled}
                aria-label={`Decrease quantity for ${day}`}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
              >
                −
              </button>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={quantity}
                disabled={disabled}
                aria-label={`Quantity for ${day}`}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  onQuantityChange(day, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                }}
                className="w-12 rounded-sm border border-rule bg-ivory px-1 py-1 text-center font-sans text-[15px] text-ink disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => onQuantityChange(day, quantity + 1)}
                disabled={disabled}
                aria-label={`Increase quantity for ${day}`}
                className="flex h-8 w-8 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2"
              >
                +
              </button>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
