import { NextRequest, NextResponse } from 'next/server';
import { isBodyWithinLimit } from '@/lib/request-guards';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import {
  handleNewsletterUnsubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
} from '@/lib/newsletter-handler';
import {
  createAttemptStore,
  scopeAttemptsToRequest,
} from '@/lib/newsletter-rate-store';
import { findSubscriberByToken, markSubscriberUnsubscribed } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;

const attempts = createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/unsubscribe] ${message}`, context);
}

function rateLimitKeyFor(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-unsubscribe:${ip ?? 'unknown'}`;
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

  try {
    initAdmin();
    const requestAttempts = scopeAttemptsToRequest(attempts);
    const rateLimitKey = rateLimitKeyFor(request);
    // Lookup and update share one transaction, so a re-subscribe racing this request either
    // lands before the lookup (we unsubscribe it) or after the commit (it stays subscribed),
    // and the 200 always matches the stored state at that moment.
    const result = await getFirestore().runTransaction((tx) =>
      handleNewsletterUnsubscribe(
        { body, rateLimitKey },
        {
          now: new Date(),
          getPriorAttempts: requestAttempts.getPriorAttempts,
          recordAttempt: requestAttempts.recordAttempt,
          findByToken: (token) => findSubscriberByToken(token, tx),
          markUnsubscribed: (id, now) => markSubscriberUnsubscribed(id, now, tx),
          logError,
        },
      ),
    );
    const headers: Record<string, string> = {};
    if (result.retryAfterSeconds !== undefined) {
      headers['Retry-After'] = String(result.retryAfterSeconds);
    }
    return NextResponse.json(result.body, { status: result.status, headers });
  } catch (error) {
    logError('unexpected failure', {
      operation: 'unsubscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
