import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';
import { sendEmail } from '@/lib/email';
import ContactConfirmation from '@/emails/ContactConfirmation';

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

    try {
      await sendEmail({
        to: email,
        subject: 'We received your message — SAOC',
        react: React.createElement(ContactConfirmation, {
          name: String(name).trim(),
          subject: String(subject).trim(),
        }),
      });
    } catch (emailErr) {
      console.error('[contact/route] Email send failed (non-fatal):', emailErr);
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('[contact/route] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit. Please try again.' },
      { status: 500 }
    );
  }
}
