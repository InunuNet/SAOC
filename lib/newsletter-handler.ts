import type { AdminAuthResult } from './admin-auth';
import {
  applySubscribe,
  buildSubscribersCsv,
  isNewsletterSource,
  isWellFormedUnsubscribeToken,
  maskEmail,
  newsletterDocId,
  normaliseNewsletterEmail,
  parseNewsletterTopics,
  NEWSLETTER_TOPICS,
  type NewsletterSubscriberDoc,
  type NewsletterTopic,
  type UnsubscribeOrigin,
} from './newsletter';
import {
  applyTopicPreferences,
  rowMatches,
  type NewsletterListFilter,
} from './newsletter-preferences';
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
// A new address costs a transaction write and an existing one does not; padding successful
// responses to a floor hides that difference from a timing observer. Approximate by design.
export const NEWSLETTER_MIN_SUCCESS_RESPONSE_MS = 1000;

const ONE_CLICK_FORM_BODY = 'List-Unsubscribe=One-Click';
const NEWSLETTER_DOC_ID_SHAPE = /^[0-9a-f]{64}$/;

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
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

export interface PreferencesDeps extends RateLimitDeps {
  findByToken(token: string): Promise<{
    id: string;
    status: 'subscribed' | 'unsubscribed';
    topics: NewsletterTopic[];
    restoreTopics: NewsletterTopic[];
    previousTopics?: NewsletterTopic[];
  } | null>;
  removeTopics(id: string, topics: NewsletterTopic[] | 'all', now: Date): Promise<void>;
  addTopics(id: string, topics: NewsletterTopic[], now: Date): Promise<void>;
  restore(id: string, now: Date): Promise<void>;
}

export interface UnsubscribeByEmailDeps extends RateLimitDeps {
  removeTopicByEmailId(id: string, topic: NewsletterTopic, now: Date): Promise<void>;
}

export interface AdminUnsubscribeDeps {
  now: Date;
  getSession(): Promise<AdminAuthResult>;
  canManage(decodedToken: Extract<AdminAuthResult, { ok: true }>['decodedToken']): boolean | Promise<boolean>;
  findById(id: string): Promise<{ status: 'subscribed' | 'unsubscribed'; topics: NewsletterTopic[] } | null>;
  removeTopics(id: string, topics: NewsletterTopic[], now: Date, adminEmail: string): Promise<void>;
  logError(message: string, context: Record<string, string>): void;
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
  const topics = parseNewsletterTopics(body['topics'], source);
  if (topics === null) {
    return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError, field: 'topics' } };
  }

  const id = newsletterDocId(email);
  try {
    const existing = await deps.getSubscriber(id);
    const doc = applySubscribe(existing, {
      email,
      source,
      topics,
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

function genericServerError(): NewsletterHandlerResult {
  return { status: HTTP_SERVER_ERROR, body: { error: NEWSLETTER_COPY.genericError } };
}

function exceptionType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

const INVALID_TOKEN: NewsletterHandlerResult = {
  status: HTTP_BAD_REQUEST,
  body: { error: NEWSLETTER_COPY.unsubscribeInvalid },
};

// The token preferences page's POST: narrow, re-add, unsubscribe from everything, or restore.
export async function handleNewsletterPreferences(
  input: HandlerInput,
  deps: PreferencesDeps,
): Promise<NewsletterHandlerResult> {
  const limited = checkRateLimit(deps, input.rateLimitKey, NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS);
  if (limited) return limited;

  const body = asRecord(input.body);
  const token = body['token'];
  if (!isWellFormedUnsubscribeToken(token)) return INVALID_TOKEN;

  try {
    const found = await deps.findByToken(token);
    if (found === null) return INVALID_TOKEN;

    if (body['restore'] === true) {
      if (found.status !== 'unsubscribed' || found.restoreTopics.length === 0) {
        return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError, field: 'restore' } };
      }
      await deps.restore(found.id, deps.now);
      return { status: HTTP_OK, body: { success: true, status: 'subscribed', topics: found.restoreTopics } };
    }
    if (found.status === 'unsubscribed') {
      return { status: HTTP_OK, body: { success: true, status: 'unsubscribed', topics: [] } };
    }

    const outcome = applyTopicPreferences(found.topics, found.previousTopics ?? [], body['topics']);
    if (!outcome.ok) {
      return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError, field: 'topics' } };
    }
    if (outcome.action === 'unsubscribe-all') {
      await deps.removeTopics(found.id, 'all', deps.now);
      return { status: HTTP_OK, body: { success: true, status: 'unsubscribed', topics: [] } };
    }
    // Add before remove, so swapping the only held topic never passes through "unsubscribed".
    if (outcome.add.length > 0) await deps.addTopics(found.id, outcome.add, deps.now);
    if (outcome.remove.length > 0) await deps.removeTopics(found.id, outcome.remove, deps.now);
    const topics = NEWSLETTER_TOPICS.filter((topic) =>
      (found.topics.includes(topic) && !outcome.remove.includes(topic)) || outcome.add.includes(topic));
    return { status: HTTP_OK, body: { success: true, status: 'subscribed', topics } };
  } catch (error) {
    deps.logError('newsletter preferences failed', {
      operation: 'preferences',
      exceptionType: exceptionType(error),
    });
    return genericServerError();
  }
}

