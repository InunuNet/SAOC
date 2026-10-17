// F3 (ticketing-flow-redesign) — one row PER DAY, each with its own quantity stepper,
// for the Day Visitor dedicated single-type buy screen. Every day comes from the
// `showDays` prop and nothing else — same single-source-of-truth rule CartDayPicker.tsx
// already follows. See contracts/golden/ticketing-flow-redesign-f3/README.md §2.
import { formatShowDay } from '@/lib/show-day-format';

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
      <legend className="font-sans text-[14px] font-semibold text-ink">Tickets per day</legend>
      {showDays.map((day) => {
        const quantity = quantitiesByDay[day] ?? 0;
        const inputId = `day-quantity-${day}`;
        const label = formatShowDay(day);
        return (
          <div
            key={day}
            role="group"
            data-day-row=""
            aria-label={label}
            className="flex items-center justify-between gap-3 border border-rule/60 p-4"
          >
            <time dateTime={day} className="font-sans text-[15px] text-ink">
              {label}
            </time>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onQuantityChange(day, Math.max(0, quantity - 1))}
                disabled={disabled}
                aria-label={`Decrease quantity for ${label}`}
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
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
                aria-label={`Quantity for ${label}`}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  onQuantityChange(day, Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                }}
                className="h-11 w-12 rounded-sm border border-rule bg-ivory px-1 py-1 text-center font-sans text-[15px] text-ink disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => onQuantityChange(day, quantity + 1)}
                disabled={disabled}
                aria-label={`Increase quantity for ${label}`}
                className="flex h-11 w-11 items-center justify-center rounded-sm border border-rule font-sans text-[16px] text-ink transition-colors hover:bg-bone disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)]"
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
