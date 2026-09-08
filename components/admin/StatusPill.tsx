import type { TicketStatus } from '@/types/index';

// Reuses only existing tokens — no new colours. Filled sage reads as "settled/present",
// the tinted sage reads as "paid but not yet checked in", bone is neutral/pending, and
// cancelled is deliberately muted+struck rather than a red we don't have a token for.
const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-primary-100 text-primary-800',
  'checked-in': 'bg-primary text-ivory',
  reserved: 'bg-bone text-muted border border-rule',
  cancelled: 'bg-ivory text-muted border border-rule line-through',
};

const FALLBACK_STYLE = 'bg-bone text-muted border border-rule';

interface StatusPillProps {
  status: TicketStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const style = STATUS_STYLES[status] ?? FALLBACK_STYLE;

  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] ${style}`}
    >
      {status}
    </span>
  );
}
