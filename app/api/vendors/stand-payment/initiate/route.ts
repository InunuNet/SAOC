import { randomBytes } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

import { initAdmin } from '@/lib/firebase-admin';
import { VENDOR_SUBMISSIONS_COLLECTION } from '@/lib/vendor-submissions';
import {
  VENDOR_STAND_ORDERS_COLLECTION,
  buildVendorStandOrderRef,
  buildVendorStandOrderReference,
} from '@/lib/vendor-stand-orders';
import { deriveVendorStandEarlyBirdCutoffIso, resolveVendorStandPrice } from '@/lib/vendor-stand-pricing';
import { verifyVendorStandPaymentToken } from '@/lib/vendor-stand-payment-token';
import { resolveProvider } from '@/lib/payments';
import { resolveActiveGateway } from '@/lib/payments/active-gateway';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

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

  // Cutoff is derived fresh, server-side, from the active show's real Sanity-published start
  // date -- never a client-supplied value, never a hardcoded literal. See
  // contracts/golden/vendor-stand-early-bird-pricing/README.md "Where showStartDate comes
  // from". `now` is the SAME identifier already derived from `new Date()` above for
  // token-expiry verification -- never a second clock read.
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  const showWindow = lookupShowWindow(NATIONAL_SHOW_ID);
  const cutoffIso = showWindow ? deriveVendorStandEarlyBirdCutoffIso(showWindow.startDate) : null;

  // The ONLY source of `amount` in this route. Refuses BEFORE any Firestore write or gateway
  // call when the cutoff cannot be derived (no active show configured) -- see
  // lib/vendor-stand-pricing.ts and the golden's "Refuse-on-missing-cutoff".
  const priceResolution = resolveVendorStandPrice(boothSize, now, cutoffIso);
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
  const tier = priceResolution.tier;

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
  // F3 (vendor-stand-payment-confirm-gate) -- a fresh, unguessable id minted per payment
  // attempt (never reused across re-initiates), stored on the order doc AND threaded through
  // the reference handed to the gateway (buildVendorStandOrderReference below), so the
  // settlement handler can tell this attempt apart from an earlier, abandoned one for the same
  // vendor submission. See the golden README's "F3" for the full decision record.
  //
  // F7 (vendor-stand-payment-confirm-gate) -- 16 hex characters (64 bits) of cryptographically
  // random entropy, NOT a truncated crypto.randomUUID() (a v4 UUID string's fixed version/
  // variant nibbles mean a naive substring slices across them, silently reducing real entropy
  // below the character count). The full reference (VSO- + 20-char Firestore auto id + :: +
  // this 16-char correlator = 42 chars) must stay within Ozow's documented 50-char
  // TransactionReference cap with margin (A13 requires <=45 total) -- see the golden README's
  // "F7" for why 64 bits is more than adequate here: this correlator only needs to distinguish
  // a handful of attempts on a SINGLE vendor submission, and it is not a secret or an
  // authentication token (F1's gateway confirm and provider signature verification are what
  // authenticate a notification), so collision probability at this project's realistic
  // concurrent-attempt volumes is negligible.
  const ATTEMPT_ID_ENTROPY_BYTES = 8;
  const attemptId = randomBytes(ATTEMPT_ID_ENTROPY_BYTES).toString('hex');
  const attemptReference = buildVendorStandOrderReference(vendorSubmissionId, attemptId);

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
      tier,
      status: 'pending',
      gateway: activeGateway,
      gatewayPaymentId: null,
      standOrderRef: standOrderRefValue,
      attemptId,
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
    reference: attemptReference,
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
