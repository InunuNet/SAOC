import { getFirestore, Timestamp, type DocumentData, type Transaction } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  NEWSLETTER_REMOVAL_VIAS,
  NEWSLETTER_TOPICS,
  subscriberTopics,
  type NewsletterRemovalVia,
  type NewsletterSource,
  type NewsletterSubscriberDoc,
  type NewsletterTopic,
} from '@/lib/newsletter';
import {
  applyRestore,
  applyTopicAdd,
  applyTopicRemoval,
  type RemovalAudit,
  type TopicDocInput,
  type TopicPatch,
} from '@/lib/newsletter-preferences';
import type { NewsletterSubscriber } from '@/types/index';

/**
 * Firestore adapter for `newsletterSubscribers` (Admin SDK only; no client rules). The
 * handlers in lib/newsletter-handler.ts never touch Firestore directly. Every change to a
 * subscriber's topics or status goes through the three transactional writers below
 * (removeSubscriberTopics, addSubscriberTopics, restoreSubscriber), which apply the pure patches
 * from lib/newsletter-preferences.ts. Nothing here ever deletes a document: the record is kept
 * for POPIA.
 */

export const NEWSLETTER_SUBSCRIBERS_COLLECTION = 'newsletterSubscribers';

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  return value instanceof Date ? value : null;
}

function sourceOf(data: DocumentData): NewsletterSource {
  return data['source'] === 'nos-footer' ? 'nos-footer' : 'saoc-footer';
}

function topicList(value: unknown): NewsletterTopic[] {
  return Array.isArray(value) ? NEWSLETTER_TOPICS.filter((topic) => value.includes(topic)) : [];
}

function viaOf(value: unknown): NewsletterRemovalVia | null {
  return NEWSLETTER_REMOVAL_VIAS.find((via) => via === value) ?? null;
}

function removalsOf(value: unknown): NewsletterSubscriber['topicRemovals'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): NewsletterSubscriber['topicRemovals'] => {
    const record: DocumentData = typeof entry === 'object' && entry !== null ? entry : {};
    const via = viaOf(record['via']);
    const topic = NEWSLETTER_TOPICS.find((candidate) => candidate === record['topic']);
    if (!topic || !via) return [];
    return [{
      topic,
      removedAt: toDate(record['removedAt']),
      via,
      by: typeof record['by'] === 'string' ? record['by'] : null,
    }];
  });
}

/** A legacy unsubscribed document (no `restoreTopics`) restores the topics it still carries. */
function restoreTopicsOf(data: DocumentData): NewsletterTopic[] {
  if (Array.isArray(data['restoreTopics'])) return topicList(data['restoreTopics']);
  if (data['status'] !== 'unsubscribed') return [];
  return subscriberTopics(data['topics'], sourceOf(data));
}

function toSubscriber(id: string, data: DocumentData): NewsletterSubscriber {
  const status = data['status'] === 'unsubscribed' ? 'unsubscribed' : 'subscribed';
  return {
    id,
    email: String(data['email'] ?? ''),
    status,
    source: sourceOf(data),
    topics: status === 'unsubscribed' ? [] : subscriberTopics(data['topics'], sourceOf(data)),
    topicRemovals: removalsOf(data['topicRemovals']),
    restoreTopics: restoreTopicsOf(data),
    subscribedAt: toDate(data['subscribedAt']),
    unsubscribedAt: toDate(data['unsubscribedAt']),
    unsubscribedVia: viaOf(data['unsubscribedVia']),
    unsubscribedBy: typeof data['unsubscribedBy'] === 'string' ? data['unsubscribedBy'] : null,
    unsubscribeToken: String(data['unsubscribeToken'] ?? ''),
  };
}

function collection() {
  return getFirestore(initAdmin()).collection(NEWSLETTER_SUBSCRIBERS_COLLECTION);
}

export function toSubscriberDoc(data: DocumentData): NewsletterSubscriberDoc | null {
  const subscriber = toSubscriber('', data);
  if (subscriber.subscribedAt === null) return null;
  return {
    email: subscriber.email,
    status: subscriber.status,
    source: subscriber.source,
    topics: subscriber.topics,
    topicRemovals: subscriber.topicRemovals.flatMap((entry) =>
      entry.removedAt ? [{ ...entry, removedAt: entry.removedAt }] : []),
    restoreTopics: subscriber.restoreTopics,
    subscribedAt: subscriber.subscribedAt,
    unsubscribedAt: subscriber.unsubscribedAt,
    unsubscribedVia: subscriber.unsubscribedVia,
    unsubscribedBy: subscriber.unsubscribedBy,
    unsubscribeToken: subscriber.unsubscribeToken,
  };
}

export function subscriberRef(id: string) {
  return collection().doc(id);
}

