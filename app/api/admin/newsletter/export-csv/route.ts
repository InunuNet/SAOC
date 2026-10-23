import type { NextRequest } from 'next/server';

import { getAdminSession } from '@/lib/admin-auth';
import { handleNewsletterExport } from '@/lib/newsletter-handler';
import { NEWSLETTER_LIST_FILTERS, type NewsletterListFilter } from '@/lib/newsletter-preferences';
import { listAllSubscribers } from '@/lib/newsletter-store';
import { nosOrigin, saocOrigin } from '@/lib/site-hosts';

// The exported topics column is built by buildSubscribersCsv from each subscriber's stored or
// legacy source-derived topics. Unsubscribe links use the configured origin, never request Host:
// the NOS origin for nos-footer subscribers, the SAOC origin for everyone else.
const NOS_FOOTER_SOURCE = 'nos-footer';

function unsubscribeOrigin(source: string): string {
  return source === NOS_FOOTER_SOURCE ? nosOrigin() : saocOrigin();
}

// `?list=` narrows the export; anything unrecognised is the whole subscribed list. A status filter
// is deliberately not read: a bulletin export must never contain an unsubscribed address.
function listFilterOf(request: NextRequest): NewsletterListFilter {
  const requested = request.nextUrl.searchParams.get('list');
  return NEWSLETTER_LIST_FILTERS.find((list) => list === requested) ?? 'all';
}

export async function GET(request: NextRequest) {
  const result = await handleNewsletterExport({
    getSession: getAdminSession,
    origin: unsubscribeOrigin,
    list: listFilterOf(request),
    listSubscribers: listAllSubscribers,
  });
  return new Response(result.body, { status: result.status, headers: result.headers });
}
