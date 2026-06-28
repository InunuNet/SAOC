import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Exhibitor Information — 19th National Orchid Show',
  description:
    'Information for exhibitors entering the 19th South African National Orchid Show, Cape Town, September 2027.',
};

const INFO_BLOCKS = [
  {
    heading: 'Who can exhibit',
    body: 'Any member of an SAOC-affiliated society may enter plants in the competitive show. Non-competitive display space is available to affiliated societies by arrangement.',
  },
  {
    heading: 'Entry categories',
    body: 'Plants are judged against SAOC standards in genus-based classes. Grand Champion and Reserve Champion trophies are awarded from the class winners. Full category list will be published six months before the show.',
  },
  {
    heading: 'Setup and staging',
    body: 'Exhibitors may stage plants on the Thursday and Friday before opening. The show runs Friday evening through Sunday afternoon. Exact times are confirmed closer to the event.',
  },
  {
    heading: 'Judging',
    body: 'All judging is conducted by SAOC-accredited judges. Plants are assessed on flower quality, cultural merit, presentation, and labelling. See our judging page for the full standards.',
  },
];

export default function ExhibitorInfoPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-20">
        <Image
          src="/images/orchid-purple.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-20"
          sizes="100vw"
        />
        <div className="relative z-10 mx-auto max-w-[1280px] px-8">
          <Link
            href="/national-show"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60 hover:text-ivory transition-colors duration-150 mb-8"
          >
            ← Show overview
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-3">
            19th National Orchid Show · Cape Town 2027
          </p>
          <h1 className="font-serif text-[clamp(36px,4.8vw,60px)] font-medium leading-[1.06] tracking-[-0.012em] text-ivory max-w-[20ch]">
            Exhibitor Information
          </h1>
          <p className="mt-5 font-sans text-[17px] text-ivory/70 max-w-2xl">
            Everything you need to enter your plants in the 19th South African National
            Orchid Show.
          </p>
        </div>
      </section>

      {/* Info grid */}
      <section className="mx-auto max-w-[1280px] px-8 py-20">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          {INFO_BLOCKS.map((block) => (
            <div key={block.heading} className="border-t border-rule pt-8">
              <h2 className="font-serif text-[22px] font-medium text-primary mb-3">
                {block.heading}
              </h2>
              <p className="font-sans text-[16px] leading-relaxed text-ink/80">{block.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coming soon + CTA */}
      <section className="bg-bone py-16 border-t border-rule">
        <div className="mx-auto max-w-[1280px] px-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-3">
            Full details coming 2026
          </p>
          <h2 className="font-serif text-[clamp(24px,3vw,36px)] font-medium text-ink mb-4">
            Entry forms, rules, and schedules
          </h2>
          <p className="mx-auto max-w-xl font-sans text-[16px] leading-relaxed text-ink/70 mb-8">
            Complete exhibitor rules, entry forms, and staging schedules will be published
            here in 2026. In the meantime, contact us with any questions.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="font-sans text-[14px] font-medium bg-primary px-6 py-3 text-ivory transition-colors duration-150 hover:bg-primary/85"
            >
              Contact Us
            </Link>
            <Link
              href="/judging"
              className="font-sans text-[14px] font-medium border border-ink/30 px-6 py-3 text-ink transition-colors duration-150 hover:bg-ink/5"
            >
              Judging Standards
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
