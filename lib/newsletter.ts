import { createHash, randomBytes } from 'node:crypto';

import {
  NEWSLETTER_REMOVAL_VIAS,
  NEWSLETTER_TOPICS,
  type NewsletterRemovalVia,
  type NewsletterStatus,
  type NewsletterTopic,
  type NewsletterTopicRemoval,
} from './newsletter-topics';

export { NEWSLETTER_REMOVAL_VIAS, NEWSLETTER_TOPICS };
export type { NewsletterRemovalVia, NewsletterStatus, NewsletterTopic, NewsletterTopicRemoval };

/**
 * Pure newsletter-subscriber helpers (mission footer-newsletter-subscribe, M1/F1). No
 * firebase-admin import: every Firestore touch lives in lib/newsletter-store.ts so this file
 * stays unit-checkable. Single opt-in: a footer submit stores the subscriber as `subscribed`
 * immediately. See docs/newsletter-subscribe.md.
 */

export const NEWSLETTER_EMAIL_MAX_LENGTH = 254;

export const NEWSLETTER_SOURCES = ['saoc-footer', 'nos-footer'] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];
// `topics` is what the address is subscribed to now; an empty array is a real, honoured value.
export interface NewsletterSubscriberDoc {
  email: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  topics: NewsletterTopic[];
  topicRemovals: NewsletterTopicRemoval[];
  restoreTopics: NewsletterTopic[];
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  unsubscribedVia: NewsletterRemovalVia | null;
  unsubscribedBy: string | null;
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
const CSV_HEADER = 'email,source,subscribedAt,unsubscribeUrl,topics,listUnsubscribeHeader';
// A cell starting with any of these is evaluated as a formula by spreadsheet software.
const FORMULA_LEADERS = ['=', '+', '-', '@', '\t', '\r'];
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

// Legacy documents have no `topics` array and derive from `source`; an array, even `[]`, is honoured.
export function subscriberTopics(topics: unknown, source: NewsletterSource): NewsletterTopic[] {
  if (!Array.isArray(topics)) return topicsFromSource(source);
  return NEWSLETTER_TOPICS.filter((topic) => topics.includes(topic));
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
      topicRemovals: [],
      restoreTopics: [],
      subscribedAt: input.now,
      unsubscribedAt: null,
      unsubscribedVia: null,
      unsubscribedBy: null,
      unsubscribeToken: input.token,
    };
  }
  const held = existing.status === 'subscribed' ? existing.topics : [];
  const topics = NEWSLETTER_TOPICS.filter((topic) => held.includes(topic) || requestedTopics.includes(topic));
  if (existing.status === 'subscribed' && topics.length === held.length) return null;
  // Re-subscribe keeps the original token, source and removal history, so previously issued links
  // and the audit trail survive; only the doc-level unsubscribe audit is cleared.
  return {
    ...existing,
    status: 'subscribed',
    topics,
    restoreTopics: [],
    subscribedAt: existing.status === 'subscribed' ? existing.subscribedAt : input.now,
    unsubscribedAt: null,
    unsubscribedVia: null,
    unsubscribedBy: null,
  };
}

function csvField(value: string): string {
  const safe = FORMULA_LEADERS.includes(value.charAt(0)) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

/** The origin that hosts the unsubscribe page for a subscriber: one string, or chosen per source. */
export type UnsubscribeOrigin = string | ((source: string) => string);

// RFC 8058 one-click: the two header lines the external sender adds to each bulletin.
export function buildListUnsubscribeHeader(origin: string, token: string): string {
  return `List-Unsubscribe: <${origin}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>\n` +
    'List-Unsubscribe-Post: List-Unsubscribe=One-Click';
}

export function buildSubscribersCsv(rows: NewsletterCsvRow[], origin: UnsubscribeOrigin): string {
  const lines = rows.map((row) => {
    const rowOrigin = typeof origin === 'function' ? origin(row.source) : origin;
    return [
      csvField(row.email),
      csvField(row.source),
      csvField(row.subscribedAt ? row.subscribedAt.toISOString() : ''),
      csvField(`${rowOrigin}/newsletter/unsubscribe?token=${encodeURIComponent(row.unsubscribeToken)}`),
      csvField(subscriberTopics(row.topics, row.source === 'nos-footer' ? 'nos-footer' : 'saoc-footer').join(';')),
      csvField(buildListUnsubscribeHeader(rowOrigin, row.unsubscribeToken)),
    ].join(',');
  });
  return [CSV_HEADER, ...lines].join('\n');
}
