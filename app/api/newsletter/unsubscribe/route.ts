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
import {
  handleNewsletterUnsubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS,
} from '@/lib/newsletter-handler';
import { findSubscriberByToken, markSubscriberUnsubscribed } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;
const HTTP_TOO_MANY_REQUESTS = 429;

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/unsubscribe] ${message}`, context);
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
      scope: 'newsletter-unsubscribe',
      key: clientActorKey(request.headers.get('x-forwarded-for')),
      maxAttempts: NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: NEWSLETTER_RATE_LIMIT_WINDOW_MS,
    });
  } catch (error) {
    if (!(error instanceof AbuseLimiterUnavailableError)) throw error;
    logError('abuse limiter unavailable', { operation: 'unsubscribe', exceptionType: error.name });
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

  try {
    initAdmin();
    // Lookup and update share one transaction, so a re-subscribe racing this request either
    // lands before the lookup (we unsubscribe it) or after the commit (it stays subscribed),
    // and the 200 always matches the stored state at that moment.
    const result = await getFirestore().runTransaction((tx) =>
      handleNewsletterUnsubscribe(
        { body },
        {
          now: new Date(),
          findByToken: (token) => findSubscriberByToken(token, tx),
          markUnsubscribed: (id, now) => markSubscriberUnsubscribed(id, now, tx),
          logError,
        },
      ),
    );
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logError('unexpected failure', {
      operation: 'unsubscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
