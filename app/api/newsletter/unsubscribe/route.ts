import { NextRequest, NextResponse } from 'next/server';
import { readBodyTextWithinLimit, readJsonBodyWithinLimit } from '@/lib/request-guards';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { rateLimitKeyFromHeaders } from '@/lib/client-ip';
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
  const ip = rateLimitKeyFromHeaders(request.headers);
  return `newsletter-unsubscribe:${ip ?? 'unknown'}`;
}

function isOneClick(request: NextRequest): boolean {
  return (request.headers.get('content-type') ?? '').toLowerCase().startsWith(ONE_CLICK_CONTENT_TYPE);
}

type FormRead = { text: string | null; tooLarge: boolean };

/** The one-click form body. A stream error reads as no form (null), as it always did. */
async function readFormWithinLimit(request: NextRequest): Promise<FormRead> {
  try {
    const text = await readBodyTextWithinLimit(request, MAX_BODY_BYTES);
    return { text, tooLarge: text === null };
  } catch {
    return { text: null, tooLarge: false };
  }
}

// Cap on the request body: a declared Content-Length over it is refused up front, and the
// bytes actually read are counted as they stream in.
const MAX_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  const oneClick = isOneClick(request);
  // The one-click form is read as text, the link form as JSON; both under the streamed cap.
  const oneClickRead = oneClick ? await readFormWithinLimit(request) : null;
  const form = oneClickRead?.text ?? null;
  const parsed = oneClick ? null : await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (oneClickRead?.tooLarge || (parsed && !parsed.ok && parsed.reason === 'too-large')) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  const body: unknown = parsed?.ok ? parsed.value : null;

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
