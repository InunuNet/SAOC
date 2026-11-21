import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { lineItemsMatchExistingPositions } from '@/lib/checkout-reservation';
import { initAdmin } from '@/lib/firebase-admin';
import { ORDERS_COLLECTION } from '@/lib/orders';

const TICKETS_COLLECTION = 'tickets';
const RESERVED_STATUS = 'reserved';

/**
 * A stored, still-payable reservation that a rate-limited request is a genuine replay of. Every
 * field comes from Firestore, never from the request body.
 */
export interface StoredReplay {
  reference: string;
  amount: number;
  positions: { bookingRef: string; ticketType: string }[];
  expectedGatewayAmount: number | null;
  gateway: string;
}

export interface ReplayRequestLineItem {
  ticketType: string;
  attendeeEmail: string;
  chosenDay: string | null;
}

/**
 * Over-limit replay lookup (ticket-path hardening, checkout rate limit). The normal checkout
 * path does Sanity work and a full stock scan before it can tell a request is a replay, so a
 * rate-limited request must not enter it. Instead this does the whole replay decision from
 * Firestore alone: one query for the tickets under the idempotency key (at most MAX_LINE_ITEMS
 * documents; every position is needed to compare the payload as a multiset, exactly as the
 * normal replay branch does) and one read of the order they point at.
 *
 * Returns a replay only when the stored reservation is still payable (status reserved, not
 * expired) AND the request's line items (ticket type, attendee email, chosen day) are the same
 * multiset the key first created. Anything else, including a Firestore error, returns null so the
 * caller answers with the one generic 429 and the key's existence is not revealed.
 */
export async function findStoredReplay(
  idempotencyKey: string,
  requested: ReplayRequestLineItem[]
): Promise<StoredReplay | null> {
  try {
    const db = getFirestore(initAdmin());
    const tickets = await db
      .collection(TICKETS_COLLECTION)
      .where('idempotencyKey', '==', idempotencyKey)
      .get();
    if (tickets.empty) return null;

    const existing = tickets.docs.map((doc) => {
      const data = doc.data();
      return {
        ticketType: data['ticketType'] as string,
        attendeeEmail: data['attendeeEmail'] as string,
        chosenDay: (data['chosenDay'] as string | null | undefined) ?? null,
      };
    });
    if (!lineItemsMatchExistingPositions(requested, existing)) return null;

    const orderId = tickets.docs[0].data()['orderId'] as string | undefined;
    if (!orderId) return null;
    const orderDoc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    const order = orderDoc.exists ? orderDoc.data() : undefined;
    if (!order || order['status'] !== RESERVED_STATUS) return null;
    const expiresAt = order['expiresAt'];
    if (expiresAt instanceof Timestamp && expiresAt.toMillis() <= Date.now()) return null;

    const gateway = order['gateway'];
    const reference = order['m_payment_id'];
    const amount = order['amount'];
    if (typeof gateway !== 'string' || typeof reference !== 'string' || typeof amount !== 'number') {
      return null;
    }
    return {
      reference,
      amount,
      positions: tickets.docs.map((doc) => ({
        bookingRef: doc.id,
        ticketType: doc.data()['ticketType'] as string,
      })),
      expectedGatewayAmount: (order['expectedGatewayAmount'] as number | null | undefined) ?? null,
      gateway,
    };
  } catch (error) {
    console.error('[tickets/checkout] Over-limit replay lookup failed:', error);
    return null;
  }
}
