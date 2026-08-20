// F2 (ticketing-multi-line-item-cart-ui) — one attendee-name/email field pair PER UNIT
// in the cart, grouped by ticket type. Split out of TicketPurchaseForm to keep both
// components under the project's 150-line limit. Reuses the existing TicketFormField
// component and validation pattern — the same per-position requirement the backend
// already enforces uniformly across every ticket type today.
import type { CartAttendee } from '@/lib/cart';
import { TicketFormField } from '@/components/tickets/TicketFormField';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

export type AttendeeFieldErrors = Record<string, { name?: string; email?: string }>;

interface CartAttendeeFieldsProps {
  ticketTypes: TicketTypeCardData[];
  quantities: Record<string, number>;
  attendeesByType: Record<string, CartAttendee[]>;
  errors: AttendeeFieldErrors;
  disabled: boolean;
  onAttendeeChange: (
    slug: string,
    index: number,
    field: keyof CartAttendee,
    value: string
  ) => void;
}

export function attendeeRowKey(slug: string, index: number): string {
  return `${slug}-${index}`;
}

export function CartAttendeeFields({
  ticketTypes,
  quantities,
  attendeesByType,
  errors,
  disabled,
  onAttendeeChange,
}: CartAttendeeFieldsProps) {
  const activeTypes = ticketTypes.filter((t) => (quantities[t.slug] ?? 0) > 0);
  if (activeTypes.length === 0) return null;

  return (
    <div className="space-y-6">
      {activeTypes.map((type) => {
        const rows = attendeesByType[type.slug] ?? [];
        return (
          <fieldset key={type.slug} className="space-y-3">
            <legend className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
              {type.name} attendees
            </legend>
            {rows.map((row, index) => {
              const key = attendeeRowKey(type.slug, index);
              const rowErrors = errors[key] ?? {};
              return (
                <div key={key} className="space-y-3 border border-rule/60 p-4">
                  <p className="font-sans text-[13px] font-medium text-ink/70">
                    Attendee {index + 1} — {type.name}
                  </p>
                  <TicketFormField
                    id={`attendee-${key}-name`}
                    label="Attendee name"
                    type="text"
                    value={row.attendeeName}
                    onChange={(value) => onAttendeeChange(type.slug, index, 'attendeeName', value)}
                    disabled={disabled}
                    error={rowErrors.name}
                  />
                  <TicketFormField
                    id={`attendee-${key}-email`}
                    label="Email address"
                    type="email"
                    value={row.attendeeEmail}
                    onChange={(value) => onAttendeeChange(type.slug, index, 'attendeeEmail', value)}
                    disabled={disabled}
                    error={rowErrors.email}
                  />
                </div>
              );
            })}
          </fieldset>
        );
      })}
    </div>
  );
}
