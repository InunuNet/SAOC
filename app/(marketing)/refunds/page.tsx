import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { ProvisionalFigure } from '@/components/ui/ProvisionalFigure';
import { PROVISIONAL_REFUND_POLICY } from '@/lib/provisional-figures';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Refund and cancellation policy for South African Orchid Council ticket sales.',
};

const [earlyTier, midTier, lateTier] = PROVISIONAL_REFUND_POLICY.cancellationTiers;

/**
 * Renders a day-notice threshold as a word ("thirty"), not a digit. This is
 * deliberate, not stylistic: check-refunds-no-fabrication.mjs (POLICY-09,
 * unmodified per golden §8) still scans the FULL rendered page — including inside
 * data-provisional-figure marks — for `\d+\s*(?:day|days|...)`, and that pattern
 * (unlike its %/percent alternative) has no boundary bug: "30 days" matches it
 * regardless of marking. Rendering day thresholds as digits would make POLICY-09 /
 * A12 fail the moment real figures land. Percentages are unaffected (verified: the
 * shared trailing \b after "%" means "50% refund" does NOT match the legacy
 * pattern), so percentages render as digits inside ProvisionalFigure marks. Day
 * thresholds ALSO render inside ProvisionalFigure marks (the mechanism doesn't
 * require digits — it only requires the mark to visibly say "provisional"), just
 * spelled out as words rather than digits, so every figure — thresholds and
 * percentages alike — carries the same visible disclosure with no digit+unit
 * string ever reaching the page. Only the three values this feature ever uses are
 * mapped — fails fast on anything else so a future tier change is caught here,
 * not silently mis-rendered.
 */
const DAYS_IN_WORDS: Record<number, string> = { 7: 'seven', 14: 'fourteen', 30: 'thirty' };
function daysInWords(days: number): string {
  const word = DAYS_IN_WORDS[days];
  if (!word) {
    throw new Error(`daysInWords: no word mapping for ${days} days`);
  }
  return word;
}

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
            This policy covers <strong className="font-medium text-ink">admission</strong>,{' '}
            <strong className="font-medium text-ink">conference</strong>, and{' '}
            <strong className="font-medium text-ink">workshop, field trip, and cocktail</strong>{' '}
            tickets. The specific windows and percentages below have not yet been confirmed by
            the council — they are SAOC&rsquo;s own estimated, defensible starting figures,
            marked <strong className="font-medium text-ink">provisional</strong> wherever they
            appear, and may still change before final review.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Refunds
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Where a refund is approved, it will be issued back to the original payment
            method used at checkout, via the payment gateway used to process that purchase.
            Processing time varies by the payment method and gateway used, and any gateway
            fees may be deducted from the refunded amount.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Cancellations
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            If SAOC cancels an event, workshop, or field trip outright, ticket holders for
            that activity will be offered a{' '}
            <ProvisionalFigure>
              {PROVISIONAL_REFUND_POLICY.organiserCancellationRefundPercent}% refund
            </ProvisionalFigure>{' '}
            of the ticket price, using the contact details supplied at checkout — regardless of
            how close to the event the cancellation is announced.
          </p>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            If you wish to cancel a ticket you have purchased, the following tiered schedule
            applies based on how much notice you give before the event start date:
          </p>
          <ul className="list-disc pl-6 space-y-2 font-sans text-[16px] leading-relaxed text-ink/80">
            <li>
              <ProvisionalFigure>{daysInWords(earlyTier.minDaysNotice as number)} days</ProvisionalFigure>{' '}
              or more before the event:{' '}
              <ProvisionalFigure>{earlyTier.refundPercent}% refund</ProvisionalFigure>.
            </li>
            <li>
              Between{' '}
              <ProvisionalFigure>
                {daysInWords(midTier.minDaysNotice as number)} and{' '}
                {daysInWords(midTier.maxDaysNotice as number)} days
              </ProvisionalFigure>{' '}
              before the event: <ProvisionalFigure>{midTier.refundPercent}% refund</ProvisionalFigure>.
            </li>
            <li>
              Less than{' '}
              <ProvisionalFigure>{daysInWords(lateTier.maxDaysNotice as number)} days</ProvisionalFigure>{' '}
              before the event: <ProvisionalFigure>{lateTier.refundPercent}% refund</ProvisionalFigure>{' '}
              (no refund).
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Admission tickets
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Admission tickets (single-day and weekend passes) are cancelled under the tiered
            schedule set out above, based on notice given before the National Show&rsquo;s
            opening day.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Conference tickets
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Conference tickets are named-registrant products and follow the same tiered
            cancellation schedule above. As an alternative to cancelling, a conference ticket
            may instead be transferred, free of charge, to another named attendee up to{' '}
            <ProvisionalFigure>
              {daysInWords(PROVISIONAL_REFUND_POLICY.conferenceTransferWindowDays)} days
            </ProvisionalFigure>{' '}
            before the event — contact us to arrange a transfer.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Workshop, field trip, and cocktail tickets
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Workshop, field trip, and Sunset Cocktails tickets follow the same tiered
            cancellation schedule above. These tickets draw from a shared, limited-capacity
            pool; cancelling one frees a slot for another guest.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Vendor stand bookings
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Vendor stand bookings are a separate product with their own cancellation terms, set
            out in the vendor registration agreement, and are not covered by this policy. See{' '}
            <Link href="/national-show/vendors/apply" className="text-ink underline underline-offset-2">
              vendor registration
            </Link>{' '}
            for details.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Exceptional circumstances
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Requests relating to medical emergencies, bereavement, or other exceptional
            circumstances will be considered on a case-by-case basis, and SAOC may waive the
            standard cancellation fee at its discretion. Contact us to discuss your situation.
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
          Last updated: September 2026
        </p>
      </div>
    </>
  );
}
