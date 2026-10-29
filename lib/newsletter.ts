import { createHash, randomBytes } from 'node:crypto';

import { csvField } from './csv-field';

/**
 * Pure newsletter-subscriber helpers (mission footer-newsletter-subscribe, M1/F1). No
 * firebase-admin import: every Firestore touch lives in lib/newsletter-store.ts so this file
 * stays unit-checkable. Single opt-in: a footer submit stores the subscriber as `subscribed`
 * immediately. See docs/newsletter-subscribe.md.
 */

export const NEWSLETTER_EMAIL_MAX_LENGTH = 254;

export const NEWSLETTER_SOURCES = ['saoc-footer', 'nos-footer'] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
export const NEWSLETTER_TOPICS = ['saoc', 'nos'] as const;
export type NewsletterTopic = (typeof NEWSLETTER_TOPICS)[number];

export type NewsletterStatus = 'subscribed' | 'unsubscribed';

export interface NewsletterSubscriberDoc {
  email: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  topics?: NewsletterTopic[];
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  unsubscribeToken: string;
}

export interface NewsletterCsvRow {
  email: string;
  source: string;
  topics?: NewsletterTopic[];
  subscribedAt: Date | null;
  unsubscribeToken: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSUBSCRIBE_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_BYTES = 32;
const CSV_HEADER = 'email,source,subscribedAt,unsubscribeUrl,topics';
// A cell starting with any of these is evaluated as a formula by spreadsheet software.
const EMAIL_FORMULA_LEADERS = ['=', '+', '-', '@'];

export function normaliseNewsletterEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email === '' || email.length > NEWSLETTER_EMAIL_MAX_LENGTH) return null;
  if (!EMAIL_SHAPE.test(email)) return null;
  if (EMAIL_FORMULA_LEADERS.includes(email.charAt(0))) return null;
  return email;
}

export function isNewsletterSource(value: unknown): value is NewsletterSource {
  return typeof value === 'string' && (NEWSLETTER_SOURCES as readonly string[]).includes(value);
}

export function topicsFromSource(source: NewsletterSource): NewsletterTopic[] {
  return [source === 'nos-footer' ? 'nos' : 'saoc'];
}

/** Undefined preserves the original request shape; malformed supplied values are rejected. */
export function parseNewsletterTopics(value: unknown, source: NewsletterSource): NewsletterTopic[] | null {
  if (value === undefined) return topicsFromSource(source);
  if (!Array.isArray(value) || value.length === 0 ||
      value.some((topic) => !NEWSLETTER_TOPICS.includes(topic))) return null;
  const topics = NEWSLETTER_TOPICS.filter((topic) => value.includes(topic));
  return topics.length ? topics : null;
}

export function subscriberTopics(topics: unknown, source: NewsletterSource): NewsletterTopic[] {
  if (!Array.isArray(topics)) return topicsFromSource(source);
  const valid = NEWSLETTER_TOPICS.filter((topic) => topics.includes(topic));
  return valid.length ? valid : topicsFromSource(source);
}

export function newsletterDocId(normalisedEmail: string): string {
  return createHash('sha256').update(normalisedEmail).digest('hex');
}

export function generateUnsubscribeToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function isWellFormedUnsubscribeToken(token: unknown): token is string {
  return typeof token === 'string' && UNSUBSCRIBE_TOKEN_SHAPE.test(token);
}

export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email.charAt(0)}***${email.slice(at)}`;
}

export function applySubscribe(
  existing: NewsletterSubscriberDoc | null,
  input: { email: string; source: NewsletterSource; topics?: NewsletterTopic[]; now: Date; token: string },
): NewsletterSubscriberDoc | null {
  const requestedTopics = subscriberTopics(input.topics, input.source);
  if (existing === null) {
    return {
      email: input.email,
      status: 'subscribed',
      source: input.source,
      topics: requestedTopics,
      subscribedAt: input.now,
      unsubscribedAt: null,
      unsubscribeToken: input.token,
    };
  }
  if (existing.status === 'subscribed') {
    const topics = NEWSLETTER_TOPICS.filter((topic) =>
      subscriberTopics(existing.topics, existing.source).includes(topic) || requestedTopics.includes(topic));
    if (topics.length === subscriberTopics(existing.topics, existing.source).length && existing.topics) return null;
    return { ...existing, topics };
  }
  // Re-subscribe keeps the original token and source so previously issued links keep working.
  // Topics are exactly the new request: consent given before unsubscribing does not carry over.
  return {
    email: existing.email,
    status: 'subscribed',
    source: existing.source,
    topics: requestedTopics,
    subscribedAt: input.now,
    unsubscribedAt: null,
    unsubscribeToken: existing.unsubscribeToken,
  };
}

/** The origin that hosts the unsubscribe page for a subscriber: one string, or chosen per source. */
export type UnsubscribeOrigin = string | ((source: string) => string);

export function buildSubscribersCsv(rows: NewsletterCsvRow[], origin: UnsubscribeOrigin): string {
  const lines = rows.map((row) => {
    const rowOrigin = typeof origin === 'function' ? origin(row.source) : origin;
    return [
      csvField(row.email),
      csvField(row.source),
      csvField(row.subscribedAt ? row.subscribedAt.toISOString() : ''),
      csvField(`${rowOrigin}/newsletter/unsubscribe?token=${encodeURIComponent(row.unsubscribeToken)}`),
      csvField(subscriberTopics(row.topics, row.source === 'nos-footer' ? 'nos-footer' : 'saoc-footer').join(';')),
    ].join(',');
  });
  return [CSV_HEADER, ...lines].join('\n');
}
