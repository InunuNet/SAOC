import {
  NEWSLETTER_REMOVAL_VIAS,
  NEWSLETTER_TOPICS,
  type NewsletterRemovalVia,
  type NewsletterStatus,
  type NewsletterTopic,
  type NewsletterTopicRemoval,
} from './newsletter-topics';

/**
 * Pure topic-preference rules (mission newsletter-topics-unsub). No firebase-admin import: the
 * patches built here are the only place a subscriber document is turned `unsubscribed`, and
 * lib/newsletter-store.ts applies them inside a transaction. Patches never carry `undefined`
 * (docs/firestore-undefined-write-safety.md) and nothing here ever deletes a document.
 */

export type NewsletterListFilter = 'all' | NewsletterTopic;
export type NewsletterStatusFilter = NewsletterStatus | 'all';

export const NEWSLETTER_LIST_FILTERS: readonly NewsletterListFilter[] = ['all', ...NEWSLETTER_TOPICS];
export const NEWSLETTER_STATUS_FILTERS: readonly NewsletterStatusFilter[] = ['all', 'subscribed', 'unsubscribed'];

const EMAIL_MASK = '•••';
const NOS_FOOTER_SOURCE = 'nos-footer';

/** The fields of a stored subscriber the rules read; any may be absent on a legacy document. */
export interface TopicDocInput {
  status: string;
  source?: string;
  topics?: unknown;
  topicRemovals?: unknown;
  restoreTopics?: unknown;
}

export interface RemovalAudit {
  via: NewsletterRemovalVia;
  by?: string | null;
  now: Date;
}

export interface TopicPatch {
  topics: NewsletterTopic[];
  topicRemovals?: unknown[];
  status?: NewsletterStatus;
  restoreTopics?: NewsletterTopic[];
  unsubscribedAt?: Date | null;
  unsubscribedVia?: NewsletterRemovalVia | null;
  unsubscribedBy?: string | null;
}

export type TopicPreferencesOutcome =
  | { ok: false }
  | { ok: true; action: 'unsubscribe-all' }
  | { ok: true; action: 'set-topics'; remove: NewsletterTopic[]; add: NewsletterTopic[] };

function isTopic(value: unknown): value is NewsletterTopic {
  return typeof value === 'string' && (NEWSLETTER_TOPICS as readonly string[]).includes(value);
}

function inCanonicalOrder(topics: readonly NewsletterTopic[]): NewsletterTopic[] {
  return NEWSLETTER_TOPICS.filter((topic) => topics.includes(topic));
}

/** A non-array value derives from the source (legacy); an array, even `[]`, is honoured. */
export function topicsForRow(topics: unknown, source: string): NewsletterTopic[] {
  if (!Array.isArray(topics)) return [source === NOS_FOOTER_SOURCE ? 'nos' : 'saoc'];
  return NEWSLETTER_TOPICS.filter((topic) => topics.includes(topic));
}

function heldTopics(doc: TopicDocInput): NewsletterTopic[] {
  if (doc.status === 'unsubscribed') return [];
  return topicsForRow(doc.topics, doc.source ?? '');
}

function historyOf(doc: TopicDocInput): unknown[] {
  return Array.isArray(doc.topicRemovals) ? doc.topicRemovals : [];
}

function removalTopics(history: readonly unknown[]): NewsletterTopic[] {
  const named = history.map((entry) =>
    typeof entry === 'object' && entry !== null ? (entry as { topic?: unknown }).topic : undefined);
  return inCanonicalOrder(named.filter(isTopic));
}

function resolveAuditBy(audit: RemovalAudit): string | null {
  if (audit.via !== 'admin') return null;
  const by = typeof audit.by === 'string' ? audit.by.trim() : '';
  if (by === '') throw new Error('an admin removal must name the admin who made it');
  return by;
}

/** The patch that takes topics off an address, or null when it holds none of them. */
export function applyTopicRemoval(
  doc: TopicDocInput,
  remove: readonly NewsletterTopic[] | 'all',
  audit: RemovalAudit,
): TopicPatch | null {
  if (!NEWSLETTER_REMOVAL_VIAS.includes(audit.via)) throw new Error('unknown removal channel');
  const by = resolveAuditBy(audit);
  const held = heldTopics(doc);
  const removed = remove === 'all' ? held : held.filter((topic) => remove.includes(topic));
  if (removed.length === 0) return null;

  const remaining = held.filter((topic) => !removed.includes(topic));
  const entries: NewsletterTopicRemoval[] = removed.map((topic) => ({
    topic,
    removedAt: audit.now,
    via: audit.via,
    by,
  }));
  const topicRemovals = [...historyOf(doc), ...entries];
  if (remaining.length > 0) return { status: 'subscribed', topics: remaining, topicRemovals };
  return {
    status: 'unsubscribed',
    topics: [],
    topicRemovals,
    restoreTopics: held,
    unsubscribedAt: audit.now,
    unsubscribedVia: audit.via,
    unsubscribedBy: by,
  };
}

