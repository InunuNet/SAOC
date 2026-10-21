import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { initAdmin } from '@/lib/firebase-admin';
import {
  handleNewsletterUnsubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
} from '@/lib/newsletter-handler';
import {
  createAttemptStore,
  rateLimitKeyFromHeaders,
  scopeAttemptsToRequest,
} from '@/lib/newsletter-rate-store';
import { findSubscriberByToken, markSubscriberUnsubscribed } from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;

const attempts = createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/unsubscribe] ${message}`, context);
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
    const rateLimitKey = rateLimitKeyFromHeaders(request.headers, 'newsletter-unsubscribe');
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
