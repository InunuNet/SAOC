import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
import { getAdminSession, hasCapability } from '@/lib/admin-auth';
import { initAdmin } from '@/lib/firebase-admin';
import { handleAdminNewsletterUnsubscribe } from '@/lib/newsletter-handler';
import { toNewsletterResponse } from '@/lib/newsletter-http';
import { findSubscriberById, newsletterTx, removeSubscriberTopics } from '@/lib/newsletter-store';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;
// Newsletter subscribers are buyer data; the same capability gates the CSV-style exports.
const NEWSLETTER_MANAGE_CAPABILITY = 'export-buyer-data';

function logError(message: string, context: Record<string, string>): void {
  console.error(`[admin/newsletter/unsubscribe] ${message}`, context);
}

async function canManageNewsletter(decodedToken: DecodedIdToken, now: Date): Promise<boolean> {
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  return hasCapability(decodedToken, NATIONAL_SHOW_ID, NEWSLETTER_MANAGE_CAPABILITY, {
    now,
    lookupShowWindow,
  });
}

function forbidden(): NextResponse {
  return NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN });
}

export async function POST(request: NextRequest) {
  // Session, then capability, then body: a caller who may not manage the list never gets a body parsed.
  const now = new Date();
  initAdmin();
  const gate = await getAdminSession();
  if (!gate.ok) {
    const unauthenticated = gate.reason === 'no-session' || gate.reason === 'invalid-session';
    return NextResponse.json(
      { error: unauthenticated ? 'Unauthorized' : 'Forbidden' },
      { status: unauthenticated ? HTTP_UNAUTHORIZED : HTTP_FORBIDDEN },
    );
  }
  const adminEmail = gate.decodedToken.email;
  if (typeof adminEmail !== 'string' || adminEmail.trim() === '' ||
      !(await canManageNewsletter(gate.decodedToken, now))) {
    return forbidden();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    const result = await getFirestore().runTransaction((tx) => {
      const ntx = newsletterTx(tx);
      return handleAdminNewsletterUnsubscribe(
        { body },
        {
          now,
          getSession: getAdminSession,
          canManage: (decodedToken) => canManageNewsletter(decodedToken, now),
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