/** The patch that puts topics back (union, canonical order) and clears the doc-level audit. */
export function applyTopicAdd(doc: TopicDocInput, add: readonly NewsletterTopic[]): TopicPatch | null {
  const held = heldTopics(doc);
  if (!add.some((topic) => !held.includes(topic))) return null;
  return {
    status: 'subscribed',
    topics: inCanonicalOrder([...held, ...add]),
    restoreTopics: [],
    unsubscribedAt: null,
    unsubscribedVia: null,
    unsubscribedBy: null,
  };
}

/** The patch behind "Subscribe again": the topics held just before the last one went. */
export function applyRestore(doc: TopicDocInput): TopicPatch | null {
  if (doc.status !== 'unsubscribed' || !Array.isArray(doc.restoreTopics)) return null;
  const restore = inCanonicalOrder(doc.restoreTopics.filter(isTopic));
  if (restore.length === 0) return null;
  return {
    status: 'subscribed',
    topics: restore,
    restoreTopics: [],
    unsubscribedAt: null,
    unsubscribedVia: null,
    unsubscribedBy: null,
  };
}

/**
 * Turns the preferences form's selection into removals and additions. A bearer link may re-add a
 * topic the address previously held (it appears in `previous`), never one it never held.
 */
export function applyTopicPreferences(
  held: readonly NewsletterTopic[],
  previous: readonly NewsletterTopic[],
  selected: unknown,
): TopicPreferencesOutcome {
  if (!Array.isArray(selected) || !selected.every(isTopic) || new Set(selected).size !== selected.length) {
    return { ok: false };
  }
  const allowed = new Set<NewsletterTopic>([...held, ...previous]);
  if (selected.some((topic) => !allowed.has(topic))) return { ok: false };
  if (selected.length === 0) return { ok: true, action: 'unsubscribe-all' };
  return {
    ok: true,
    action: 'set-topics',
    remove: held.filter((topic) => !selected.includes(topic)),
    add: inCanonicalOrder(selected.filter((topic) => !held.includes(topic))),
  };
}

export interface ListRow {
  status: string;
  source?: string;
  topics?: unknown;
  topicRemovals?: unknown;
  restoreTopics?: unknown;
}

/** Every list the row has ever been on: current topics, removed topics and topics held before. */
export function rowLists(row: ListRow): NewsletterTopic[] {
  const restorable = Array.isArray(row.restoreTopics) ? row.restoreTopics.filter(isTopic) : [];
  const current = Array.isArray(row.topics) ? topicsForRow(row.topics, '') : [];
  const derived = Array.isArray(row.topics) ? [] : topicsForRow(undefined, row.source ?? '');
  return inCanonicalOrder([...current, ...derived, ...removalTopics(historyOf(row)), ...restorable]);
}

/** Under a specific list a row is subscribed iff it currently holds that topic; under all, its doc status applies. */
export function rowMatches(row: ListRow, list: NewsletterListFilter, status: NewsletterStatusFilter): boolean {
  if (list === 'all') return status === 'all' || row.status === status;
  if (!rowLists(row).includes(list)) return false;
  const holds = heldTopics(row).includes(list);
  if (status === 'all') return true;
  return status === 'subscribed' ? holds : !holds;
}

export function listCounts(
  rows: readonly ListRow[],
  status: NewsletterStatusFilter,
): Record<NewsletterListFilter, number> {
  const counts: Record<NewsletterListFilter, number> = { all: 0, saoc: 0, nos: 0 };
  for (const list of NEWSLETTER_LIST_FILTERS) {
    counts[list] = rows.filter((row) => rowMatches(row, list, status)).length;
  }
  return counts;
}

export function maskEmailForDisplay(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return EMAIL_MASK;
  return `${email.charAt(0)}${EMAIL_MASK}${email.slice(at)}`;
}
