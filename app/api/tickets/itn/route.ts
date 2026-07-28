import { promises as dns } from 'node:dns';

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import {
  buildPayfastParamString,
  generateSignature,
  getClientIp,
  PAYFAST_ITN_HOSTS,
  PAYFAST_SANDBOX_VALIDATE_URL,
} from '@/lib/payfast';

/**
 * PayFast ITN (Instant Transaction Notification) handler — SECURITY BOUNDARY, FAIL CLOSED.
 *
 * PayFast POSTs application/x-www-form-urlencoded on payment completion. Every check
 * below must pass before a ticket is ever flipped to 'paid'. Any single failure logs
 * which check failed and leaves the ticket untouched — we still return HTTP 200 so
 * PayFast stops retrying (see https://developers.payfast.co.za/docs#step_4_confirm_payment),
 * but a 200 response here never implies the payment was accepted.
 *
 * Amount-match tolerance below ZAR 0.01 (fixed cents rounding, not a config).
 */
const AMOUNT_MATCH_TOLERANCE = 0.01;

const PAID_STATUS = 'paid';
const COMPLETE_STATUS = 'COMPLETE';

/**
 * Resolve PayFast's published ITN source hosts (www.payfast.co.za, sandbox.payfast.co.za,
 * w1w.payfast.co.za, w2w.payfast.co.za — see PAYFAST_ITN_HOSTS) via DNS at request time.
 * IPs are never hardcoded; PayFast rotates them.
 */
async function resolvePayfastIps(): Promise<Set<string>> {
  const ips = new Set<string>();
  await Promise.all(
    PAYFAST_ITN_HOSTS.map(async (host) => {
      try {
        const results = await dns.lookup(host, { all: true });
        for (const result of results) ips.add(result.address);
      } catch (error) {
        console.error(`[tickets/itn] DNS lookup failed for host ${host}:`, error);
      }
    })
  );
  return ips;
}

function parseOrderedFields(raw: string): { fields: Record<string, string>; signature: string | null } {
  const params = new URLSearchParams(raw);
  const fields: Record<string, string> = {};
  let signature: string | null = null;
  for (const [key, value] of params) {
    if (key === 'signature') {
      signature = value;
      continue;
    }
    fields[key] = value;
  }
  return { fields, signature };
}

