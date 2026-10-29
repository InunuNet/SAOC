import type { Metadata } from 'next';
import { CircleAlert } from 'lucide-react';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { NosHero } from '@/components/nos/NosHero';
import { UnsubscribeConfirm } from '@/components/newsletter/UnsubscribeConfirm';
import { isWellFormedUnsubscribeToken } from '@/lib/newsletter';
import { requestSite } from '@/lib/request-site';

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
  const isNos = (await requestSite()) === 'nos';

  return (
    <main id="main-content">
      {isNos ? (
        <NosHero
          route="/newsletter/unsubscribe"
          title={NEWSLETTER_COPY.unsubscribeHeading}
          eyebrow="Legal"
          priority
        />
      ) : null}
      <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-8 sm:py-24">
        {isNos ? null : (
          <h1 className="font-serif tracking-[-0.015em] font-normal min-[640px]:font-light text-[28px] leading-tight text-ink sm:text-[34px]">
            {NEWSLETTER_COPY.unsubscribeHeading}
          </h1>
        )}
        <div className={isNos ? undefined : 'mt-8'}>
          {valid ? (
            <UnsubscribeConfirm token={token} />
          ) : (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-sm border-2 border-[var(--status-error)] px-4 py-3 font-sans text-[16px] leading-[1.55] font-medium text-[var(--status-error)]"
            >
              <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
              <span>{NEWSLETTER_COPY.unsubscribeInvalid}</span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
