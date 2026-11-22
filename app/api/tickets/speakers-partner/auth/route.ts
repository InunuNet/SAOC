import { secretsEnv } from '@/lib/secrets';
import { NextResponse, type NextRequest } from 'next/server';

import { rateLimitKeyFromForwardedFor } from '@/lib/client-ip';
import { readJsonBodyWithinLimit } from '@/lib/request-guards';
import { decideRateLimit, type RateLimitAttempt } from '@/lib/resend-rate-limit';
import {
  isSpeakersPartnerPasswordCorrect,
  mintSpeakersPartnerSession,
  SPEAKERS_PARTNER_COOKIE_NAME,
  SPEAKERS_PARTNER_RATE_LIMIT_MAX_ATTEMPTS,
  SPEAKERS_PARTNER_RATE_LIMIT_WINDOW_MS,
  SPEAKERS_PARTNER_SESSION_TTL_MS,
  speakersPartnerPassword,
} from '@/lib/speakers-partner';

// Password check for the hidden Speakers Partner ticket. Every refusal, wrong password or
// unconfigured secret, returns the same body and status, so the response never says which.
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 2048;
const MAX_TRACKED_ATTEMPTS = 5000;
const REFUSED_MESSAGE = 'That password did not match.';
const RATE_LIMITED_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';

// In memory per server instance, like the vendor registration limiter: it slows guessing, and
// the password itself is the real protection.
const attempts: RateLimitAttempt[] = [];

function recordAttempt(key: string, now: Date): void {
  attempts.push({ key, at: now });
  const oldestKept = now.getTime() - SPEAKERS_PARTNER_RATE_LIMIT_WINDOW_MS;
  while (attempts.length > 0) {
    const oldest = attempts[0];
    if (attempts.length <= MAX_TRACKED_ATTEMPTS && oldest.at.getTime() >= oldestKept) break;
    attempts.shift();
  }
}

async function readPassword(request: NextRequest): Promise<string | null> {
  const parsed = await readJsonBodyWithinLimit(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    if (parsed.reason === 'invalid-json') {
      console.error('[speakers-partner/auth] unreadable request body:', parsed.reason);
    }
    return null;
  }
  const body = parsed.value;
  if (typeof body !== 'object' || body === null) return null;
  const { password } = body as { password?: unknown };
  return typeof password === 'string' && password.length <= MAX_BODY_BYTES ? password : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const now = new Date();
  const ip = rateLimitKeyFromForwardedFor(request.headers.get('x-forwarded-for')) ?? 'unknown';
  const key = `speakers-partner:${ip}`;
  const decision = decideRateLimit({
    key,
    now,
    priorAttempts: attempts,
    maxAttempts: SPEAKERS_PARTNER_RATE_LIMIT_MAX_ATTEMPTS,
    windowMs: SPEAKERS_PARTNER_RATE_LIMIT_WINDOW_MS,
  });
  if (!decision.allowed) {
    const retryAfterSeconds = Math.ceil((decision.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: RATE_LIMITED_MESSAGE },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    );
  }
  recordAttempt(key, now);

  const password = speakersPartnerPassword(secretsEnv());
  const candidate = await readPassword(request);
  if (!isSpeakersPartnerPasswordCorrect(candidate, password) || password === null) {
    return NextResponse.json({ error: REFUSED_MESSAGE }, { status: 403 });
  }

  const session = mintSpeakersPartnerSession(password, now);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SPEAKERS_PARTNER_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SPEAKERS_PARTNER_SESSION_TTL_MS / 1000),
  });
  return response;
}
