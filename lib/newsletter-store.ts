import { getFirestore, Timestamp, type DocumentData, type Transaction } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { subscriberTopics, type NewsletterSubscriberDoc } from '@/lib/newsletter';
import type { NewsletterSubscriber } from '@/types/index';

/**
 * Firestore adapter for `newsletterSubscribers` (Admin SDK only; no client rules). The
 * handlers in lib/newsletter-handler.ts never touch Firestore directly.
 */

export const NEWSLETTER_SUBSCRIBERS_COLLECTION = 'newsletterSubscribers';

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toSubscriber(id: string, data: DocumentData): NewsletterSubscriber {
  return {
    id,
    email: String(data['email'] ?? ''),
    status: data['status'] === 'unsubscribed' ? 'unsubscribed' : 'subscribed',
    source: data['source'] === 'nos-footer' ? 'nos-footer' : 'saoc-footer',
    topics: subscriberTopics(data['topics'], data['source'] === 'nos-footer' ? 'nos-footer' : 'saoc-footer'),
    subscribedAt: toDate(data['subscribedAt']),
    unsubscribedAt: toDate(data['unsubscribedAt']),
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
    subscribedAt: subscriber.subscribedAt,
    unsubscribedAt: subscriber.unsubscribedAt,
    unsubscribeToken: subscriber.unsubscribeToken,
  };
}

export function subscriberRef(id: string) {
  return collection().doc(id);
}

/** Pass the surrounding transaction so the lookup and the later update are one atomic unit. */
export async function findSubscriberByToken(
  token: string,
  tx?: Transaction,
): Promise<{ id: string; status: 'subscribed' | 'unsubscribed' } | null> {
  const query = collection().where('unsubscribeToken', '==', token).limit(1);
  const snapshot = tx ? await tx.get(query) : await query.get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  return { id: doc.id, status: doc.data()['status'] === 'unsubscribed' ? 'unsubscribed' : 'subscribed' };
}

export async function markSubscriberUnsubscribed(
  id: string,
  now: Date,
  tx?: Transaction,
): Promise<void> {
  const update = { status: 'unsubscribed', unsubscribedAt: now };
  if (tx) {
    tx.update(collection().doc(id), update);
    return;
  }
  await collection().doc(id).update(update);
}

export async function listAllSubscribers(): Promise<NewsletterSubscriber[]> {
  const snapshot = await collection().get();
  return snapshot.docs.map((doc) => toSubscriber(doc.id, doc.data()));
}
