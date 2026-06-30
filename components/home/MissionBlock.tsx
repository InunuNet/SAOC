const STATS = [
  { value: '21', label: 'Affiliated Societies' },
  { value: '1968', label: 'Founding Year' },
  { value: '18', label: 'National Shows Hosted' },
  { value: '56', label: 'Accredited Judges' },
] as const;

export interface MissionBlockProps {
  missionText?: string | null;
}

export function MissionBlock({ missionText }: MissionBlockProps) {
  const hasCms = typeof missionText === 'string' && missionText.trim().length > 0;

  return (
    <section className="py-24 px-8 md:px-16 bg-parchment">
      <div className="max-w-[1280px] mx-auto">
        {/* Two-column editorial split: heading left, body right */}
        <div className="grid md:grid-cols-[5fr_7fr] gap-x-16 gap-y-10 mb-16">
          {/* Left: eyebrow + headline */}
          <div>
            <div className="mb-5"><span className="eyebrow">Our purpose</span></div>
            <h2 className="font-serif text-[clamp(28px,3.4vw,46px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
              Where South African growers bring their finest{' '}
              <em className="italic">blooms to the bench.</em>
            </h2>
          </div>

          {/* Right: body text */}
          <div className="flex flex-col gap-6 self-end">
            {hasCms ? (
              <p className="font-sans text-[17px] leading-[1.65] text-ink">{missionText}</p>
            ) : (
              <p className="font-sans text-[17px] leading-[1.65] text-ink">
                SAOC exists to promote the culture, hybridisation and appreciation of orchids across
                South Africa. We do this through a federated network of 21 societies, a nationally
                accredited judging system first standardised in 1990, and our annual publication{' '}
                <em>Orchids South Africa</em>.
              </p>
            )}
            <p className="font-sans text-[17px] leading-[1.65] text-ink">
              Our remit is orchids <strong>in cultivation</strong> — on the show bench, in the
              greenhouse, and in the community. For indigenous species in the wild, our sibling
              organisation{' '}
              <a href="#" className="inline-link">
                Wild Orchids of Southern Africa
              </a>{' '}
              leads that work.
            </p>
          </div>
        </div>

        {/* Stats — 4-column horizontal row */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-8 border-t border-rule pt-10">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <dt className="font-serif text-[clamp(36px,4vw,56px)] font-medium text-primary leading-none">
                {stat.value}
              </dt>
              <dd className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-2">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
