import { NextRequest, NextResponse } from 'next/server';

import {
  handleNewsletterUnsubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
} from '@/lib/newsletter-handler';
import { createAttemptStore, rateLimitKeyFromHeaders } from '@/lib/newsletter-rate-store';
import { findSubscriberByToken, markSubscriberUnsubscribed } from '@/lib/newsletter-store';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
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
    const result = await handleNewsletterUnsubscribe(
      { body, rateLimitKey: rateLimitKeyFromHeaders(request.headers, 'newsletter-unsubscribe') },
      {
        now: new Date(),
        getPriorAttempts: attempts.getPriorAttempts,
        recordAttempt: attempts.recordAttempt,
        findByToken: findSubscriberByToken,
        markUnsubscribed: markSubscriberUnsubscribed,
        logError,
      },
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: HTTP_SERVER_ERROR });
  }
}