/**
 * A transaction plus the documents it has read or staged this attempt. Firestore forbids a read
 * after a write inside one transaction, so a request that changes the same address twice (add a
 * topic, then remove another) reads it once and layers each patch over that read. Build a fresh
 * one at the top of every transaction callback: a retry re-runs the callback and must re-read.
 */
export interface NewsletterTx {
  tx: Transaction;
  docs: Map<string, DocumentData | null>;
}

export function newsletterTx(tx: Transaction): NewsletterTx {
  return { tx, docs: new Map() };
}

async function readDoc(ntx: NewsletterTx, id: string): Promise<DocumentData | null> {
  if (!ntx.docs.has(id)) {
    const snapshot = await ntx.tx.get(subscriberRef(id));
    ntx.docs.set(id, snapshot.exists ? (snapshot.data() ?? {}) : null);
  }
  return ntx.docs.get(id) ?? null;
}

function stagePatch(ntx: NewsletterTx, id: string, current: DocumentData, patch: TopicPatch): void {
  ntx.tx.update(subscriberRef(id), { ...patch });
  ntx.docs.set(id, { ...current, ...patch });
}

function toTopicDoc(data: DocumentData): TopicDocInput {
  const subscriber = toSubscriber('', data);
  return {
    status: subscriber.status,
    source: subscriber.source,
    // A legacy active document keeps its absent `topics` so the pure rules derive from source.
    topics: Array.isArray(data['topics']) ? subscriber.topics : undefined,
    topicRemovals: subscriber.topicRemovals,
    restoreTopics: subscriber.restoreTopics,
  };
}

export interface TokenLookup {
  id: string;
  email: string;
  status: 'subscribed' | 'unsubscribed';
  topics: NewsletterTopic[];
  restoreTopics: NewsletterTopic[];
  previousTopics: NewsletterTopic[];
}

function toTokenLookup(id: string, data: DocumentData): TokenLookup {
  const subscriber = toSubscriber(id, data);
  return {
    id,
    email: subscriber.email,
    status: subscriber.status,
    topics: subscriber.topics,
    restoreTopics: subscriber.restoreTopics,
    previousTopics: NEWSLETTER_TOPICS.filter((topic) =>
      subscriber.topicRemovals.some((entry) => entry.topic === topic)),
  };
}

/** Pass the surrounding transaction so the lookup and the later update are one atomic unit. */
export async function findSubscriberByToken(token: string, ntx?: NewsletterTx): Promise<TokenLookup | null> {
  const query = collection().where('unsubscribeToken', '==', token).limit(1);
  const snapshot = ntx ? await ntx.tx.get(query) : await query.get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data();
  ntx?.docs.set(doc.id, data);
  return toTokenLookup(doc.id, data);
}

export async function findSubscriberById(
  id: string,
  ntx: NewsletterTx,
): Promise<{ status: 'subscribed' | 'unsubscribed'; topics: NewsletterTopic[] } | null> {
  const data = await readDoc(ntx, id);
  if (data === null) return null;
  const subscriber = toSubscriber(id, data);
  return { status: subscriber.status, topics: subscriber.topics };
}

/**
 * The one writer of `topicRemovals` and of `status: 'unsubscribed'`. Reads the document inside the
 * transaction, builds the patch with the pure rules and updates it, or writes nothing when the
 * address holds none of the topics (an absent document is a no-op too).
 */
export async function removeSubscriberTopics(
  id: string,
  remove: readonly NewsletterTopic[] | 'all',
  audit: RemovalAudit,
  ntx: NewsletterTx,
): Promise<void> {
  const data = await readDoc(ntx, id);
  if (data === null) return;
  const patch = applyTopicRemoval(toTopicDoc(data), remove, audit);
  if (patch) stagePatch(ntx, id, data, patch);
}

/** Puts back topics the address held before; never creates a subscription out of nothing. */
export async function addSubscriberTopics(
  id: string,
  add: readonly NewsletterTopic[],
  ntx: NewsletterTx,
): Promise<void> {
  const data = await readDoc(ntx, id);
  if (data === null) return;
  const patch = applyTopicAdd(toTopicDoc(data), add);
  if (patch) stagePatch(ntx, id, data, patch);
}

/** "Subscribe again": the topics held just before the last one went. */
export async function restoreSubscriber(id: string, ntx: NewsletterTx): Promise<void> {
  const data = await readDoc(ntx, id);
  if (data === null) return;
  const patch = applyRestore(toTopicDoc(data));
  if (patch) stagePatch(ntx, id, data, patch);
}

export async function listAllSubscribers(): Promise<NewsletterSubscriber[]> {
  const snapshot = await collection().get();
  return snapshot.docs.map((doc) => toSubscriber(doc.id, doc.data()));
}
