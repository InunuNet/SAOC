import { NextRequest, NextResponse } from 'next/server';
import { isBodyWithinLimit } from '@/lib/request-guards';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import { generateUnsubscribeToken } from '@/lib/newsletter';
import {
  handleNewsletterSubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  type NewsletterHandlerResult,
} from '@/lib/newsletter-handler';
import {
  createAttemptStore,
  scopeAttemptsToRequest,
} from '@/lib/newsletter-rate-store';
import { subscriberRef, toSubscriberDoc } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;
const HTTP_OK = 200;
// A new address costs a transaction write and an existing one does not; padding successful
// responses to a floor hides that difference from a timing observer. Approximate by design.
const MIN_SUCCESS_RESPONSE_MS = 1000;

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

async function padToFloor(startedAt: number): Promise<void> {
  const remaining = MIN_SUCCESS_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function rateLimitKeyFor(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-subscribe:${ip ?? 'unknown'}`;
}

// Cap on the request body, checked against Content-Length before the body is buffered.
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  if (!isBodyWithinLimit(request.headers.get('content-length'), MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const rateLimitKey = rateLimitKeyFor(request);

  const startedAt = Date.now();
  const requestAttempts = scopeAttemptsToRequest(attempts);
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