/** Always 200 — PayFast must stop retrying regardless of validation outcome. */
function acknowledge(): NextResponse {
  return NextResponse.json({ received: true }, { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const { fields, signature: receivedSignature } = parseOrderedFields(rawBody);
  const mPaymentId = fields['m_payment_id'] ?? null;

  // 1. Signature — recompute over the fields AS RECEIVED, in received order, excluding
  // the posted 'signature' field, and compare to what PayFast sent.
  const passphrase = process.env.PAYFAST_SANDBOX_PASSPHRASE;
  const expectedSignature = generateSignature(fields, passphrase);
  if (!receivedSignature || expectedSignature !== receivedSignature) {
    console.error('[tickets/itn] Signature mismatch — rejecting ITN', { m_payment_id: mPaymentId });
    return acknowledge();
  }

  // 2. Source IP — request must originate from a resolved PayFast host
  // (www.payfast.co.za / sandbox.payfast.co.za / w1w.payfast.co.za / w2w.payfast.co.za).
  const clientIp = getClientIp(request);
  if (!clientIp) {
    console.error('[tickets/itn] Could not determine client IP — rejecting ITN', {
      m_payment_id: mPaymentId,
    });
    return acknowledge();
  }
  const validIps = await resolvePayfastIps();
  if (!validIps.has(clientIp)) {
    console.error('[tickets/itn] Source IP not in PayFast host set — rejecting ITN', {
      m_payment_id: mPaymentId,
      clientIp,
    });
    return acknowledge();
  }

  if (!mPaymentId) {
    console.error('[tickets/itn] Missing m_payment_id — rejecting ITN');
    return acknowledge();
  }

  let db: FirebaseFirestore.Firestore;
  try {
    initAdmin();
    db = getFirestore();
  } catch (error) {
    console.error('[tickets/itn] Firestore admin init failed — rejecting ITN', {
      m_payment_id: mPaymentId,
      error,
    });
    return acknowledge();
  }

  const snapshot = await db
    .collection('tickets')
    .where('m_payment_id', '==', mPaymentId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    console.error('[tickets/itn] No reserved ticket found for m_payment_id — rejecting ITN', {
      m_payment_id: mPaymentId,
    });
    return acknowledge();
  }

  const docRef = snapshot.docs[0].ref;
  const ticket = snapshot.docs[0].data();

  // Idempotency fast path (optimisation only, NOT the correctness guarantee): if this read
  // already shows 'paid', skip the amount check and the external server-confirm round-trip
  // for an obviously-duplicate notification. This read is not transactional and can be
  // stale under concurrent ITNs, so it must never be relied on for the actual write decision
  // — see the transactional idempotency check immediately before the final update below.
  if (ticket['status'] === PAID_STATUS) {
    return acknowledge();
  }

  // 3. Amount match — the reserved ticket's server-derived amount must match what
  // PayFast says was actually charged.
  const amountGross = fields['amount_gross'];
  const ticketAmount = Number(ticket['amount']);
  if (
    amountGross === undefined ||
    Number.isNaN(Number(amountGross)) ||
    Number.isNaN(ticketAmount) ||
    Math.abs(Number(amountGross) - ticketAmount) >= AMOUNT_MATCH_TOLERANCE
  ) {
    console.error('[tickets/itn] amount_gross does not match reserved ticket — rejecting ITN', {
      m_payment_id: mPaymentId,
      amountGross,
      ticketAmount,
    });
    return acknowledge();
  }

  // 4. Server confirmation — POST the received data back to PayFast's
  // https://sandbox.payfast.co.za/eng/query/validate endpoint and require the response
  // body to equal exactly 'VALID'.
  try {
    const confirmResponse = await fetch(PAYFAST_SANDBOX_VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildPayfastParamString(fields),
    });
    const confirmText = (await confirmResponse.text()).trim();
    if (confirmText !== 'VALID') {
      console.error('[tickets/itn] Server confirmation did not return VALID — rejecting ITN', {
        m_payment_id: mPaymentId,
        confirmStatus: confirmResponse.status,
      });
      return acknowledge();
    }
  } catch (error) {
    console.error('[tickets/itn] Server confirmation request failed — rejecting ITN', {
      m_payment_id: mPaymentId,
      error,
    });
    return acknowledge();
  }

  // All four checks passed. Only flip to 'paid' if PayFast also reports COMPLETE.
  if (fields['payment_status'] !== COMPLETE_STATUS) {
    console.error('[tickets/itn] payment_status is not COMPLETE — leaving ticket reserved', {
      m_payment_id: mPaymentId,
      payment_status: fields['payment_status'],
    });
    return acknowledge();
  }

  // 5. Atomic idempotent write. PayFast retries ITN delivery until it receives HTTP 200, and
  // can genuinely deliver the same valid notification twice in close succession. Without a
  // transaction, two concurrent valid ITNs for the same m_payment_id could both read
  // 'reserved' above before either writes, both pass every check, and both write — breaking
  // the "idempotent, at-most-once write" guarantee this handler promises. Wrapping the fresh
  // re-read + idempotency check + update in a single Firestore transaction closes that
  // window: whichever ITN commits first wins, and the loser's transaction is automatically
  // retried by the SDK against the winner's now-committed state, sees 'status: paid', and
  // no-ops instead of writing again. The external server-confirm HTTP call above intentionally
  // stays OUTSIDE this transaction — Firestore transactions must not wrap external network
  // calls (retries would re-issue them, and it would hold the transaction open for the
  // duration of the round-trip).
  try {
    await db.runTransaction(async (transaction) => {
      const freshSnapshot = await transaction.get(docRef);
      if (!freshSnapshot.exists) {
        console.error('[tickets/itn] Ticket disappeared before transactional write', {
          m_payment_id: mPaymentId,
        });
        return;
      }
      if (freshSnapshot.data()?.['status'] === PAID_STATUS) {
        // Idempotent no-op — this or a concurrent ITN already committed the paid write.
        return;
      }
      transaction.update(docRef, {
        status: PAID_STATUS,
        pf_payment_id: fields['pf_payment_id'] ?? null,
        purchasedAt: Timestamp.now(),
      });
    });
  } catch (error) {
    console.error('[tickets/itn] Transactional ticket update failed — leaving ticket untouched', {
      m_payment_id: mPaymentId,
      error,
    });
  }

  return acknowledge();
}
