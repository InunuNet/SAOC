import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import { VENDOR_STAND_ORDERS_COLLECTION, buildVendorStandOrderRef } from '@/lib/vendor-stand-orders';
import { resolveVendorStandPrice } from '@/lib/vendor-stand-pricing';
import { verifyVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';
import { resolveProvider } from '@/lib/payments';
import { resolveActiveGateway } from '@/lib/payments/active-gateway';

/**
 * POST /api/vendors/stand-payment/initiate, body { token, boothSize } (mission
 * vendor-gated-registration-flow, M3/F30). See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "Initiate -- server-derived
 * amount, transactional idempotency" for the full decision record and step ordering, which is
 * load-bearing and must not be reordered.
 *
 * `amount` is ALWAYS resolveVendorStandPrice()'s return -- the request body's boothSize is the
 * ONLY vendor-supplied input, and it is never itself trusted as a price; nothing in this route
 * reads a body-supplied amount/price/zar field, and if the client sent one it is ignored (same
 * posture as the ticket checkout route ignoring a client-sent providerId).
 */
const GENERIC_TOKEN_MESSAGE = 'This payment link is no longer valid.';
const ALREADY_PAID_MESSAGE = 'This stand has already been paid for.';
const PRICING_NOT_CONFIRMED_MESSAGE =
  'Stand pricing has not yet been confirmed by the Show Organising Committee. Payment is not available yet.';
const GATEWAY_NOT_CONFIGURED_MESSAGE = 'Payment gateway is not configured. Please try again later.';

const DEFAULT_SITE_URL = 'https://saoc.co.za';

function resolveSiteUrl(): string {
  return process.env.SITE_URL?.trim().replace(/\/+$/, '') || DEFAULT_SITE_URL;
}

/** Each provider's own NotifyUrl path for THIS payment surface -- deliberately distinct from
 *  the ticket checkout route's own NOTIFY_PATH_BY_PROVIDER_ID, since a stand-order settlement
 *  and a ticket settlement are different collections with different notification handlers. */
const NOTIFY_PATH_BY_PROVIDER_ID: Readonly<Record<string, string>> = {
  payfast: '/api/vendors/stand-payment/payfast-itn',
  ozow: '/api/vendors/stand-payment/ozow-itn',
};

function genericTokenRefusal(): NextResponse {
  return NextResponse.json({ error: GENERIC_TOKEN_MESSAGE }, { status: 403 });
}

interface InitiateRequestBody {
  token?: unknown;
  boothSize?: unknown;
}

function isValidBoothSizeInput(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: InitiateRequestBody;
  try {
    body = (await request.json()) as InitiateRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || typeof body.token !== 'string' || !body.token) {
    return genericTokenRefusal();
  }

  const secret = process.env.VENDOR_STAND_PAYMENT_TOKEN_SECRET;
  if (!secret) {
    console.error(
      '[vendors/stand-payment/initiate] VENDOR_STAND_PAYMENT_TOKEN_SECRET is unset; refusing all stand payments.',
    );
    return genericTokenRefusal();
  }

  const now = new Date();
  const verification = verifyVendorStandPaymentToken({ token: body.token, secret, now });
  if (!verification.ok) {
    return genericTokenRefusal();
  }

  const vendorSubmissionId = verification.vendorSubmissionId;

  const db = getFirestore(initAdmin());
  const submissionRef = db.collection(VENDOR_SUBMISSIONS_COLLECTION).doc(vendorSubmissionId);
  const submissionSnapshot = await submissionRef.get();
  if (!submissionSnapshot.exists) {
    return genericTokenRefusal();
  }
  const submissionData = submissionSnapshot.data() ?? {};
  // Re-checked fresh here, never trusting a state snapshot implied by the token being
  // cryptographically valid -- see the golden's "Token mechanism".
  if (submissionData.status !== 'approved') {
    return genericTokenRefusal();
  }

  const standOrderRef = db.collection(VENDOR_STAND_ORDERS_COLLECTION).doc(vendorSubmissionId);

  // Also refused with the SAME generic message the "not approved" case uses would blur two
  // distinct failure classes together -- A62 requires the "already paid" refusal to be
  // diagnosably distinct, so this check gets its own message below rather than folding into
  // genericTokenRefusal().
  const existingOrderSnapshot = await standOrderRef.get();
  if (existingOrderSnapshot.exists && existingOrderSnapshot.data()?.status === 'paid') {
    return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
  }

  if (!isValidBoothSizeInput(body.boothSize)) {
    return NextResponse.json({ error: 'boothSize must be 1, 2, or 3.' }, { status: 400 });
  }
  const boothSize = body.boothSize;

  // The ONLY source of `amount` in this route. Refuses BEFORE any Firestore write or gateway
  // call when Council has not yet confirmed a real ZAR figure -- see
  // lib/vendor-stand-pricing.ts and the golden's "The missing-figure problem".
  const priceResolution = resolveVendorStandPrice(boothSize);
  if (!priceResolution.ok) {
    if (priceResolution.reason === 'not-configured') {
      console.error(
        '[vendors/stand-payment/initiate] Stand pricing is not yet configured; refusing before any write.',
      );
      return NextResponse.json({ error: PRICING_NOT_CONFIRMED_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: 'boothSize must be 1, 2, or 3.' }, { status: 400 });
  }
  const amount = priceResolution.amount;

  const activeGateway = await resolveActiveGateway();
  if (!activeGateway) {
    console.error('[vendors/stand-payment/initiate] No active payment gateway is configured.');
    return NextResponse.json({ error: GATEWAY_NOT_CONFIGURED_MESSAGE }, { status: 500 });
  }
  const paymentProvider = resolveProvider(activeGateway);
  if (!paymentProvider) {
    console.error('[vendors/stand-payment/initiate] Active gateway id does not resolve to a provider.');
    return NextResponse.json({ error: GATEWAY_NOT_CONFIGURED_MESSAGE }, { status: 500 });
  }

  let readiness;
  try {
    readiness = paymentProvider.readiness('initiate');
  } catch (error) {
    console.error('[vendors/stand-payment/initiate] Payment provider readiness probe threw:', error);
    readiness = { ready: false as const, reason: 'not-configured' as const, missing: [] as string[] };
  }
  if (!readiness.ready) {
    console.error('[vendors/stand-payment/initiate] Payment gateway is not configured.', {
      reason: readiness.reason,
      missing: readiness.missing,
    });
    return NextResponse.json({ error: GATEWAY_NOT_CONFIGURED_MESSAGE }, { status: 500 });
  }

  const standOrderRefValue = buildVendorStandOrderRef(vendorSubmissionId);

  // ONE Firestore transaction: re-read (a document that reached 'paid' between the earlier
  // read above and here must still be refused), then .set() -- create-or-overwrite -- never
  // .update(). A re-initiate before payment legitimately overwrites the prior pending attempt;
  // an already-'paid' order is refused and left completely unmodified.
  const transactionResult = await db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(standOrderRef);
    if (orderSnapshot.exists && orderSnapshot.data()?.status === 'paid') {
      return { ok: false as const };
    }

    transaction.set(standOrderRef, {
      id: vendorSubmissionId,
      vendorSubmissionId,
      businessName: submissionData.businessName ?? '',
      contactEmail: submissionData.contactEmail ?? '',
      boothSize,
      amount,
      status: 'pending',
      gateway: activeGateway,
      gatewayPaymentId: null,
      standOrderRef: standOrderRefValue,
      createdAt: Timestamp.now(),
      paidAt: null,
      failedAt: null,
    });
    return { ok: true as const };
  });

  if (!transactionResult.ok) {
    return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
  }

  const siteUrl = resolveSiteUrl();
  const initiation = await paymentProvider.initiate({
    reference: standOrderRefValue,
    amountFormatted: amount.toFixed(2),
    itemName: `SAOC National Show — Vendor Stand (${submissionData.businessName ?? ''})`,
    returnUrl: `${siteUrl}/national-show/vendors/payment?token=${encodeURIComponent(body.token)}&paid=1`,
    cancelUrl: `${siteUrl}/national-show/vendors/payment?token=${encodeURIComponent(body.token)}`,
    notifyUrl: `${siteUrl}${NOTIFY_PATH_BY_PROVIDER_ID[activeGateway]}`,
  });

  if (!initiation.ok) {
    const refusal: 'not-configured' = initiation.reason;
    console.error('[vendors/stand-payment/initiate] Payment provider refused the hand-off', {
      standOrderRef: standOrderRefValue,
      reason: refusal,
    });
    return NextResponse.json({ error: GATEWAY_NOT_CONFIGURED_MESSAGE }, { status: 500 });
  }

  return NextResponse.json({
    processUrl: initiation.processUrl,
    fields: initiation.fields,
    amount: amount.toFixed(2),
    providerId: activeGateway,
  });
}
