# Golden: `DayQuantityPicker.tsx` + line-item expansion

Full rationale: `README.md` §2-5. **§5 was corrected a second time on 2026-08-24 — see
README §5.1** — this file now reflects the second correction (per-day attendee state), not the
original single-flat-array design.

## 0. Why the flat-array design (first correction) was still wrong

The first correction (§5, still true as the *statement of intent*) fixed the identity-collapsing
bug by zipping the full `attendees` array against `quantitiesByDay` flattened in
`Object.entries()` order. That is insufficient on its own: `quantitiesByDay` was a plain
`{ ...prev, [day]: quantity }` spread (key order = INTERACTION order, not calendar order) and
`attendeesByType[slug]` was resized strictly at the TAIL by `syncAttendeeRows`, driven only by
the running total — agnostic of which day's stepper the buyer had just touched. Those two
orderings only agree when the buyer fills each day exactly once, in showDays order. QA proved
empirically that an ordinary revisit — add 1 more Monday ticket AFTER already entering a Wednesday
ticket — silently swaps two real attendees onto the wrong day (see `.agent/memory/project/specs/
ticketing-flow-redesign` mission notes for the reproduction). The bug is in *how state is edited*,
not in the flatten order at submit time, so sorting `quantitiesByDay` before flattening would not
have fixed it.

**Second correction (this file, 2026-08-24):** eliminate the coupling entirely by tracking
attendee rows PER DAY, sized to that day's own quantity. Editing one day's stepper only ever
touches that day's own row array — never any other day's rows, regardless of what order the buyer
edits days in. `quantitiesByDay` (as UI-facing numbers) becomes a DERIVED view of the per-day
row-array lengths, not independently-tracked state — so the two can no longer drift from each
other by construction.

## 1. `lib/cart.ts` — new per-day pure state helpers, replacing the flat-array ones

```ts
/** Per-day attendee-row state for the Day Visitor per-day quantity picker screen. Each
 *  day's array length IS that day's quantity — no separately-tracked quantity number to
 *  drift out of sync with it. */
export type AttendeesByDay = Record<string, CartAttendee[]>;

/**
 * Resizes ONLY `attendeesByDay[day]`'s own row array to `quantity` — appending
 * `makeAttendee()` rows at that day's own tail, or truncating that day's own tail. Every
 * OTHER day's array is untouched, so editing Monday's stepper can never shift which rows
 * belong to Wednesday, no matter what order the buyer visits days in.
 */
export function updateAttendeesByDay(
  attendeesByDay: AttendeesByDay,
  day: string,
  quantity: number,
  makeAttendee: () => CartAttendee
): AttendeesByDay {
  const current = attendeesByDay[day] ?? [];
  if (quantity === current.length) return attendeesByDay;
  const nextRows =
    quantity < current.length
      ? current.slice(0, quantity)
      : [...current, ...Array.from({ length: quantity - current.length }, makeAttendee)];
  return { ...attendeesByDay, [day]: nextRows };
}

/**
 * Flattens `attendeesByDay` into the SAME row order `CartAttendeeFields` renders and
 * `expandAttendeesByDayToLineItems` expands — `showDays` order (chronological), NEVER
 * `Object.entries(attendeesByDay)` order (interaction order). This is the single
 * chronological-ordering authority both the render path and the submit path must share.
 */
export function flattenAttendeesByDay(attendeesByDay: AttendeesByDay, showDays: string[]): CartAttendee[] {
  return showDays.flatMap((day) => attendeesByDay[day] ?? []);
}

/**
 * Maps a flat row index (the `i`-th panel `CartAttendeeFields` renders, 0-indexed, in
 * `flattenAttendeesByDay` order) back to which day's array — and which local index within
 * it — that panel belongs to. Returns `null` for an out-of-range index (defensive; should
 * not happen if the caller only passes indices `CartAttendeeFields` actually rendered).
 */
export function locateFlatAttendeeIndex(
  attendeesByDay: AttendeesByDay,
  showDays: string[],
  flatIndex: number
): { day: string; localIndex: number } | null {
  let remaining = flatIndex;
  for (const day of showDays) {
    const rows = attendeesByDay[day] ?? [];
    if (remaining < rows.length) return { day, localIndex: remaining };
    remaining -= rows.length;
  }
  return null;
}

/**
 * Writes one field on one attendee row, addressed by FLAT index (the index
 * `CartAttendeeFields`'s `onAttendeeChange` callback reports), by first resolving it to
 * (day, localIndex) via `locateFlatAttendeeIndex` and updating only that day's array. A
 * no-op (returns `attendeesByDay` unchanged) if the index doesn't resolve.
 */
export function updateAttendeeFieldByFlatIndex(
  attendeesByDay: AttendeesByDay,
  showDays: string[],
  flatIndex: number,
  field: keyof CartAttendee,
  value: string
): AttendeesByDay {
  const loc = locateFlatAttendeeIndex(attendeesByDay, showDays, flatIndex);
  if (!loc) return attendeesByDay;
  const rows = attendeesByDay[loc.day] ?? [];
  const nextRows = rows.map((row, i) => (i === loc.localIndex ? { ...row, [field]: value } : row));
  return { ...attendeesByDay, [loc.day]: nextRows };
}

/**
 * Expands `attendeesByDay` into a flat, ORDERED array of line items — `showDays` order,
 * NOT `Object.entries()` order (the bug this second correction fixes). Each day's own
 * quantity is that day's own array length, so there is no separate quantity value that
 * could disagree with the row count — the mismatch-throw the first correction needed no
 * longer applies, because there is only one source of truth to read.
 */
export function expandAttendeesByDayToLineItems(input: {
  ticketType: string;
  attendeesByDay: AttendeesByDay;
  showDays: string[];
}): { ticketType: string; attendeeName: string; attendeeEmail: string; chosenDay: string }[] {
  const lineItems: { ticketType: string; attendeeName: string; attendeeEmail: string; chosenDay: string }[] = [];
  for (const day of input.showDays) {
    const rows = input.attendeesByDay[day] ?? [];
    for (const attendee of rows) {
      lineItems.push({
        ticketType: input.ticketType,
        attendeeName: attendee.attendeeName,
        attendeeEmail: attendee.attendeeEmail,
        chosenDay: day,
      });
    }
  }
  return lineItems;
}
```

