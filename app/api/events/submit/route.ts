import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@sanity/client';

import { clientIpFromForwardedFor } from '@/lib/client-ip';
import { initAdmin } from '@/lib/firebase-admin';
import {
  hostSocietyExists,
  isVerifiedSubmitter,
  validateEventSubmission,
} from '@/lib/event-submission-guard';
import { consumeRateLimit } from '@/lib/newsletter-rate-limit';
import { createAttemptStore, scopeAttemptsToRequest } from '@/lib/newsletter-rate-store';
import {
  PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
} from '@/lib/public-form-rate-limit';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import { sendEventSubmissionAdminNotice } from '@/lib/event-submission-admin-notice';
import { logFailureSafely } from '@/lib/safe-log';
import { projectId, dataset, apiVersion } from '@/sanity/env';

export const runtime = 'nodejs';

// Parameterised: the id is a GROQ parameter, never interpolated into the query string.
// Draft ids (`drafts.*`) are unpublished and must not count as a known society.
const SOCIETY_EXISTS_QUERY =
  'count(*[_type == "society" && _id == $id && !(_id in path("drafts.**"))]) > 0';

type SubmitBody = {
  title: string;
  kind: string;
  date: string;
  endDate?: string;
  venue: string;
  location: string;
  description: string;
  hostSocietyId?: string;
};

const attempts = createAttemptStore(PUBLIC_FORM_RATE_LIMIT_WINDOW_MS);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function tooManyAttempts(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many attempts. Please try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Extract bearer token
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Verify token (revocation checked) and require a verified email
  let uid: string;
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token, true);
    if (!isVerifiedSubmitter(decoded)) {
      return NextResponse.json({ error: 'Email not verified' }, { status: 403 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Rate limit per uid, before the body is parsed
  const limit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `event-submit:${uid}`,
    PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
    PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.allowed) return tooManyAttempts(limit.retryAfterSeconds);

  // 4. Parse + validate body
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = validateEventSubmission(raw, new Date());
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, field: validation.field },
      { status: 400 },
    );
  }
  const body = raw as SubmitBody; // validateEventSubmission() checked every field's type above
  const { title, kind, date, endDate, venue, location, description, hostSocietyId } = body;

  // 4a. Rate limit per client IP: uids are free to mint, so the per-uid limit above does not
  // bound a caller who registers new accounts. Only a verified submitter with a valid body
  // counts, so unauthenticated or malformed requests cannot use up the allowance of real users
  // behind a shared address.
  const ip = clientIpFromForwardedFor(req.headers.get('x-forwarded-for'));
  const ipLimit = consumeRateLimit(
    { now: new Date(), ...scopeAttemptsToRequest(attempts) },
    `event-submit-ip:${ip ?? 'unknown'}`,
    PUBLIC_FORM_RATE_LIMIT_MAX_ATTEMPTS,
    PUBLIC_FORM_RATE_LIMIT_WINDOW_MS,
  );
  if (!ipLimit.allowed) return tooManyAttempts(ipLimit.retryAfterSeconds);

  // 5. Build write client
  const sanityToken = process.env.SANITY_API_TOKEN;
  if (!projectId || !sanityToken) {
    return NextResponse.json({ error: 'CMS not configured' }, { status: 500 });
  }
  const writeClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token: sanityToken,
    useCdn: false,
  });

  // An empty id means no host society, exactly as the draft below treats it.
  if (hostSocietyId) {
    const societyExists = await hostSocietyExists(hostSocietyId, async (id) =>
      writeClient.fetch<boolean>(SOCIETY_EXISTS_QUERY, { id }),
    );
    if (!societyExists) {
      return NextResponse.json(
        { error: 'Unknown host society', field: 'hostSocietyId' },
        { status: 400 },
      );
    }
  }

  // 6. Compute slug + draft id
  const datePart = date.slice(0, 10);
  const slug = `${slugify(title)}-${datePart}`;
  const id = `drafts.societyEvent-${crypto.randomUUID()}`;

  // 7. Create draft
  const doc: { _id: string; _type: string; [key: string]: unknown } = {
    _id: id,
    _type: 'societyEvent',
    title,
    slug: { _type: 'slug', current: slug },
    date,
    ...(endDate ? { endDate } : {}),
    kind,
    description,
    venue,
    location,
    isFeatured: false,
    ...(hostSocietyId
      ? { hostSociety: { _type: 'reference', _ref: hostSocietyId } }
      : {}),
    submittedByUid: uid,
  };

  try {
    await writeClient.createIfNotExists(doc);
  } catch {
    return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 });
  }

  // 8. Notify admins (non-blocking: a failure never changes the response)
  await deliverConfirmationEmailAfterCommit(
    () =>
      sendEventSubmissionAdminNotice({
        eventDraftId: id,
        title,
        kind,
        date,
        endDate: endDate ?? null,
        venue,
        location,
        description,
        hostSocietyId: hostSocietyId ?? null,
        submittedByUid: uid,
        submittedAt: new Date(),
      }),
    (error) => logFailureSafely('[events/submit] admin notice failed (non-fatal)', error),
  );

  // 9. Respond 201
  return NextResponse.json({ id, slug }, { status: 201 });
}
