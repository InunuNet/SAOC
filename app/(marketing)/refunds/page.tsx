import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Refund and cancellation policy for South African Orchid Council ticket sales.',
};

export default function RefundsPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading="Refund & Cancellation Policy"
        lede="How refunds and cancellations are handled for SAOC ticket purchases."
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
            Terms pending confirmation
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            SAOC intends to offer refunds and cancellations under clearly stated conditions.
            The specific refund windows, cancellation deadlines, and any amounts or
            percentages that apply have not yet been confirmed by the council — this page will
            be updated with those specifics as soon as they are finalised. Until then, please
            contact us before assuming a purchase can or cannot be refunded.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Refunds
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Where a refund is approved, it will be issued back to the original payment
            method used at checkout, via the payment gateway used to process that purchase.
            The circumstances in which a refund is offered — and any timing or eligibility
            conditions that apply — are among the details the council has not yet confirmed;
            see &ldquo;Terms pending confirmation&rdquo; above.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Cancellations
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            If SAOC cancels an event, workshop, or field trip outright, ticket holders for
            that activity will be notified using the contact details supplied at checkout and
            offered an appropriate resolution. If you wish to cancel a ticket you have
            purchased, contact us as soon as possible — cancellation deadlines and any
            associated conditions are, again, pending council confirmation.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Exceptional circumstances
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Requests relating to medical emergencies, bereavement, or other exceptional
            circumstances will be considered on a case-by-case basis. Contact us to discuss
            your situation.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            How to request a refund or cancellation
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            To request a refund or cancellation, or to ask a question about an existing
            booking, please{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact us
            </Link>{' '}
            with your order details. Related conditions of sale are set out in our{' '}
            <Link href="/terms" className="text-ink underline underline-offset-2">
              Terms of Use
            </Link>
            , and details of how we handle your information appear in our{' '}
            <Link href="/privacy" className="text-ink underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <p className="font-mono text-[11px] tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: August 2026
        </p>
      </div>
    </>
  );
}
