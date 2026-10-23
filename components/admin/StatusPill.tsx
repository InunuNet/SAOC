// Reuses only existing tokens, per Codi's ruling: approved and paid are solid dark, pending is the
// pale brass fill, and submitted, under-review, reserved and declined/cancelled/rejected are
// muted outline pills (no strikethrough). The status word is always printed, so the meaning
// never rests on colour alone.
const STATUS_STYLES: Record<string, string> = {
  neutral: 'bg-bone text-ink border border-rule',
  paid: 'bg-primary text-ivory',
  'checked-in': 'bg-primary-800 text-ivory',
  reserved: 'bg-bone text-muted border border-rule',
  cancelled: 'bg-ivory text-muted border border-rule',
  pending: 'bg-accent-soft text-primary-800',
  approved: 'bg-primary text-ivory',
  declined: 'bg-ivory text-muted border border-rule',
  submitted: 'bg-ivory text-muted border border-rule',
  'under-review': 'bg-ivory text-muted border border-rule',
  rejected: 'bg-ivory text-muted border border-rule',
};

const FALLBACK_STYLE = 'bg-bone text-muted border border-rule';

interface StatusPillProps {
  status: string;
  /** Printed text when it should differ from the stored status value. */
  label?: string;
  /** Style key when it should differ from the printed text (e.g. stand-payment states). */
  tone?: string;
  // Extra classes for the printed text only (a list the address has been taken off is struck through).
  textClassName?: string;
}

export function StatusPill({ status, label, tone, textClassName }: StatusPillProps) {
  const style = STATUS_STYLES[tone ?? status] ?? FALLBACK_STYLE;

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] ${style}`}
    >
      <span className={textClassName ? `truncate ${textClassName}` : 'truncate'}>{label ?? status}</span>
    </span>
  );
}
