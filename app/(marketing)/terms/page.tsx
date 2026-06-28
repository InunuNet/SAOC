import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for the South African Orchid Council website.',
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading="Terms of Use"
        lede="Conditions governing use of the South African Orchid Council website."
      />

      <div className="mx-auto max-w-[720px] px-8 py-20 space-y-10">
        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Use of this site
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            This website is operated by the South African Orchid Council (SAOC), a
            non-profit body registered in South Africa (Reg# 1978/004040/08). By accessing
            this site you agree to use it for lawful purposes only.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Content ownership
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            All content on this site — text, images, and data — is the property of SAOC or
            its member societies unless otherwise attributed. You may not reproduce or
            republish content without written permission.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Disclaimer
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Information on this site is provided in good faith and is subject to change.
            SAOC makes no warranties regarding accuracy or completeness of any content.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Contact
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            For questions about these terms, please{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact us
            </Link>
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
