// F2 (ticketing-pages) — Server Component. Shown in place of the buy form while
// nationalShow.salesOpen is false. No form, no prices, no PayFast reference at all
// (page-states.golden.md).
interface SalesClosedNoticeProps {
  message: string;
}

export function SalesClosedNotice({ message }: SalesClosedNoticeProps) {
  return (
    <div
      className="rounded-[16px] bg-bone px-6 py-8 text-center shadow-[var(--shadow-sm)]"
      role="status"
    >
      <p className="font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-ink">
        Sales closed
      </p>
      <p className="mt-3 font-serif text-[20px] leading-relaxed text-ink">{message}</p>
    </div>
  );
}
