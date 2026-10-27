import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { initAdmin } from '@/lib/firebase-admin';
import { generateUnsubscribeToken } from '@/lib/newsletter';
import {
  handleNewsletterSubscribe,
  NEWSLETTER_MIN_SUCCESS_RESPONSE_MS,
} from '@/lib/newsletter-handler';
import { padToFloor, toNewsletterResponse } from '@/lib/newsletter-http';
import { scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import { sharedNewsletterAttempts, sharedNewsletterRateLimitKey } from '@/lib/newsletter-rate-shared';
import { subscriberRef, toSubscriberDoc } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;
const HTTP_OK = 200;

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/subscribe] ${message}`, context);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const rateLimitKey = sharedNewsletterRateLimitKey(request);

  const startedAt = Date.now();
  const requestAttempts = scopeAttemptsToRequest(sharedNewsletterAttempts());
  try {
    initAdmin();
    // The read-decide-write runs inside one transaction so two concurrent submits of the same
    // address cannot both create a document with a different unsubscribe token.
    const result = await getFirestore().runTransaction((tx) =>
      handleNewsletterSubscribe(
        { body, rateLimitKey },
        {
          now: new Date(),
          getPriorAttempts: requestAttempts.getPriorAttempts,
          recordAttempt: requestAttempts.recordAttempt,
          getSubscriber: async (id) => {
            const snapshot = await tx.get(subscriberRef(id));
            return snapshot.exists ? toSubscriberDoc(snapshot.data() ?? {}) : null;
          },
          writeSubscriber: async (id, doc) => {
            tx.set(subscriberRef(id), doc);
          },
          generateToken: generateUnsubscribeToken,
          logError,
        },
      ),
    );
    if (result.status === HTTP_OK) await padToFloor(startedAt, NEWSLETTER_MIN_SUCCESS_RESPONSE_MS);
    return toNewsletterResponse(result);
  } catch (error) {
    logError('transaction failed', {
      operation: 'subscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
