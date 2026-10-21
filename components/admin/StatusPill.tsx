// Reuses only existing tokens — no new colours. Filled sage reads as "settled/present",
// the tinted sage reads as "in progress", bone is neutral/pending, and declined/cancelled/rejected is
// the muted outline pill rather than a red we don't have a token for. The status word is
// always printed, so the meaning never rests on colour alone.
const STATUS_STYLES: Record<string, string> = {
  neutral: 'bg-bone text-ink border border-rule',
  paid: 'bg-primary-100 text-primary-800',
  'checked-in': 'bg-primary text-ivory',
  reserved: 'bg-bone text-muted border border-rule',
  cancelled: 'bg-ivory text-muted border border-rule',
  pending: 'bg-bone text-muted border border-rule',
  approved: 'bg-primary text-ivory',
  declined: 'bg-ivory text-muted border border-rule',
  submitted: 'bg-bone text-muted border border-rule',
  'under-review': 'bg-primary-100 text-primary-800',
  rejected: 'bg-ivory text-muted border border-rule',
};

const FALLBACK_STYLE = 'bg-bone text-muted border border-rule';

interface StatusPillProps {
  status: string;
  /** Printed text when it should differ from the stored status value. */
  label?: string;
  /** Style key when it should differ from the printed text (e.g. stand-payment states). */
  tone?: string;
}

export function StatusPill({ status, label, tone }: StatusPillProps) {
  const style = STATUS_STYLES[tone ?? status] ?? FALLBACK_STYLE;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] ${style}`}
    >
      <span className="truncate">{label ?? status}</span>
    </span>
  );
}
