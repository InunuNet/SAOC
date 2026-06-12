import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@sanity/client';

import { initAdmin } from '@/lib/firebase-admin';
import { projectId, dataset, apiVersion } from '@/sanity/env';

export const runtime = 'nodejs';

const ALLOWED_KINDS = ['exhibition', 'meeting', 'show', 'workshop', 'social'] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Extract bearer token
  const authz = req.headers.get('authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Verify token
  let uid: string;
  try {
    initAdmin();
    const decoded = await getAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. Parse + validate body
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { title, kind, date, endDate, venue, location, description, hostSocietyId } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required', field: 'title' }, { status: 400 });
  }
  if (!ALLOWED_KINDS.includes(kind as Kind)) {
    return NextResponse.json({ error: 'Invalid event kind', field: 'kind' }, { status: 400 });
  }
  const dateObj = date ? new Date(date) : null;
  if (!dateObj || isNaN(dateObj.getTime()) || dateObj <= new Date()) {
    return NextResponse.json(
      { error: 'Date must be a valid date in the future', field: 'date' },
      { status: 400 }
    );
  }
  if (endDate) {
    const endObj = new Date(endDate);
    if (isNaN(endObj.getTime()) || endObj < dateObj) {
      return NextResponse.json(
        { error: 'End date must be on or after start date', field: 'endDate' },
        { status: 400 }
      );
    }
  }
  if (!venue?.trim()) {
    return NextResponse.json({ error: 'Venue is required', field: 'venue' }, { status: 400 });
  }
  if (!location?.trim()) {
    return NextResponse.json({ error: 'Location is required', field: 'location' }, { status: 400 });
  }
  if (!description || description.trim().length < 20) {
    return NextResponse.json(
      { error: 'Description must be at least 20 characters', field: 'description' },
      { status: 400 }
    );
  }

  // 4. Build write client
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

  // 5. Compute slug + draft id
  const datePart = date.slice(0, 10);
  const slug = `${slugify(title)}-${datePart}`;
  const id = `drafts.societyEvent-${crypto.randomUUID()}`;

  // 6. Create draft
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

  // 7. Respond 201
  return NextResponse.json({ id, slug }, { status: 201 });
}
