import type { Metadata } from 'next';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { UnsubscribeByEmailForm } from '@/components/newsletter/UnsubscribeByEmailForm';
import { NosHero } from '@/components/nos/NosHero';
import { PageHero } from '@/components/ui/PageHero';
import { requestSite } from '@/lib/request-site';

// The legal pages' hero eyebrow: this page sits in the same family as privacy, terms and refunds.
const HERO_EYEBROW = 'Legal';
const HERO_IMAGE = '/images/orchid-violet.jpg';

export const metadata: Metadata = {
  title: NEWSLETTER_COPY.unsubPageHeading,
  robots: 'noindex, nofollow',
};

// Unauthenticated by design: anyone may submit an address. The worst case is an unwanted
// unsubscribe, which the person reverses by subscribing again from the footer. The page itself
// reads and writes nothing; the POST route removes only the topic of the host this page is on.
export default async function UnsubscribePage() {
  const site = await requestSite();

  return (
    <>
      {site === 'nos' ? (
        // The NOS legal hero: /newsletter/unsubscribe is the route that owns crop S2a.
        <NosHero
          route="/newsletter/unsubscribe"
          title={NEWSLETTER_COPY.unsubPageHeading}
          eyebrow={HERO_EYEBROW}
          priority
        />
      ) : (
        <PageHero image={HERO_IMAGE} eyebrow={HERO_EYEBROW} heading={NEWSLETTER_COPY.unsubPageHeading} />
      )}
      <div className="mx-auto max-w-[560px] px-4 pb-16 pt-16 sm:px-8 sm:pb-24">
        <UnsubscribeByEmailForm site={site} />
        <p className="mt-10 font-sans text-[14px] leading-[1.55] text-muted">
          {NEWSLETTER_COPY.unsubPageFootnote}
        </p>
      </div>
    </>
  );
}
