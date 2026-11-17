import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import {
  handleNewsletterPreferences,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
} from '@/lib/newsletter-handler';
import { toNewsletterResponse } from '@/lib/newsletter-http';
import {
  createAttemptStore,
  scopeAttemptsToRequest,
} from '@/lib/newsletter-rate-store';
import {
  addSubscriberTopics,
  findSubscriberByToken,
  newsletterTx,
  removeSubscriberTopics,
  restoreSubscriber,
} from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;

const attempts = createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/preferences] ${message}`, context);
}

function rateLimitKeyFor(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-preferences:${ip ?? 'unknown'}`;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    initAdmin();
    const requestAttempts = scopeAttemptsToRequest(attempts);
    const rateLimitKey = rateLimitKeyFor(request);
    // The lookup and every change to the address share one transaction: the bearer link is read
    // once and each patch is layered over that read (see NewsletterTx).
    const result = await getFirestore().runTransaction((tx) => {
      const ntx = newsletterTx(tx);
      return handleNewsletterPreferences(
        { body, rateLimitKey },
        {
          now: new Date(),
          getPriorAttempts: requestAttempts.getPriorAttempts,
          recordAttempt: requestAttempts.recordAttempt,
          findByToken: (token) => findSubscriberByToken(token, ntx),
          removeTopics: (id, topics, now) =>
            removeSubscriberTopics(id, topics, { via: 'link', by: null, now }, ntx),
          addTopics: (id, topics) => addSubscriberTopics(id, topics, ntx),
          restore: (id) => restoreSubscriber(id, ntx),
          logError,
        },
      );
    });
    return toNewsletterResponse(result);
  } catch (error) {
    logError('unexpected failure', {
      operation: 'preferences',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
