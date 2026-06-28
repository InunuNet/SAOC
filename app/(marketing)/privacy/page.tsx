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
        <section className="space-y-4">
          <h2 className="font-serif text-[22px] font-medium text-primary">
            Data we collect
          </h2>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            When you use our contact form, we collect your name, email address, and the
            message you submit. This information is used solely to respond to your enquiry
            and is not shared with third parties.
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
            Under South African law (POPIA) you have the right to request access to, or
            deletion of, any personal information we hold about you. To exercise this right,
            contact us at{' '}
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

        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted pt-4 border-t border-rule">
          Last updated: June 2026
        </p>
      </div>
    </>
  );
}
