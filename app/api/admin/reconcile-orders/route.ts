import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';

import { constantTimeEqual } from '@/lib/recovery-token';
import {
  findStrandedOrders,
  filterOrdersNeedingAlert,
  markOrdersAlerted,
  sendReconciliationAlert,
} from '@/lib/reconciliation';

/**
 * order-reconciliation F1 — POST /api/admin/reconcile-orders.
 *
 * Cloud Scheduler-triggered (infra wiring documented by @docs, not gated by this repo): finds
 * orders stranded `status == 'reserved'` past their `expiresAt`, emails a human, and marks them
 * `reconciliationAlertedAt` — ONLY after the email send succeeds, so a failed send retries on
 * the next run rather than being silently marked-without-sending.
 *
 * HARD BOUNDARY, structurally enforced: this file never imports
 * `markOrderAndPositionPaidByPaymentId` (the only function in this codebase that can flip an
 * order's `status` to `'paid'`) and makes no PayFast HTTP call of any kind. It flags stranded
 * orders for a human to investigate; it never auto-settles one. See
 * .agent/memory/project/specs/order-reconciliation/goldens/README.md "Recovery — deliberately
 * NOT built in this contract".
 *
 * Auth: `Authorization: Bearer <RECONCILIATION_CRON_SECRET>`, timing-safe compared, fail-closed
 * (401) on a missing env var, a missing header, or a wrong secret — same posture as the ITN
 * route's passphrase guard (app/api/tickets/itn/route.ts).
 */

const BEARER_PREFIX = 'Bearer ';

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/** Extracts the bearer token from the Authorization header, or null if absent/malformed. */
function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Fail closed if the secret itself is unset — an unset secret must never be treated as "no
  // auth required", same posture as the ITN route's PAYFAST_SANDBOX_PASSPHRASE guard.
  const expectedSecret = process.env.RECONCILIATION_CRON_SECRET;
  if (!expectedSecret) {
    console.error('[admin/reconcile-orders] Missing RECONCILIATION_CRON_SECRET env var — rejecting');
    return unauthorized();
  }

  const providedToken = extractBearerToken(request);
  if (!providedToken) {
    return unauthorized();
  }

  const providedBuffer = Buffer.from(providedToken, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  if (!constantTimeEqual(providedBuffer, expectedBuffer)) {
    console.error('[admin/reconcile-orders] Bearer secret mismatch — rejecting');
    return unauthorized();
  }

  const now = Timestamp.now();

  let stranded;
  try {
    stranded = await findStrandedOrders(now);
  } catch (error) {
    console.error('[admin/reconcile-orders] findStrandedOrders failed', { error });
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 });
  }

  const needingAlert = filterOrdersNeedingAlert(stranded, now);
  const skippedRecentlyAlerted = stranded
    .filter((order) => !needingAlert.includes(order))
    .map((order) => order.orderId);

  if (needingAlert.length === 0) {
    return NextResponse.json(
      { alertedNow: [], skippedRecentlyAlerted, strandedCount: stranded.length },
      { status: 200 }
    );
  }

  try {
    await sendReconciliationAlert(needingAlert);
  } catch (error) {
    // Never mark-alerted without a successful send — the next scheduled run will retry.
    console.error('[admin/reconcile-orders] sendReconciliationAlert failed — not marking alerted', {
      error,
      orderIds: needingAlert.map((order) => order.orderId),
    });
    return NextResponse.json({ error: 'Alert email failed to send' }, { status: 502 });
  }

  const alertedOrderIds = needingAlert.map((order) => order.orderId);
  try {
    await markOrdersAlerted(alertedOrderIds, now);
  } catch (error) {
    // The email already sent successfully — a bookkeeping-write failure here means the next
    // run may re-alert on these orders sooner than RE_ALERT_WINDOW_MS. Logged, not fatal:
    // a duplicate alert email is far preferable to a silently-dropped one.
    console.error('[admin/reconcile-orders] markOrdersAlerted failed after a successful send', {
      error,
      orderIds: alertedOrderIds,
    });
  }

  return NextResponse.json(
    { alertedNow: alertedOrderIds, skippedRecentlyAlerted, strandedCount: stranded.length },
    { status: 200 }
  );
}
