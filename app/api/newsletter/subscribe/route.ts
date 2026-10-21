import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { generateUnsubscribeToken } from '@/lib/newsletter';
import {
  handleNewsletterSubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  type NewsletterHandlerResult,
} from '@/lib/newsletter-handler';
import { createAttemptStore, rateLimitKeyFromHeaders } from '@/lib/newsletter-rate-store';
import { subscriberRef, toSubscriberDoc } from '@/lib/newsletter-store';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const HTTP_SERVER_ERROR = 500;

const attempts = createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/subscribe] ${message}`, context);
}

function toResponse(result: NewsletterHandlerResult): NextResponse {
  const headers: Record<string, string> = {};
  if (result.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const rateLimitKey = rateLimitKeyFromHeaders(request.headers, 'newsletter-subscribe');

  try {
    initAdmin();
    // The read-decide-write runs inside one transaction so two concurrent submits of the same
    // address cannot both create a document with a different unsubscribe token.
    const result = await getFirestore().runTransaction((tx) =>
      handleNewsletterSubscribe(
        { body, rateLimitKey },
        {
          now: new Date(),
          getPriorAttempts: attempts.getPriorAttempts,
          recordAttempt: attempts.recordAttempt,
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
    return toResponse(result);
  } catch (error) {
    logError('transaction failed', {
      operation: 'subscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: HTTP_SERVER_ERROR });
  }
}
