import { revalidateTag } from 'next/cache';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const expected = process.env.SANITY_REVALIDATE_SECRET;
  const provided = request.headers.get('x-sanity-secret') ?? request.nextUrl.searchParams.get('secret');

  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid secret' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: { _type?: string } = {};
  try {
    body = (await request.json()) as { _type?: string };
  } catch {
    // Empty / non-JSON body is allowed — fall back to global revalidation.
  }

  revalidateTag('sanity');
  if (body._type) {
    revalidateTag(body._type);
  }

  return new Response(JSON.stringify({ ok: true, revalidated: true, type: body._type ?? null }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
