import Link from 'next/link';

const YEARBOOK_META = [
  { label: 'Editor', value: 'Lindiwe Khumalo' },
  { label: 'Pages', value: '184' },
  { label: 'ISSN', value: '1816-0336' },
] as const;

export function YearbookStrip() {
  return (
    <section className="py-24 px-8 md:px-16 bg-bone">
      <div className="max-w-[1280px] mx-auto">
        {/* Eyebrow */}
        <div className="mb-5"><span className="eyebrow">In print</span></div>

        {/* Heading */}
        <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary mb-6">
          Orchids South Africa · 2025 yearbook
        </h2>

        {/* Body */}
        <p className="font-sans text-[18px] leading-[1.65] text-ink max-w-[60ch] mb-10">
          Our annual record of award-winning plants, hybridisation notes, society reports and
          judges&apos; commentary. 184 pages. Available to members or via direct subscription.
        </p>

        {/* Meta — 3 columns */}
        <dl className="grid grid-cols-3 gap-x-12 mb-10 pb-10 border-b border-rule">
          {YEARBOOK_META.map((item) => (
            <div key={item.label}>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                {item.label}
              </dt>
              <dd className="font-sans text-[16px] text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* CTAs */}
        <div className="flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="font-sans text-[14px] font-medium bg-primary text-ivory px-6 py-3 hover:bg-primary/85 transition-colors duration-150"
          >
            Subscribe
          </Link>
          <Link
            href="/contact"
            className="font-sans text-[14px] font-medium border border-primary/30 text-primary px-6 py-3 hover:bg-primary/5 transition-colors duration-150"
          >
            Past editions
          </Link>
        </div>
      </div>
    </section>
  );
}
