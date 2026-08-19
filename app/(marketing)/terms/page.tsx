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
        lede="Conditions governing use of the South African Orchid Council website and the purchase of tickets through it."
      />

      <div className="mx-auto max-w-[720px] px-8 py-20 space-y-10">
        <section className="space-y-3 border border-rule bg-primary/5 px-6 py-5">
          <p className="font-sans text-[14px] leading-relaxed text-ink/80">
            <strong className="font-medium text-ink">Draft pending legal review.</strong> This
            page has been drafted with AI assistance and has not yet been reviewed by a
            qualified legal professional. It does not constitute legal advice and should not be
            relied upon as SAOC&rsquo;s final policy until formal review is complete.
          </p>
        </section>

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
            Conditions of sale — tickets and admission
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            These conditions of sale apply whenever you buy a ticket or book admission to a
            SAOC event, including the National Show, through this website.
          </p>
          <ul className="list-disc pl-5 space-y-2 font-sans text-[16px] leading-relaxed text-ink/80">
            <li>
              A ticket purchase is a contract between you and SAOC for admission to the named
              event, subject to these terms and the specific conditions listed on that
              ticket&rsquo;s listing.
            </li>
            <li>
              Tickets are issued to the name and details supplied at checkout and may be
              checked against identification at the door.
            </li>
            <li>
              <strong className="font-medium text-ink">Sunset Cocktails is an 18+ event.</strong>{' '}
              Admission to Sunset Cocktails is restricted to attendees aged 18 and older;
              proof of age may be requested at the door.
            </li>
            <li>
              Workshops and field trips have{' '}
              <strong className="font-medium text-ink">limited capacity</strong>. Booking a
              ticket does not guarantee a place if a workshop or field trip is oversubscribed;
              capacity is allocated as described on that activity&rsquo;s listing.
            </li>
            <li>
              Refunds and cancellations for ticket purchases are governed by our{' '}
              <Link href="/refunds" className="text-ink underline underline-offset-2">
                Refund &amp; Cancellation Policy
              </Link>
              .
            </li>
          </ul>
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
          Last updated: August 2026
        </p>
      </div>
    </>
  );
}
