import type { Metadata } from 'next';
import Link from 'next/link';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { PreferencesForm } from '@/components/newsletter/PreferencesForm';
import { NosHero } from '@/components/nos/NosHero';
import { isWellFormedUnsubscribeToken, NEWSLETTER_TOPICS } from '@/lib/newsletter';
import { maskEmailForDisplay } from '@/lib/newsletter-preferences';
import { findSubscriberByToken } from '@/lib/newsletter-store';
import { requestSite } from '@/lib/request-site';

// The token is a bearer credential in the URL: keep the page out of search indexes and stop the
// browser sending it onward in a Referer header.
export const metadata: Metadata = {
  title: NEWSLETTER_COPY.prefsHeading,
  robots: 'noindex, nofollow',
  referrer: 'no-referrer',
};

const CONTACT_HREF = '/contact';

const H1_CLASS =
  'font-serif tracking-[-0.015em] font-normal min-[640px]:font-light text-[28px] leading-tight text-ink sm:text-[34px]';

// GET reads the subscriber and changes nothing: a mail scanner or link prefetcher that opens the
// link must never alter a subscription. Every change is a POST to /api/newsletter/preferences.
export default async function NewsletterPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  // Malformed and unknown tokens take the same branch, so the page never says which addresses exist.
  const subscriber = isWellFormedUnsubscribeToken(token) ? await findSubscriberByToken(token) : null;
  const site = await requestSite();
  const isNos = site === 'nos';

  return (
    <main id="main-content">
      {isNos ? (
        <NosHero
          route="/newsletter/unsubscribe"
          title={NEWSLETTER_COPY.prefsHeading}
          eyebrow="Legal"
          priority
        />
      ) : null}
      <div className="mx-auto max-w-[560px] px-4 py-16 sm:px-8 sm:py-24">
        {isNos ? null : (
          <h1 className={H1_CLASS}>
            {NEWSLETTER_COPY.prefsHeading}
          </h1>
        )}
        {subscriber === null || !isWellFormedUnsubscribeToken(token) ? (
          <div className={isNos ? undefined : 'mt-8'}>
            <p role="alert" className="font-sans text-[16px] leading-[1.55] text-ink">
              {NEWSLETTER_COPY.prefsTokenError}
            </p>
            <p className="mt-4">
              <Link
                href={CONTACT_HREF}
                className="inline-flex min-h-11 items-center font-sans text-[14px] text-ink underline underline-offset-4 hover:text-primary"
              >
                {NEWSLETTER_COPY.prefsContactLink}
              </Link>
            </p>
          </div>
        ) : (
          <div className={isNos ? undefined : 'mt-4'}>
            <PreferencesForm
              token={token}
              site={site}
              maskedEmail={maskEmailForDisplay(subscriber.email)}
              allRemoved={subscriber.status === 'unsubscribed'}
              topics={subscriber.topics}
              available={NEWSLETTER_TOPICS.filter((topic) =>
                [...subscriber.topics, ...subscriber.previousTopics, ...subscriber.restoreTopics].includes(topic))}
            />
          </div>
        )}
      </div>
    </main>
  );
}
