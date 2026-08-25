import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for the South African Orchid Council website.',
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-violet.jpg"
        eyebrow="Legal"
        heading="Privacy Policy"
        lede="How the South African Orchid Council handles your information."
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
            Data we collect
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            We collect personal information directly from you in the following situations:
          </p>
          <ul className="list-disc pl-5 space-y-2 font-sans text-[16px] leading-relaxed text-ink/80">
            <li>
              <strong className="font-medium text-ink">Contact form</strong> — your name, email
              address, and the message you submit.
            </li>
            <li>
              <strong className="font-medium text-ink">Ticket checkout</strong> — your name,
              email address, and phone number, and, where the checkout form asks for them, your
              country, province, and town, so that tickets and door access can be issued and
              administered.
            </li>
            <li>
              <strong className="font-medium text-ink">Vendor applications</strong> — business
              and contact details (business name, contact person, phone and email), and where
              applicable, regulatory information such as CIPC and VAT numbers and product
              permits, submitted by prospective national show exhibitors.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Who we share it with
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            We do not sell personal information. We do share specific information with the
            following service providers, only as needed to run the site and fulfil your
            request:
          </p>
          <ul className="list-disc pl-5 space-y-2 font-sans text-[16px] leading-relaxed text-ink/80">
            <li>
              <strong className="font-medium text-ink">Our payment gateway</strong> — currently
              PayFast (sandbox), and, should the council change provider, whichever gateway is
              in live use at the time — receives buyer and payment details solely to process
              ticket payments.
            </li>
            <li>
              <strong className="font-medium text-ink">Resend</strong> — sends transactional
              email on our behalf, such as order confirmations and contact-form acknowledgements.
            </li>
            <li>
              <strong className="font-medium text-ink">Firebase and Google Cloud</strong> —
              Firestore stores contact submissions, ticket orders, and vendor applications;
              Firebase Auth secures the SAOC admin area; Firebase (Cloud) Storage holds
              documents vendors upload as proof of payment, such as EFT screenshots and
              receipts.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            How long we keep it
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            We retain personal information for as long as needed to fulfil the purpose it was
            collected for — such as issuing and honouring a ticket, or processing a vendor
            application — and for as long afterwards as is required to meet our legal,
            accounting, or record-keeping obligations. Information no longer needed for these
            purposes is deleted or anonymised.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Cookies and analytics
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            This site does not currently use tracking cookies or third-party analytics. If
            this changes, this page will be updated to reflect it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Your rights
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Under South African law (POPIA) you have the right to request access to, correction
            of, or deletion of any personal information we hold about you.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Information Officer
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            SAOC&rsquo;s Information Officer can be reached to exercise any of the rights above,
            or with any question about this policy, at{' '}
            <a
              href="mailto:secretary@saoc.co.za"
              className="text-ink underline underline-offset-2"
            >
              secretary@saoc.co.za
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Complaints — the Information Regulator
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            If you believe we have not handled your personal information in line with POPIA,
            you may lodge a complaint with us using the details above, or directly with South
            Africa&rsquo;s Information Regulator at{' '}
            <a
              href="https://inforegulator.org.za"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2"
            >
              inforegulator.org.za
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Questions
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            If you have any questions about this policy, please{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              contact us
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
