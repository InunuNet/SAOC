import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { buildContactSubmissionDoc, sendContactAcknowledgement } from '@/lib/contact-submission';
import { siteForHost } from '@/lib/site-hosts';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendContactSubmissionAdminNotice } from '@/lib/contact-submission-admin-notice';
import { logFailureSafely } from '@/lib/safe-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Basic validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be under 5000 characters.' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[contact/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    );
  }
}
