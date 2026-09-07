import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { CTASection } from '@/components/ui/CTASection';
import { SuggestionForm } from '@/components/members/SuggestionForm';

export const metadata: Metadata = {
  title: 'Members Portal',
  description: 'A restricted area for paid-up SAOC members, coming to this site.',
};

export default function MembersPage() {
  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="For paid-up members"
        heading="Members Portal"
        lede="A restricted area for paid-up SAOC members, separate from the public-facing pages on this site."
      />

      <div className="mx-auto max-w-[720px] px-8 py-20 space-y-10">
        <section
          data-placeholder="true"
          className="space-y-3 border border-rule bg-bone px-6 py-5"
        >
          <p className="font-sans text-[14px] leading-relaxed text-ink/80">
            <strong className="font-medium text-ink">Not yet available.</strong> Member login
            and the Members Portal itself have not been built for this site yet. This page will
            be updated once they are.
          </p>
        </section>

        <section className="space-y-4">
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            The Members Portal will be a restricted area for paid-up SAOC members, separate
            from the public-facing pages. It will provide member authentication and account
            management, and a digital library of SAOC Journal issues available only to
            members.
          </p>
          <p className="font-sans text-[16px] leading-relaxed text-ink/80">
            Have a question about the Members Portal, or how to become a paid-up member?{' '}
            <a href="/contact" className="text-ink underline underline-offset-2">
              Contact SAOC
            </a>
            .
          </p>
        </section>

        <section className="space-y-4 border-t border-rule pt-10">
          <div>
            <span className="eyebrow">Help shape it</span>
            <h2 className="mt-3 font-serif text-[22px] font-semibold text-ink">
              Tell us what you&apos;d want from it
            </h2>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink/80">
              The Members Portal is still being planned. If there&apos;s something you&apos;d
              want it to do, let us know below.
            </p>
          </div>
          <SuggestionForm />
        </section>
      </div>

      <CTASection
        eyebrow="In the meantime"
        heading="Get in touch with SAOC"
        body="The Members Portal is on its way. Until it launches, the SAOC Secretary can help with membership questions."
        primaryCta={{ href: '/contact', label: 'Contact SAOC' }}
        secondaryCta={{ href: '/societies', label: 'Find your society' }}
      />
    </>
  );
}
