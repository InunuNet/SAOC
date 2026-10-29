import { NextRequest, NextResponse } from 'next/server';
import { isBodyWithinLimit } from '@/lib/request-guards';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import {
  AbuseLimiterUnavailableError,
  clientActorKey,
  consumeAbuseLimit,
  type AbuseLimitDecision,
} from '@/lib/abuse-limiter';
import { initAdmin } from '@/lib/firebase-admin';
import { generateUnsubscribeToken } from '@/lib/newsletter';
import {
  handleNewsletterSubscribe,
  NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  type NewsletterHandlerResult,
} from '@/lib/newsletter-handler';
import { subscriberRef, toSubscriberDoc } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;
const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;
// A new address costs a transaction write and an existing one does not; padding successful
// responses to a floor hides that difference from a timing observer. Approximate by design.
const MIN_SUCCESS_RESPONSE_MS = 1000;

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/subscribe] ${message}`, context);
}

function toResponse(result: NewsletterHandlerResult): NextResponse {
  return NextResponse.json(result.body, { status: result.status });
}

async function padToFloor(startedAt: number): Promise<void> {
  const remaining = MIN_SUCCESS_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

// Cap on the request body, checked against Content-Length before the body is buffered.
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  if (!isBodyWithinLimit(request.headers.get('content-length'), MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  let limit: AbuseLimitDecision;
  try {
    limit = await consumeAbuseLimit({
      scope: 'newsletter-subscribe',
      key: clientActorKey(request.headers.get('x-forwarded-for')),
      maxAttempts: NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: NEWSLETTER_RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (!(error instanceof AbuseLimiterUnavailableError)) throw error;
    logError('abuse limiter unavailable', { operation: 'subscribe', exceptionType: error.name });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
  if (!limit.allowed) {
    return NextResponse.json(
      { error: NEWSLETTER_COPY.rateLimited },
      { status: HTTP_TOO_MANY_REQUESTS, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const startedAt = Date.now();
  try {
    initAdmin();
    // The read-decide-write runs inside one transaction so two concurrent submits of the same
    // address cannot both create a document with a different unsubscribe token.
    const result = await getFirestore().runTransaction((tx) =>
      handleNewsletterSubscribe(
        { body },
        {
          now: new Date(),
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
    if (result.status === HTTP_OK) await padToFloor(startedAt);
    return toResponse(result);
  } catch (error) {
    logError('transaction failed', {
      operation: 'subscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
