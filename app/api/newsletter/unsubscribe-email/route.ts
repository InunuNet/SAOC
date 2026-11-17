import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { initAdmin } from '@/lib/firebase-admin';
import {
  handleNewsletterUnsubscribeByEmail,
  NEWSLETTER_MIN_SUCCESS_RESPONSE_MS,
} from '@/lib/newsletter-handler';
import { padToFloor, toNewsletterResponse } from '@/lib/newsletter-http';
import { scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import { sharedNewsletterAttempts, sharedNewsletterRateLimitKey } from '@/lib/newsletter-rate-shared';
import { newsletterTx, removeSubscriberTopics } from '@/lib/newsletter-store';
import { requestSite } from '@/lib/request-site';

const HTTP_SERVER_ERROR = 500;
const HTTP_OK = 200;

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/unsubscribe-email] ${message}`, context);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const startedAt = Date.now();

  try {
    initAdmin();
    // Which newsletter to leave comes from the host the form was served on, never from the body.
    const site = await requestSite();
    const requestAttempts = scopeAttemptsToRequest(sharedNewsletterAttempts());
    const rateLimitKey = sharedNewsletterRateLimitKey(request);
    const result = await getFirestore().runTransaction((tx) => {
      const ntx = newsletterTx(tx);
      return handleNewsletterUnsubscribeByEmail(
        { body, site, rateLimitKey },
        {
          now: new Date(),
          getPriorAttempts: requestAttempts.getPriorAttempts,
          recordAttempt: requestAttempts.recordAttempt,
          removeTopicByEmailId: (id, topic, now) =>
            removeSubscriberTopics(id, [topic], { via: 'self-service-form', by: null, now }, ntx),
          logError,
        },
      );
    });
    // Subscribed, unknown, already-unsubscribed and honeypot answers all wait out the same floor.
    if (result.status === HTTP_OK) await padToFloor(startedAt, NEWSLETTER_MIN_SUCCESS_RESPONSE_MS);
    return toNewsletterResponse(result);
  } catch (error) {
    logError('unexpected failure', {
      operation: 'unsubscribe-email',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