// RFC 8058 one-click (the mail client POSTs `List-Unsubscribe=One-Click`). Any token, malformed,
// unknown or known, answers the same 200, so the endpoint cannot be used to probe for addresses.
export async function handleNewsletterOneClick(
  input: { token: unknown; form: unknown; rateLimitKey: string },
  deps: UnsubscribeDeps,
): Promise<NewsletterHandlerResult> {
  const limited = checkRateLimit(deps, input.rateLimitKey, NEWSLETTER_UNSUBSCRIBE_RATE_LIMIT_MAX_ATTEMPTS);
  if (limited) return limited;
  if (input.form !== ONE_CLICK_FORM_BODY) {
    return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError } };
  }
  if (isWellFormedUnsubscribeToken(input.token)) {
    try {
      const found = await deps.findByToken(input.token);
      if (found !== null && found.status === 'subscribed') await deps.markUnsubscribed(found.id, deps.now);
    } catch (error) {
      deps.logError('newsletter one-click unsubscribe failed', {
        operation: 'one-click',
        exceptionType: exceptionType(error),
      });
      return genericServerError();
    }
  }
  return { status: HTTP_OK, body: { success: true } };
}

// The /unsubscribe page's POST. The topic comes from the request host (`site`), never the body,
// and the answer is the same 200 whether or not the address was subscribed.
export async function handleNewsletterUnsubscribeByEmail(
  input: { body: unknown; site: 'saoc' | 'nos'; rateLimitKey: string },
  deps: UnsubscribeByEmailDeps,
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
  const topic: NewsletterTopic = input.site === 'nos' ? 'nos' : 'saoc';
  try {
    await deps.removeTopicByEmailId(newsletterDocId(email), topic, deps.now);
  } catch (error) {
    deps.logError('newsletter unsubscribe by email failed', {
      operation: 'unsubscribe-email',
      exceptionType: exceptionType(error),
    });
    return genericServerError();
  }
  return { status: HTTP_OK, body: { success: true } };
}

function parseTopicSelection(value: unknown): NewsletterTopic[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const known = value.filter((topic): topic is NewsletterTopic => NEWSLETTER_TOPICS.some((t) => t === topic));
  return known.length === value.length && new Set(known).size === known.length ? known : null;
}

// Admin removal of chosen topics. The gate (session, then capability) runs before the body is read.
export async function handleAdminNewsletterUnsubscribe(
  input: { body: unknown },
  deps: AdminUnsubscribeDeps,
): Promise<NewsletterHandlerResult> {
  const session = await deps.getSession();
  if (!session.ok) {
    const unauthenticated = session.reason === 'no-session' || session.reason === 'invalid-session';
    return {
      status: unauthenticated ? HTTP_UNAUTHORIZED : HTTP_FORBIDDEN,
      body: { error: unauthenticated ? 'Unauthorized' : 'Forbidden' },
    };
  }
  const adminEmail = session.decodedToken.email;
  if (!(await deps.canManage(session.decodedToken)) || typeof adminEmail !== 'string' || adminEmail.trim() === '') {
    return { status: HTTP_FORBIDDEN, body: { error: 'Forbidden' } };
  }

  const body = asRecord(input.body);
  const id = body['id'];
  const topics = parseTopicSelection(body['topics']);
  if (typeof id !== 'string' || !NEWSLETTER_DOC_ID_SHAPE.test(id) || topics === null) {
    return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError } };
  }

  try {
    const found = await deps.findById(id);
    if (found === null) return { status: HTTP_NOT_FOUND, body: { error: NEWSLETTER_COPY.genericError } };
    if (found.status === 'subscribed') {
      if (topics.some((topic) => !found.topics.includes(topic))) {
        return { status: HTTP_BAD_REQUEST, body: { error: NEWSLETTER_COPY.genericError, field: 'topics' } };
      }
      await deps.removeTopics(id, topics, deps.now, adminEmail);
    }
  } catch (error) {
    deps.logError('newsletter admin unsubscribe failed', {
      operation: 'admin-unsubscribe',
      exceptionType: exceptionType(error),
    });
    return genericServerError();
  }
  return { status: HTTP_OK, body: { success: true } };
}

export interface ExportDeps {
  getSession(): Promise<AdminAuthResult>;
  origin: UnsubscribeOrigin;
  // A bulletin export holds subscribed addresses only, and only those on this list.
  list: NewsletterListFilter;
  listSubscribers(): Promise<
    {
      email: string;
      source: string;
      topics?: NewsletterTopic[];
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
  const rows = (await deps.listSubscribers()).filter((row) => rowMatches(row, deps.list, 'subscribed'));
  return {
    status: HTTP_OK,
    body: buildSubscribersCsv(rows, deps.origin),
    headers: EXPORT_HEADERS,
  };
}
