import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Media Kit',
  description: 'Media resources and press information for the South African Orchid Council.',
};

const QUICK_FACTS = [
  { value: '21', label: 'Affiliated Societies' },
  { value: '1968', label: 'Founding Year' },
  { value: '18', label: 'National Shows Hosted' },
  { value: '56', label: 'Accredited Judges' },
] as const;

interface LogoAsset {
  name: string;
  description: string;
  href: string;
  preview: string;
  format: string;
}

const LOGO_ASSETS: LogoAsset[] = [
  {
    name: 'Emblem — Eulophia speciosa',
    description: 'The SAOC mark on its own, transparent background.',
    href: '/downloads/media-kit/saoc-emblem.png',
    preview: '/downloads/media-kit/saoc-emblem.png',
    format: 'PNG · 1254×1254 · transparent',
  },
  {
    name: 'Full lockup — ink',
    description: 'Emblem and wordmark, for light backgrounds.',
    href: '/images/saoc-logo-ink-paper.png',
    preview: '/images/saoc-logo-ink-paper.png',
    format: 'PNG · 767×700 · transparent',
  },
  {
    name: 'Full lockup — sage',
    description: 'Emblem and wordmark in the primary brand colour.',
    href: '/images/saoc-logo-sage-paper.png',
    preview: '/images/saoc-logo-sage-paper.png',
    format: 'PNG · 767×700 · transparent',
  },
  {
    name: 'Full lockup — flat',
    description: 'Single-colour emblem and wordmark, for one-colour print.',
    href: '/images/saoc-logo-flat-paper.png',
    preview: '/images/saoc-logo-flat-paper.png',
    format: 'PNG · 767×700 · transparent',
  },
];

export default function MediaKitPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Press"
        heading="Media Kit"
        lede="Resources and information for journalists, photographers and media partners."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        {/* Quick facts */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Quick facts
          </p>
          <dl className="grid grid-cols-2 gap-8 border-y border-rule py-10 sm:grid-cols-4">
            {QUICK_FACTS.map((stat) => (
              <div key={stat.label}>
                <dt className="font-serif text-[32px] font-medium text-ink">{stat.value}</dt>
                <dd className="mt-1 font-mono text-[11px] tracking-[0.16em] text-muted">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* About SAOC */}
        <section className="max-w-[720px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            About SAOC
          </p>
          <p className="font-serif text-[20px] leading-relaxed text-ink">
            The South African Orchid Council (SAOC) is the national coordinating body for
            affiliated orchid societies across South Africa.
          </p>
          <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink/80">
            Founded in 1968, SAOC exists to promote the culture, hybridisation and appreciation
            of orchids in cultivation — through a federated network of 21 societies, a nationally
            accredited judging system first standardised in 1990, and our annual publication{' '}
            <em>Orchids South Africa</em>. Our remit is orchids in cultivation: the show bench,
            the greenhouse, and the community. For indigenous species in the wild, our sibling
            organisation Wild Orchids of Southern Africa leads that work.
          </p>
        </section>

        {/* Brand assets */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Brand assets
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {LOGO_ASSETS.map((asset) => (
              <div key={asset.href} className="border border-rule bg-parchment p-6 flex flex-col">
                <div className="relative aspect-square bg-bone">
                  <Image
                    src={asset.preview}
                    alt={`${asset.name} preview`}
                    fill
                    className="object-contain p-4"
                    sizes="(min-width: 1024px) 25vw, 50vw"
                  />
                </div>
                <h3 className="mt-4 font-serif text-[16px] font-medium text-ink">{asset.name}</h3>
                <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink/70 flex-1">
                  {asset.description}
                </p>
                <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                  {asset.format}
                </p>
                <a
                  href={asset.href}
                  download
                  className="mt-4 inline-block text-ink underline underline-offset-2 font-sans text-[14px]"
                >
                  Download →
                </a>
              </div>
            ))}
          </div>
          <p className="mt-6 font-sans text-[13px] leading-relaxed text-ink/60 max-w-[600px]">
            Vector masters (SVG/EPS) are not yet available — the PNG files above are print-usable
            at their native resolution. Contact us if you need a size or format not listed here.
          </p>
        </section>

        {/* Press contact */}
        <section className="max-w-[720px] border-t border-rule pt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Press enquiries
          </p>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            For press enquiries, interview requests, or image permissions, email us at{' '}
            <a
              href="mailto:info@saoc.co.za"
              className="text-ink underline underline-offset-2"
            >
              info@saoc.co.za
            </a>{' '}
            or use our{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact form
            </Link>
            .
          </p>
        </section>

        <p className="font-mono text-[11px] tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: September 2026
        </p>
      </div>
    </>
  );
}
