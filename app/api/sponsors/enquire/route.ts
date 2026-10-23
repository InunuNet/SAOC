import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import { siteForHost } from '@/lib/site-hosts';
import { sendSponsorEnquiryAdminNotice } from '@/lib/sponsor-enquiry-admin-notice';
import { sendSponsorEnquiryConfirmationEmail } from '@/lib/sponsor-enquiry-confirmation';
import {
  handleSponsorEnquiry,
  SPONSOR_ENQUIRY_RATE_LIMIT_WINDOW_MS,
  type SponsorEnquiryHandlerResult,
} from '@/lib/sponsor-enquiry-handler';
import { SPONSOR_ENQUIRY_COLLECTION, type SponsorEnquiryDoc } from '@/lib/sponsor-enquiry';

const HTTP_SERVER_ERROR = 500;

const attempts = createAttemptStore(SPONSOR_ENQUIRY_RATE_LIMIT_WINDOW_MS);

function logError(message: string, context: Record<string, string>): void {
  console.error(`[sponsors/enquire] ${message}`, context);
}

function toResponse(result: SponsorEnquiryHandlerResult): NextResponse {
  const headers: Record<string, string> = {};
  if (result.retryAfterSeconds !== undefined) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return NextResponse.json(result.body, { status: result.status, headers });
}

async function writeEnquiry(doc: SponsorEnquiryDoc): Promise<string> {
  const db = getFirestore(initAdmin());
  const ref = await db
    .collection(SPONSOR_ENQUIRY_COLLECTION)
    .add({ ...doc, submittedAt: Timestamp.fromDate(doc.submittedAt) });
  return ref.id;
}

// Each email is isolated on its own: one failing never stops the other, and neither reaches the
// response. Only the error name is logged, a mailer message can embed an address.
async function notify(id: string, doc: SponsorEnquiryDoc): Promise<void> {
  const onError = (operation: string) => (error: unknown) =>
    logError('notification failed', {
      operation,
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
  await Promise.all([
    deliverConfirmationEmailAfterCommit(
      () => sendSponsorEnquiryAdminNotice({ enquiryId: id, doc }),
      onError('admin-notice'),
    ),
    deliverConfirmationEmailAfterCommit(
      () => sendSponsorEnquiryConfirmationEmail({ contactName: doc.contactName, email: doc.email }),
      onError('acknowledgement'),
    ),
  ]);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  let malformed = false;
  try {
    body = await request.json();
  } catch {
    body = null;
    malformed = true;
  }
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  const requestAttempts = scopeAttemptsToRequest(attempts);
  // The site comes from the Host, never from the body: a spoofed host is not the NOS site.
  const site = siteForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));

  try {
    const result = await handleSponsorEnquiry(
      { body, malformed, rateLimitKey: `sponsor-enquiry:${ip ?? 'unknown'}`, site },
      {
        now: new Date(),
        getPriorAttempts: requestAttempts.getPriorAttempts,
        recordAttempt: requestAttempts.recordAttempt,
        writeEnquiry,
        afterCommit: notify,
        logError,
      },
    );
    return toResponse(result);
  } catch (error) {
    logError('unexpected failure', {
      operation: 'enquire',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: HTTP_SERVER_ERROR },
    );
  }
}
