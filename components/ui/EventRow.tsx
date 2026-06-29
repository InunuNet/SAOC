import type { SocietyEvent } from '@/types';

interface EventRowProps {
  event: SocietyEvent;
}

export function EventRow({ event }: EventRowProps) {
  const d = new Date(event.date);
  const day = d.getUTCDate().toString();
  const month = d.toLocaleDateString('en-ZA', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  const year = d.getUTCFullYear().toString();

  return (
    <article
      className={[
        'flex items-stretch gap-0 border-b border-rule',
        'transition-[padding,background] duration-150',
        'hover:bg-bone/60 hover:pl-1',
      ].join(' ')}
    >
      {/* Date block */}
      <div
        className="flex flex-col items-center justify-center w-[110px] shrink-0 py-5 border-l-[3px]"
        style={{ borderLeftColor: 'var(--accent)' }}
      >
        <span className="font-serif text-[32px] font-medium leading-none text-primary">{day}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-1">
          {month}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{year}</span>
      </div>

      {/* Middle: kind, title, venue */}
      <div className="flex flex-col justify-center flex-1 px-6 py-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          {event.kind}
        </p>
        <p className="font-serif text-[20px] font-medium text-primary leading-snug">
          {event.title}
        </p>
        <p className="font-sans text-[14px] text-ink/60 mt-1">
          {event.venue}
        </p>
      </div>

      {/* Right: host + arrow */}
      <div className="flex items-center gap-4 pr-5 shrink-0">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted hidden sm:block">
          {event.host}
        </span>
        <span className="font-serif text-[18px] text-primary" aria-hidden="true">
          →
        </span>
      </div>
    </article>
  );
}
