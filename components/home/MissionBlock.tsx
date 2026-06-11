const STATS = [
  { value: '21', label: 'Societies' },
  { value: '1968', label: 'Founded' },
  { value: '18', label: 'Shows' },
  { value: '56', label: 'Judges' },
] as const;

export interface MissionBlockProps {
  missionText?: string | null;
}

export function MissionBlock({ missionText }: MissionBlockProps) {
  const hasCms = typeof missionText === 'string' && missionText.trim().length > 0;

  return (
    <section className="py-24 px-8 md:px-16 bg-parchment">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
        {/* Left column */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary mb-5">
            Our mission
          </p>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
            Where South African growers bring their finest{' '}
            <em className="italic text-primary">blooms to the bench.</em>
          </h2>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {hasCms ? (
            <p className="font-sans text-[18px] leading-[1.65] text-ink">{missionText}</p>
          ) : (
            <p className="font-sans text-[18px] leading-[1.65] text-ink">
              SAOC exists to promote the culture, hybridisation and appreciation of orchids across
              South Africa. We do this through a federated network of 21 societies, a nationally
              accredited judging system first standardised in 1990, and our annual publication{' '}
              <em>Orchids South Africa</em>.
            </p>
          )}
          <p className="font-sans text-[18px] leading-[1.65] text-ink">
            Our remit is orchids <strong>in cultivation</strong> — on the show bench, in the
            greenhouse, and in the community. For indigenous species in the wild, our sibling
            organisation{' '}
            <a href="#" className="inline-link">
              Wild Orchids of Southern Africa
            </a>{' '}
            leads that work.
          </p>

          {/* Stats row */}
          <dl className="grid grid-cols-4 gap-0 mt-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="border-t border-rule pt-4">
                <dt className="font-serif text-[48px] font-medium text-primary leading-none">
                  {stat.value}
                </dt>
                <dd className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mt-1">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
