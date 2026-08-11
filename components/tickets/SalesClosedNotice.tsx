// F2 (ticketing-pages) — Server Component. Shown in place of the buy form while
// nationalShow.salesOpen is false. No form, no prices, no PayFast reference at all
// (page-states.golden.md).
interface SalesClosedNoticeProps {
  message: string;
}

export function SalesClosedNotice({ message }: SalesClosedNoticeProps) {
  return (
    <div className="border border-rule bg-bone px-6 py-8 text-center" role="status">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        Sales closed
      </p>
      <p className="mt-3 font-serif text-[20px] leading-relaxed text-ink">{message}</p>
    </div>
  );
}
