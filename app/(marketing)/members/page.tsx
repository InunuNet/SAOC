import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { RouteHero } from '@/components/ui/RouteHero';
import { buildPageMetadata } from '@/lib/seo';
import { CTASection } from '@/components/ui/CTASection';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { DraftNotice } from '@/components/ui/DraftNotice';
import { SuggestionForm } from '@/components/members/SuggestionForm';

const LEDE =
  'A restricted area for paid-up SAOC members, separate from the public-facing pages on this site.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Members Portal',
  description: 'A restricted area for paid-up SAOC members, coming to this site.',
  lede: LEDE,
  path: '/members',
});

export default function MembersPage() {
  return (
    <>
      <Breadcrumb items={[{ label: 'Members Portal' }]} />
      <RouteHero
        route="/members"
        eyebrow="For paid-up members"
        heading="Members Portal"
        lede={LEDE}
      />

      <DocumentLayout
        aside={
          <p className="font-sans text-[16px] leading-[1.55] text-ink/80">
            Have a question about the Members Portal, or how to become a paid-up member?{' '}
            <Link href="/contact" className="text-ink underline underline-offset-2">
              Contact SAOC
            </Link>
            .
          </p>
        }
      >
        <section className="doc-section">
          <div className="doc-prose">
            <DraftNotice leadIn="Not yet available." placeholder>
              Member login and the Members Portal itself have not been built for this site yet.
              This page will be updated once they are.
            </DraftNotice>
            <p>
              The Members Portal will be a restricted area for paid-up SAOC members, separate from
              the public-facing pages. It will provide member authentication and account
              management, and a digital library of SAOC Journal issues available only to members.
            </p>
          </div>
        </section>

        <section className="doc-section">
          <h2 className="doc-h2">Tell us what you&apos;d want from it</h2>
          <div className="doc-prose">
            <p>
              The Members Portal is still being planned. If there&apos;s something you&apos;d want
              it to do, let us know below.
            </p>
          </div>
          <div className="mt-8">
            <SuggestionForm />
          </div>
        </section>
      </DocumentLayout>

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
