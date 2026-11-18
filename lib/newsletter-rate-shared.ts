import type { NextRequest } from 'next/server';

import { clientIpFromForwardedFor } from './client-ip';
import { NEWSLETTER_RATE_LIMIT_WINDOW_MS } from './newsletter-handler';
import { type AttemptStore, createAttemptStore } from './newsletter-rate-store';

// The footer subscribe route and the by-email unsubscribe route share one quota per IP (spec: the
// by-email route shares the subscribe limit). The store hangs off globalThis so both route bundles
// count against the same history inside one server instance.
const SHARED_STORE_SLOT = Symbol.for('saoc.newsletter.publicFormAttempts');

type SlotHolder = { [SHARED_STORE_SLOT]?: AttemptStore };

export function sharedNewsletterAttempts(): AttemptStore {
  const holder = globalThis as SlotHolder;
  holder[SHARED_STORE_SLOT] ??= createAttemptStore(NEWSLETTER_RATE_LIMIT_WINDOW_MS);
  return holder[SHARED_STORE_SLOT];
}

export function sharedNewsletterRateLimitKey(request: NextRequest): string {
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  return `newsletter-public-form:${ip ?? 'unknown'}`;
}