`expandDayQuantitiesToLineItems` (the flat `{ attendees, quantitiesByDay }` function from the
first correction) is REMOVED — `expandAttendeesByDayToLineItems` replaces it. There is no reason
to keep both: the flat shape it consumed is exactly the shape that made the bug possible to write
in the first place.

Truth table dev must match (attendees `A`, `B`, `C` are distinct `{attendeeName, attendeeEmail}`
values — the test MUST use distinct values per row, not the same value repeated, or it cannot
catch a row-identity mixup):

| `attendeesByDay` | `showDays` | output length | output |
|---|---|---|---|
| `{}` | `['2027-09-16', '2027-09-18']` | 0 | `[]` |
| `{ '2027-09-16': [] }` | `['2027-09-16']` | 0 | `[]` (an entry with an empty array produces no line items) |
| `{ '2027-09-16': [A, B], '2027-09-18': [C] }` | `['2027-09-16', '2027-09-18']` | 3 | `{chosenDay:'2027-09-16', ...A}`, `{chosenDay:'2027-09-16', ...B}`, `{chosenDay:'2027-09-18', ...C}` |
| `{ '2027-09-18': [C], '2027-09-16': [A, B] }` (Wed inserted into the object BEFORE Mon) | `['2027-09-16', '2027-09-18']` | 3 | SAME as the row above — output order follows `showDays`, never the object's own key-insertion order |

**A10's regression check** (`contracts/checks/ticketing-flow-redesign-f3/check-interleaved-day-edit.mjs`)
drives `updateAttendeesByDay` + `updateAttendeeFieldByFlatIndex` + `expandAttendeesByDayToLineItems`
through the exact QA-reported interleaved sequence — Mon+1 → fill row 0 → Wed+1 → fill row 1 →
Mon+1-again → fill row 2 — and asserts the final mapping matches buyer intent
(`Alice→Mon, Bob→Wed, Carla→Mon`), not the object-insertion-order result the old code produced
(`Alice→Mon, Bob→Mon, Carla→Wed`).

## `components/tickets/DayQuantityPicker.tsx` (new)

```tsx
interface DayQuantityPickerProps {
  showDays: string[];
  quantitiesByDay: Record<string, number>;
  onQuantityChange: (day: string, quantity: number) => void;
  disabled: boolean;
}

export function DayQuantityPicker({ showDays, quantitiesByDay, onQuantityChange, disabled }: DayQuantityPickerProps) {
  return (
    <fieldset>
      <legend>...</legend>
      {showDays.map((day) => (
        <div key={day} role="group" aria-label={day}>
          <span>{day}</span>
          {/* same +/-/number-input stepper pattern as TicketTypeCard's existing stepper */}
          <button type="button" onClick={() => onQuantityChange(day, Math.max(0, (quantitiesByDay[day] ?? 0) - 1))} disabled={disabled}>−</button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={quantitiesByDay[day] ?? 0}
            disabled={disabled}
            onChange={(e) => onQuantityChange(day, Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
          />
          <button type="button" onClick={() => onQuantityChange(day, (quantitiesByDay[day] ?? 0) + 1)} disabled={disabled}>+</button>
        </div>
      ))}
    </fieldset>
  );
}
```

