import type { Metadata } from 'next';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { UnsubscribeConfirm } from '@/components/newsletter/UnsubscribeConfirm';
import { isWellFormedUnsubscribeToken } from '@/lib/newsletter';

// The token is a bearer credential in the URL: keep the page out of search indexes and stop the
// browser sending it onward in a Referer header.
export const metadata: Metadata = {
  title: NEWSLETTER_COPY.unsubscribeHeading,
  robots: 'noindex, nofollow',
  referrer: 'no-referrer',
};

// GET performs no Firestore read or write; the confirm button POSTs the token to the API.
export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const valid = isWellFormedUnsubscribeToken(token);

  return (
    <main id="main-content">
      <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-8 sm:py-24">
        <h1 className="font-serif text-[28px] font-semibold leading-tight text-ink sm:text-[34px]">
          {NEWSLETTER_COPY.unsubscribeHeading}
        </h1>
        <div className="mt-8">
          {valid ? (
            <UnsubscribeConfirm token={token} />
          ) : (
            <p role="alert" className="font-sans text-[16px] leading-[1.55] text-ink">
              {NEWSLETTER_COPY.unsubscribeInvalid}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
