import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Media Kit',
  description: 'Media resources and press information for the South African Orchid Council.',
};

export default function MediaKitPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Press"
        heading="Media Kit"
        lede="Resources and information for journalists, photographers and media partners."
      />

      <div className="mx-auto max-w-[720px] px-8 py-20 space-y-10">
        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            About SAOC
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            The South African Orchid Council (SAOC) is the national coordinating body for
            affiliated orchid societies across South Africa. Founded in 1968, SAOC promotes
            the cultivation, exhibition, hybridisation, and appreciation of orchids.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Press enquiries
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            For press enquiries, interview requests, or image permissions, please contact us
            at{' '}
            <a
              href="mailto:council@saoc.co.za"
              className="text-ink underline underline-offset-2"
            >
              council@saoc.co.za
            </a>
            .
          </p>
        </section>

        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: June 2026
        </p>
      </div>
    </>
  );
}