No literal calendar date anywhere in this file — every day comes from the `showDays` prop, same
rule `CartDayPicker.tsx` already follows (`docs/f5-day-selection-attendees.md` §"UI: Day Picker").

## `useTicketCart.ts`

`useTicketCart` now takes `showDays: string[]` as a second parameter — it needs the same
chronological-ordering authority `DayQuantityPicker`/`CartDayPicker` already use, to resolve flat
attendee-row indices back to a day (below). `TicketPurchaseForm.tsx` already has `showDays` as a
prop; it passes it straight through: `useTicketCart(ticketTypes, showDays)`.

Replaces `quantitiesByDay` state with `attendeesByDay` state (source of truth); `quantitiesByDay`
becomes a derived read, used only when `useDayQuantityPicker` (README §3) is true:

```ts
const [attendeesByDay, setAttendeesByDay] = useState<AttendeesByDay>({});

// Derived, not separately tracked — cannot drift from attendeesByDay by construction.
const quantitiesByDay = Object.fromEntries(showDays.map((day) => [day, attendeesByDay[day]?.length ?? 0]));

function updateDayQuantity(day: string, quantity: number) {
  const currentLength = attendeesByDay[day]?.length ?? 0;
  if (quantity === currentLength) return;
  setAttendeesByDay((prev) => updateAttendeesByDay(prev, day, quantity, emptyAttendee));

  const slug = ticketTypes.length === 1 ? ticketTypes[0].slug : undefined;
  if (!slug) return;
  const delta = quantity - currentLength;
  setQuantities((prev) => ({ ...prev, [slug]: (prev[slug] ?? 0) + delta }));
}
```

`updateAttendeeField` gains a branch for the day-quantity-picker screen — `CartAttendeeFields`
still calls it with the SAME `(slug, index, field, value)` signature it always has (§6,
`CartAttendeeFields.tsx` itself is unchanged); `useTicketCart` internally routes the write to
`attendeesByDay` instead of `attendeesByType` when the slug is the single day-quantity-picker type:

```ts
function updateAttendeeField(slug: string, index: number, field: keyof CartAttendee, value: string) {
  if (useDayQuantityPicker && slug === ticketTypes[0].slug) {
    setAttendeesByDay((prev) => updateAttendeeFieldByFlatIndex(prev, showDays, index, field, value));
    return;
  }
  setAttendeesByType((prev) => {
    const rows = prev[slug] ?? [];
    return { ...prev, [slug]: rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)) };
  });
}
```

`attendeesByType` returned to the caller (feeding `CartAttendeeFields`, `validateAttendees`, and
the non-day-quantity-picker `buildLineItemsFromCart` submit path — all unchanged, §6) is merged
with the day-quantity-picker type's FLATTENED view for render, using the same `showDays`-ordered
flatten the submit path uses — never `Object.entries`/tail-append order:

```ts
const attendeesByType = useDayQuantityPicker
  ? { ...attendeesByTypeState, [ticketTypes[0].slug]: flattenAttendeesByDay(attendeesByDay, showDays) }
  : attendeesByTypeState;
```

(`attendeesByTypeState` is the renamed original `useState<Record<string, CartAttendee[]>>({})` —
still used as-is for every non-day-quantity-picker type.)

At submit time, the call site passes `attendeesByDay` + `showDays` directly — no separate
`attendees` array to keep paired with a separate `quantitiesByDay` map:

```ts
lineItems = expandAttendeesByDayToLineItems({
  ticketType: slug,
  attendeesByDay,
  showDays,
});
```

`chosenDayByType`/`updateChosenDay` (F5's existing per-unit state) are UNCHANGED and still used by
`CartDayPicker`'s multi-type-cart path (README §3-4).

## `TicketPurchaseForm.tsx`

```tsx
const cart = useTicketCart(ticketTypes, showDays);
const useDayQuantityPicker = ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;

// ...

{useDayQuantityPicker ? (
  <DayQuantityPicker
    showDays={showDays}
    quantitiesByDay={cart.quantitiesByDay}
    onQuantityChange={cart.updateDayQuantity}
    disabled={cart.status === 'submitting'}
  />
) : (
  <CartDayPicker
    ticketTypes={ticketTypes}
    quantities={cart.quantities}
    showDays={showDays}
    chosenDayByType={cart.chosenDayByType}
    errors={cart.chosenDayErrors}
    disabled={cart.status === 'submitting'}
    onChosenDayChange={cart.updateChosenDay}
  />
)}
```

`TicketTypeCard`'s own stepper is hidden (not rendered, not merely disabled) for the single type
when `useDayQuantityPicker` is true — pass `mode="buy"` with a new optional
`hideQuantityStepper?: boolean` prop, `true` only in this branch.
