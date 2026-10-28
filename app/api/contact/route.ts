import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { validateContactInput } from '@/lib/contact-input';
import { initAdmin } from '@/lib/firebase-admin';
import { consumeRateLimit } from '@/lib/newsletter-rate-limit';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import {
  PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
} from '@/lib/public-form-rate-limit';
import { isBodyWithinLimit, isHoneypotHit } from '@/lib/request-guards';
import { buildContactSubmissionDoc, sendContactAcknowledgement } from '@/lib/contact-submission';
import { siteForHost } from '@/lib/site-hosts';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendContactSubmissionAdminNotice } from '@/lib/contact-submission-admin-notice';
import { logFailureSafely } from '@/lib/safe-log';

const HTTP_BAD_REQUEST = 400;
const HTTP_CREATED = 201;
const HTTP_TOO_MANY_REQUESTS = 429;

const attempts = createAttemptStore(PUBLIC_FORM_RATE_LIMIT_WINDOW_MS);

// Cap on the request body, checked against Content-Length before the body is buffered.
const MAX_BODY_BYTES = 32768;

export async function POST(request: NextRequest) {
  if (!isBodyWithinLimit(request.headers.get('content-length'), MAX_BODY_BYTES)) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
  const ip = clientIpFromForwardedFor(request.headers.get('x-forwarded-for'));
  const limit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `contact:${ip ?? 'unknown'}`,
    PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
    PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: HTTP_TOO_MANY_REQUESTS, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: HTTP_BAD_REQUEST });
    }

    // A bot filled the hidden field: answer as if it worked, store and send nothing.
    if (isHoneypotHit(body)) {
      return NextResponse.json({ success: true }, { status: HTTP_CREATED });
    }

    const validation = validateContactInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: HTTP_BAD_REQUEST });
    }
    const { name, email, subject, message } = validation.value;

    initAdmin();
    const db = getFirestore();

    // The site comes from the request host, never from the body.
    const site = siteForHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
    const doc = buildContactSubmissionDoc({ name, email, subject, message }, site, new Date());

    const ref = await db
      .collection('contactSubmissions')
      .add({ ...doc, submittedAt: Timestamp.fromDate(doc.submittedAt) });

    try {
      await sendContactAcknowledgement({ name: doc.name, email, subject: doc.subject, site });
    } catch (emailErr) {
      console.error('[contact/route] Email send failed (non-fatal):', emailErr);
    }

    await deliverConfirmationEmailAfterCommit(
      () =>
        sendContactSubmissionAdminNotice({
          submissionId: ref.id,
          name: doc.name,
          email: doc.email,
          subject: doc.subject,
          message: doc.message,
          submittedAt: doc.submittedAt,
          site,
        }),
      (error) => logFailureSafely('[contact/route] admin notice failed (non-fatal)', error),
    );

    return NextResponse.json({ success: true }, { status: HTTP_CREATED });
  } catch (error) {
    console.error('[contact/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    );
  }
}
