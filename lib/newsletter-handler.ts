import type { AdminAuthResult } from './admin-auth';
import {
  applySubscribe,
  buildSubscribersCsv,
  isNewsletterSource,
  isWellFormedUnsubscribeToken,
  maskEmail,
  newsletterDocId,
  normaliseNewsletterEmail,
  type NewsletterSubscriberDoc,
} from './newsletter';
import { NEWSLETTER_COPY } from '../components/chrome/newsletter-copy';
import {
  consumeRateLimit,
  type RateLimitDeps as AttemptDeps,
} from './newsletter-rate-limit';

/**
 * Pure, injectable orchestrators for the newsletter routes (mission footer-newsletter-subscribe,
 * M1/F1). No firebase-admin import: the routes supply the store adapters. Response shapes are
 * pinned by goldens/response-shapes.json. The rate-limit values are placeholders, not
 * committee-approved numbers.
 */

export const NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const NEWSLETTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS = 10;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;


export interface NewsletterHandlerResult {
  status: number;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
}

interface RateLimitDeps extends AttemptDeps {
  logError(message: string, context: Record<string, string>): void;
}

export interface SubscribeDeps extends RateLimitDeps {
  getSubscriber(id: string): Promise<NewsletterSubscriberDoc | null>;
  writeSubscriber(id: string, doc: NewsletterSubscriberDoc): Promise<void>;
  generateToken(): string;
}

export interface UnsubscribeDeps extends RateLimitDeps {
  findByToken(token: string): Promise<{ id: string; status: 'subscribed' | 'unsubscribed' } | null>;
  markUnsubscribed(id: string, now: Date): Promise<void>;
}

interface HandlerInput {
  body: unknown;
  rateLimitKey: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function checkRateLimit(
  deps: RateLimitDeps,
  key: string,
  maxAttempts: number,
): NewsletterHandlerResult | null {
  const outcome = consumeRateLimit(deps, key, maxAttempts, NEWSLETTER_RATE_LIMIT_WINDOW_MS);
  if (outcome.allowed) return null;
  return {
    status: HTTP_TOO_MANY_REQUESTS,
    body: { error: NEWSLETTER_COPY.rateLimited },
    retryAfterSeconds: outcome.retryAfterSeconds,
  };
}

export async function handleNewsletterSubscribe(
  input: HandlerInput,
  deps: SubscribeDeps,
): Promise<NewsletterHandlerResult> {
  const limited = checkRateLimit(deps, input.rateLimitKey, NEWSLETTER_RATE_LIMIT_MAX_ATTEMPTS);
  if (limited) return limited;

  const body = asRecord(input.body);
  const honeypot = body['_hp'];
  if (typeof honeypot === 'string' && honeypot !== '') {
    return { status: HTTP_OK, body: { success: true } };
  }

  const email = normaliseNewsletterEmail(body['email']);
  if (email === null) {
    return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.invalidEmail, field: 'email' } };
  }
  const source = body['source'];
  if (!isNewsletterSource(source)) {
    return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError } };
  }

  const id = newsletterDocId(email);
  try {
    const existing = await deps.getSubscriber(id);
    const doc = applySubscribe(existing, {
      email,
      source,
      now: deps.now,
      token: deps.generateToken(),
    });
    if (doc !== null) await deps.writeSubscriber(id, doc);
  } catch (error) {
    deps.logError('newsletter subscribe failed', {
      operation: 'subscribe',
      email: maskEmail(email),
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return { status: HTTP_SERVER_ERROR, body: { error: NEWSLETTER_COPY.genericError } };
  }
  return { status: HTTP_OK, body: { success: true } };
}

export async function handleNewsletterUnsubscribe(
  input: HandlerInput,
  deps: UnsubscribeDeps,
): Promise<NewsletterHandlerResult> {
  const limited = checkRateLimit(
    deps,
    input.rateLimitKey,
    NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS,
  );
  if (limited) return limited;

  const invalid: NewsletterHandlerResult = {
    status: HTTP_BAD_REQUEST,
    body: { error: NEWSLETTER_COPY.unsubscribeInvalid },
  };
  const token = asRecord(input.body)['token'];
  if (!isWellFormedUnsubscribeToken(token)) return invalid;

  try {
    const found = await deps.findByToken(token);
    if (found === null) return invalid;
    if (found.status === 'subscribed') await deps.markUnsubscribed(found.id, deps.now);
  } catch (error) {
    deps.logError('newsletter unsubscribe failed', {
      operation: 'unsubscribe',
      exceptionType: error instanceof Error ? error.name : typeof error,
    });
    return { status: HTTP_SERVER_ERROR, body: { error: NEWSLETTER_COPY.genericError } };
  }
  return { status: HTTP_OK, body: { success: true } };
}

export interface ExportDeps {
  getSession(): Promise<AdminAuthResult>;
  origin: string;
  listSubscribers(): Promise<
    {
      email: string;
      source: string;
      status: string;
      subscribedAt: Date | null;
      unsubscribeToken: string;
    }[]
  >;
}

export interface ExportResult {
  status: number;
  body: string;
  headers: Record<string, string>;
}

const EXPORT_HEADERS: Record<string, string> = {
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
  'Cache-Control': 'no-store',
};

/** Mirrors app/api/admin/export-csv: 401 for no/invalid session, 403 for every other refusal. */
export async function handleNewsletterExport(deps: ExportDeps): Promise<ExportResult> {
  const session = await deps.getSession();
  if (!session.ok) {
    const unauthenticated = session.reason === 'no-session' || session.reason === 'invalid-session';
    return {
      status: unauthenticated ? HTTP_UNAUTHORIZED : HTTP_FORBIDDEN,
      body: unauthenticated ? 'Unauthorized' : 'Forbidden',
      headers: { 'Cache-Control': 'no-store' },
    };
  }
  const rows = (await deps.listSubscribers()).filter((row) => row.status === 'subscribed');
  return {
    status: HTTP_OK,
    body: buildSubscribersCsv(rows, deps.origin),
    headers: EXPORT_HEADERS,
  };
}
