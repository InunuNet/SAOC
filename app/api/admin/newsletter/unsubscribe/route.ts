import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { handleAdminNewsletterUnsubscribe } from '@/lib/newsletter-handler';
import { toNewsletterResponse } from '@/lib/newsletter-http';
import { findSubscriberById, newsletterTx, removeSubscriberTopics } from '@/lib/newsletter-store';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

const HTTP_SERVER_ERROR = 500;
// Newsletter subscribers are buyer data; the same capability gates the CSV-style exports.
const NEWSLETTER_MANAGE_CAPABILITY = 'export-buyer-data';

function logError(message: string, context: Record<string, string>): void {
  console.error(`[admin/newsletter/unsubscribe] ${message}`, context);
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
    const now = new Date();
    const result = await getFirestore().runTransaction((tx) => {
      const ntx = newsletterTx(tx);
      return handleAdminNewsletterUnsubscribe(
        { body },
        {
          now,
          getSession: getAdminSession,
          canManage: async (decodedToken) => {
            const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
            return hasCapability(decodedToken, NATIONAL_SHOW_ID, NEWSLETTER_MANAGE_CAPABILITY, {
              now,
              lookupShowWindow,
            });
          },
          findById: (id) => findSubscriberById(id, ntx),
          removeTopics: (id, topics, at, adminEmail) =>
            removeSubscriberTopics(id, topics, { via: 'admin', by: adminEmail, now: at }, ntx),
          logError,
        },
      );
    });
    return toNewsletterResponse(result);
  } catch (error) {
    logError('unexpected failure', {
      operation: 'admin-unsubscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json({ error: NEWSLETTER_COPY.genericError }, { status: HTTP_SERVER_ERROR });
  }
}
