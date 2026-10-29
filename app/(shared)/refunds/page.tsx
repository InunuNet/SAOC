import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalBreadcrumb } from '@/components/legal/LegalBreadcrumb';
import { NosHero } from '@/components/nos/NosHero';
import { DocumentLayout, type DocumentIndexEntry } from '@/components/ui/DocumentLayout';
import { DraftNotice } from '@/components/ui/DraftNotice';
import { RouteHero } from '@/components/ui/RouteHero';
import { ProvisionalFigure } from '@/components/ui/ProvisionalFigure';
import { PROVISIONAL_REFUND_POLICY } from '@/lib/provisional-figures';
import { buildPageMetadata } from '@/lib/seo';
import { requestSite } from '@/lib/request-site';

export const metadata: Metadata = buildPageMetadata({
  title: 'Refund & Cancellation Policy',
  description: 'Refund and cancellation policy for South African Orchid Council ticket sales.',
  path: '/refunds',
});

// The h2 index; each id matches its heading below.
const INDEX: DocumentIndexEntry[] = [
  { id: 'terms-pending-confirmation', label: 'Terms pending confirmation' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'cancellations', label: 'Cancellations' },
  { id: 'admission-tickets', label: 'Admission tickets' },
  { id: 'conference-tickets', label: 'Conference tickets' },
  {
    id: 'workshop-field-trip-and-cocktail-tickets',
    label: 'Workshop, field trip, and cocktail tickets',
  },
  { id: 'vendor-stand-bookings', label: 'Vendor stand bookings' },
  { id: 'exceptional-circumstances', label: 'Exceptional circumstances' },
  { id: 'how-to-request-a-refund-or-cancellation', label: 'How to request a refund or cancellation' },
];

const TITLE = 'Refund & Cancellation Policy';
const LEDE = 'How refunds and cancellations are handled for SAOC ticket purchases.';

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

export default async function RefundsPage() {
  const nos = (await requestSite()) === 'nos';
  return (
    <>
      {nos ? (
        <NosHero route="/refunds" title={TITLE} crumbLabel={TITLE} lede={LEDE} priority />
      ) : (
        <>
          <LegalBreadcrumb label={TITLE} />
          <RouteHero route="/refunds" heading={TITLE} />
        </>
      )}

      <DocumentLayout index={INDEX}>
        <div className="doc-prose">
          <DraftNotice leadIn="Draft pending legal review.">
            This page has been drafted with AI assistance and has not yet been reviewed by a
            qualified legal professional. It does not constitute legal advice and should not be
            relied upon as SAOC&rsquo;s final policy until formal review is complete.
          </DraftNotice>

          <h2 id="terms-pending-confirmation" className="doc-h2">
            Terms pending confirmation
          </h2>
          <p>
            This policy covers <strong className="font-medium text-ink">admission</strong>,{' '}
            <strong className="font-medium text-ink">conference</strong>, and{' '}
            <strong className="font-medium text-ink">workshop, field trip, and cocktail</strong>{' '}
            tickets. The specific windows and percentages below have not yet been confirmed by
            the council — they are SAOC&rsquo;s own estimated, defensible starting figures,
            marked <strong className="font-medium text-ink">provisional</strong> wherever they
            appear, and may still change before final review.
          </p>

          <h2 id="refunds" className="doc-h2">
            Refunds
          </h2>
          <p>
            Where a refund is approved, it will be issued back to the original payment
            method used at checkout, via the payment gateway used to process that purchase.
            Processing time varies by the payment method and gateway used, and any gateway
            fees may be deducted from the refunded amount.
          </p>

          <h2 id="cancellations" className="doc-h2">
            Cancellations
          </h2>
          <p>
            If SAOC cancels an event, workshop, or field trip outright, ticket holders for
            that activity will be offered a{' '}
            <ProvisionalFigure>
              {PROVISIONAL_REFUND_POLICY.organiserCancellationRefundPercent}% refund
            </ProvisionalFigure>{' '}
            of the ticket price, using the contact details supplied at checkout — regardless of
            how close to the event the cancellation is announced.
          </p>
          <p>
            If you wish to cancel a ticket you have purchased, the following tiered schedule
            applies based on how much notice you give before the event start date:
          </p>
          <ul className="list-disc pl-5 space-y-2">
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

          <h2 id="admission-tickets" className="doc-h2">
            Admission tickets
          </h2>
          <p>
            Admission tickets (single-day and weekend passes) are cancelled under the tiered
            schedule set out above, based on notice given before the National Show&rsquo;s
            opening day.
          </p>

          <h2 id="conference-tickets" className="doc-h2">
            Conference tickets
          </h2>
          <p>
            Conference tickets are named-registrant products and follow the same tiered
            cancellation schedule above. As an alternative to cancelling, a conference ticket
            may instead be transferred, free of charge, to another named attendee up to{' '}
            <ProvisionalFigure>
              {daysInWords(PROVISIONAL_REFUND_POLICY.conferenceTransferWindowDays)} days
            </ProvisionalFigure>{' '}
            before the event — contact us to arrange a transfer.
          </p>

          <h2 id="workshop-field-trip-and-cocktail-tickets" className="doc-h2">
            Workshop, field trip, and cocktail tickets
          </h2>
          <p>
            Workshop, field trip, and Sunset Cocktails tickets follow the same tiered
            cancellation schedule above. These tickets draw from a shared, limited-capacity
            pool; cancelling one frees a slot for another guest.
          </p>

          <h2 id="vendor-stand-bookings" className="doc-h2">
            Vendor stand bookings
          </h2>
          <p>
            Vendor stand bookings are a separate product with their own cancellation terms, set
            out in the vendor registration agreement, and are not covered by this policy. See{' '}
            <Link href="/national-show/vendors/apply" className="text-ink underline underline-offset-2">
              vendor registration
            </Link>{' '}
            for details.
          </p>

          <h2 id="exceptional-circumstances" className="doc-h2">
            Exceptional circumstances
          </h2>
          <p>
            Requests relating to medical emergencies, bereavement, or other exceptional
            circumstances will be considered on a case-by-case basis, and SAOC may waive the
            standard cancellation fee at its discretion. Contact us to discuss your situation.
          </p>

          <h2 id="how-to-request-a-refund-or-cancellation" className="doc-h2">
            How to request a refund or cancellation
          </h2>
          <p>
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

          <p className="font-mono text-[11px] tracking-[0.16em] text-muted pt-4 border-t border-rule">
            Last updated: September 2026
          </p>
        </div>
      </DocumentLayout>
    </>
  );
}
