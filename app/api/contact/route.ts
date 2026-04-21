import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

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

    await db.collection('contactSubmissions').add({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject).trim(),
      message: String(message).trim(),
      submittedAt: Timestamp.now(),
      status: 'new',
    });

    // TODO: Send email notification via SendGrid or Resend (Phase 1.x)

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[contact/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    );
  }
}
