import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import {
  handleNewsletterOneClick,
  handleNewsletterUnsubscribe,
  NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  type NewsletterHandlerResult,
  type UnsubscribeDeps,
} from '@/lib/newsletter-handler';
import { toNewsletterResponse } from '@/lib/newsletter-http';
import {
  createAttemptStore,
  scopeAttemptsToRequest,
} from '@/lib/newsletter-rate-store';
import {
  findSubscriberByToken,
  newsletterTx,
  removeSubscriberTopics,
} from '@/lib/newsletter-store';

const HTTP_SERVER_ERROR = 500;
// RFC 8058: the mail client POSTs `List-Unsubscribe=One-Click` as a form to the URL in the header.
const ONE_CLICK_CONTENT_TYPE = 'application/x-www-form-urlencoded';

const attempts = createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[newsletter/unsubscribe] ${message}`, context);
}

function rateLimitKeyFor(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-unsubscribe:${ip ?? 'unknown'}`;
}

function isOneClick(request: NextRequest): boolean {
  return (request.headers.get('content-type') ?? '').toLowerCase().startsWith(ONE_CLICK_CONTENT_TYPE);
}

async function readText(request: NextRequest): Promise<string | null> {
  try {
    return await request.text();
  } catch {
    return null;
  }
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const oneClick = isOneClick(request);
  const form = oneClick ? await readText(request) : null;
  const body = oneClick ? null : await readJson(request);

  try {
    initAdmin();
    const requestAttempts = scopeAttemptsToRequest(attempts);
    const rateLimitKey = rateLimitKeyFor(request);
    // Lookup and update share one transaction, so a re-subscribe racing this request either
    // lands before the lookup (we unsubscribe it) or after the commit (it stays subscribed),
    // and the 200 always matches the stored state at that moment.
    const result: NewsletterHandlerResult = await getFirestore().runTransaction((tx) => {
      const ntx = newsletterTx(tx);
      const via = oneClick ? 'one-click' : 'link';
      const deps: UnsubscribeDeps = {
        now: new Date(),
        getPriorAttempts: requestAttempts.getPriorAttempts,
        recordAttempt: requestAttempts.recordAttempt,
        findByToken: (token) => findSubscriberByToken(token, ntx),
        markUnsubscribed: (id, now) => removeSubscriberTopics(id, 'all', { via, by: null, now }, ntx),
        logError,
      };
      return oneClick
        ? handleNewsletterOneClick(
            { token: request.nextUrl.searchParams.get('token'), form, rateLimitKey },
            deps,
          )
        : handleNewsletterUnsubscribe({ body, rateLimitKey }, deps);
    });
    return toNewsletterResponse(result);
  } catch (error) {
    logError('unexpected failure', {
      operation: 'unsubscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
