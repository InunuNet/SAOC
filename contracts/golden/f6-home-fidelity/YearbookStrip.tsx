// GOLDEN REFERENCE — f6-home-fidelity, D3 (+ D4 regression guard)
// Target shape for components/home/YearbookStrip.tsx.
// @dev implements against this; it is not imported anywhere.
//
// D3: swap /images/orchid-pink.jpg (wrong photo, no badge) for
// /images/orchid-purple.jpg (closest available asset to the reference's
// dark-purple crop, ref-section-7.png) + add the "EST. 1968" badge overlay,
// pill-on-image pattern matching the eyebrow/pill idiom used elsewhere
// (e.g. ShowBand.tsx's `eyebrow eyebrow--light`), positioned top-left over
// the image per reference.
//
// D4 (regression guard only — no fix needed, see contract goal): the
// heading's <em> must continue to wrap ONLY "Orchids South Africa", not
// "· 2025 yearbook". Source already scopes it correctly; audit's "fully
// italic" observation did not reproduce against computed source — this
// golden pins the correct scoping so it can't regress silently.
import Image from 'next/image';
import Link from 'next/link';

const YEARBOOK_META = [
  { label: 'Editor', value: 'Lindiwe Khumalo' },
  { label: 'Pages', value: '184' },
  { label: 'ISSN', value: '1816-0336' },
] as const;

export function YearbookStrip() {
  return (
    <section className="py-24 px-8 md:px-16 bg-bone">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Left: content */}
        <div>
          <div className="mb-5">
            <span className="eyebrow">In print</span>
          </div>
          <h2 className="font-serif text-[clamp(34px,4.4vw,54px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary mb-6">
            <em>Orchids South Africa</em> · 2025 yearbook
          </h2>
          <p className="font-sans text-[18px] leading-[1.65] text-ink mb-8">
            Our annual record of award-winning plants, hybridisation notes, society reports and
            judges&apos; commentary. 184 pages. Available to members or via direct subscription.
          </p>
          <dl className="flex gap-8 mb-8">
            {YEARBOOK_META.map((item) => (
              <div key={item.label}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-1">
                  {item.label}
                </dt>
                <dd className="font-sans text-[16px] text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
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
        {/* Right: image */}
        <div className="relative aspect-[4/5] overflow-hidden">
          <span className="absolute top-4 left-4 z-10 font-mono text-[11px] uppercase tracking-[0.18em] text-primary bg-ivory px-3 py-1.5">
            EST. 1968
          </span>
          <Image
            src="/images/orchid-purple.jpg"
            alt="Orchids South Africa 2025 yearbook"
            fill
            className="object-cover"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
