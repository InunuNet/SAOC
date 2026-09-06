import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Constitution',
  description: 'The Constitution of the South African Orchid Council.',
};

export default function ConstitutionPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Governance"
        heading="Constitution"
        lede="The founding document governing the South African Orchid Council."
      />

      <div className="mx-auto max-w-[720px] px-8 py-20 space-y-10">
        <section
          data-placeholder="true"
          className="space-y-3 border border-rule bg-bone px-6 py-5"
        >
          <p className="font-sans text-[14px] leading-relaxed text-ink/80">
            <strong className="font-medium text-ink">Not yet published.</strong> The
            Constitution text itself has not been supplied for this site. This page will be
            updated with the full document once it is received from the Council.
          </p>
        </section>

        <section className="space-y-4">
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            The SAOC Constitution sets out the objects, membership structure, governance, and
            rules of the South African Orchid Council. A full copy is available on request from
            the Secretary, and will be published on this page once supplied.
          </p>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            To request a copy, please{' '}
            <a
              href="mailto:secretary@saoc.co.za"
              className="text-ink underline underline-offset-2"
            >
              contact the Secretary
            </a>
            .
          </p>
        </section>

        <p className="font-mono text-[11px] tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: June 2026
        </p>
      </div>
    </>
  );
}
