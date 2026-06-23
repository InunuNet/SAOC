import { awards } from '@/lib/data/awards';

export function AwardsGrid() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {awards.map((award) => (
        <div
          key={award.code}
          className="flex flex-col border border-rule bg-parchment p-6"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {award.code}
          </p>
          <h3 className="mt-2 font-serif text-[20px] font-semibold leading-snug text-ink">
            {award.name}
          </h3>
          {award.threshold && award.threshold !== '—' ? (
            <p className="mt-1 font-mono text-[12px] text-ink/60">{award.threshold}</p>
          ) : null}
          <p className="mt-3 font-sans text-[14px] leading-relaxed text-ink/75">
            {award.description}
          </p>
        </div>
      ))}
    </div>
  );
}
