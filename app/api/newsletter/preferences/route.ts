import { NextRequest, NextResponse } from 'next/server';
import { readJsonBodyWithinLimit } from '@/lib/request-guards';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { rateLimitKeyFromForwardedFor } from '@/lib/client-ip';
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
  const ip = rateLimitKeyFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-preferences:${ip ?? 'unknown'}`;
}

// Cap on the request body, counted as it streams in (the Content-Length header is not trusted).
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  const parsed = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok && parsed.reason === 'too-large') {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  const body: unknown = parsed.ok ? parsed.value : null;

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
