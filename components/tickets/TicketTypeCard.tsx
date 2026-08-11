// F2 (ticketing-pages) — presentational card for one ticket type inside
// TicketPurchaseForm's radio group. No hooks/browser APIs of its own, so it needs no
// 'use client' directive — it inherits the client boundary from its parent form.
export interface TicketTypeCardData {
  slug: string;
  name: string;
  price: number;
  description: string;
  soldOut: boolean;
}

interface TicketTypeCardProps {
  ticketType: TicketTypeCardData;
  selected: boolean;
  onSelect: (slug: string) => void;
  soldOutLabel: string;
}

export function TicketTypeCard({ ticketType, selected, onSelect, soldOutLabel }: TicketTypeCardProps) {
  const { slug, name, price, description, soldOut } = ticketType;
  const inputId = `ticket-type-${slug}`;

  return (
    <label
      htmlFor={inputId}
      className={`flex cursor-pointer items-start justify-between gap-4 border p-5 transition ${
        soldOut
          ? 'cursor-not-allowed border-rule bg-bone/60 opacity-60'
          : selected
            ? 'border-ink bg-bone'
            : 'border-rule bg-parchment hover:bg-bone'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          type="radio"
          name="ticketType"
          value={slug}
          checked={selected}
          disabled={soldOut}
          onChange={() => onSelect(slug)}
          className="mt-1.5"
          aria-describedby={`${inputId}-desc`}
        />
        <div>
          <p className="font-serif text-[18px] font-semibold text-ink">{name}</p>
          <p id={`${inputId}-desc`} className="mt-1 font-sans text-[13px] text-ink/70">
            {description}
          </p>
          {soldOut ? (
            <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              {soldOutLabel}
            </span>
          ) : null}
        </div>
      </div>
      <p className="shrink-0 font-serif text-[20px] font-medium text-ink">
        {price === 0 ? 'Free' : `R${price.toFixed(2)}`}
      </p>
    </label>
  );
}
