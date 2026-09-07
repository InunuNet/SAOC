// =============================================================
// NOS — components/nos/CycleStep.tsx
// Server Component. One year in the three-year rotation timeline. The
// `current` step is the primary-purple emphasis card; past/future steps sit
// on the light ground so the rail reads as a single considered sequence,
// not disconnected blocks.
// =============================================================

export type NosCycleStepStatus = 'past' | 'current' | 'future';

export interface NosCycleStepProps {
  year: number;
  editionLabel: string;
  host: string;
  status: NosCycleStepStatus;
}

export function CycleStep({ year, editionLabel, host, status }: NosCycleStepProps) {
  const isCurrent = status === 'current';
  const isFuture = status === 'future';

  return (
    <div
      className={[
        'relative flex flex-col gap-2 rounded-[length:var(--radius-lg)] p-6',
        isCurrent
          ? 'bg-primary text-ivory shadow-[var(--shadow-card)]'
          : isFuture
            ? 'border border-dashed border-rule bg-parchment'
            : 'border-[length:var(--border-hairline)] border-rule bg-parchment',
      ].join(' ')}
    >
      {isCurrent && (
        <span className="mb-1 inline-flex w-fit items-center rounded-[length:var(--radius-pill)] bg-bone px-2.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
          Next
        </span>
      )}
      {/* Rail marker */}
      <div
        aria-hidden="true"
        className="absolute -top-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2"
        style={{
          backgroundColor: isCurrent ? 'var(--accent)' : 'var(--rule)',
          borderColor: isCurrent ? 'var(--accent)' : 'var(--rule)',
        }}
      />
      <div
        className={[
          'font-serif text-[30px] font-medium leading-none',
          isCurrent ? 'text-ivory' : 'text-ink',
        ].join(' ')}
      >
        {year}
      </div>
      <div
        className={[
          'font-sans text-[11px] font-medium uppercase tracking-[0.14em]',
          isCurrent ? 'text-[var(--lilac-muted)]' : 'text-muted',
        ].join(' ')}
      >
        {editionLabel}
      </div>
      <div
        className={['font-sans text-[14px]', isCurrent ? 'text-ivory/85' : 'text-ink/70'].join(
          ' ',
        )}
      >
        {host}
      </div>
    </div>
  );
}
