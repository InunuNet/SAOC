import type { VendorSubmission, VendorSubmissionStatus } from '@/types/index';

/**
 * F30 (launch-weekend) -- public Exhibitors and Vendors listing. Pure module: the eligibility
 * predicate, the allowlisted projection and the create-once publish step. The Sanity write
 * client is injected (see lib/vendor-listing-sanity.ts) so this file imports no SDK.
 *
 * Sanity is the source of truth after first publication: publish creates the document only
 * when neither the published document nor its Studio draft exists, and never refreshes it.
 */

/** Documentation constant; the basis itself lives only in isVendorListingEligible. */
export const LISTING_ELIGIBILITY_BASIS = 'approved';

const LISTING_DOCUMENT_TYPE = 'vendorNursery';
const DRAFT_ID_PREFIX = 'drafts.';
const ALLOWED_WEBSITE_PROTOCOLS: readonly string[] = ['http:', 'https:'];

export interface VendorListingEligibilityInput {
  status: VendorSubmissionStatus | string;
  paymentReceived?: boolean;
  standOrderStatus?: string | null;
}

/** The ONLY place the listing basis is decided. Switching to "paid" changes this body only. */
export function isVendorListingEligible(input: VendorListingEligibilityInput): boolean {
  return input.status === 'approved';
}

export type ListingConsent = 'granted' | 'missing';

/** Both marketingPermission answers ('full', 'listing-only') accept being listed. */
export function resolveListingConsent(marketingPermission?: string | null): ListingConsent {
  return marketingPermission === 'full' || marketingPermission === 'listing-only'
    ? 'granted'
    : 'missing';
}

/** Hyphen, never a dot: a dot in a Sanity _id makes the document non-public. */
export function listingDocumentId(submissionId: string): string {
  return `${LISTING_DOCUMENT_TYPE}-${submissionId}`;
}

export interface VendorListingProjection {
  name: string;
  country?: string;
  website?: string;
  bio?: string;
}

function nonBlank(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function httpUrlOrUndefined(value: unknown): string | undefined {
  const candidate = nonBlank(value);
  if (!candidate) return undefined;
  try {
    return ALLOWED_WEBSITE_PROTOCOLS.includes(new URL(candidate).protocol) ? candidate : undefined;
  } catch {
    return undefined;
  }
}

type ProjectionSource = Pick<
  VendorSubmission,
  'businessName' | 'tradingName' | 'countryOfBusinessRegistration' | 'website' | 'bio'
>;

/** Strict allowlist: name, country, website, bio. Blank fields are omitted, never undefined. */
export function projectVendorListing(submission: ProjectionSource): VendorListingProjection {
  const projection: VendorListingProjection = {
    name: nonBlank(submission.tradingName) ?? nonBlank(submission.businessName) ?? '',
  };
  const country = nonBlank(submission.countryOfBusinessRegistration);
  if (country) projection.country = country;
  const website = httpUrlOrUndefined(submission.website);
  if (website) projection.website = website;
  const bio = nonBlank(submission.bio);
  if (bio) projection.bio = bio;
  return projection;
}

export interface ListingSanityClient {
  getDocument(id: string): Promise<{ _id: string } | null | undefined>;
  createIfNotExists(doc: Record<string, unknown>): Promise<unknown>;
}

export interface PublishVendorListingInput {
  submission: ProjectionSource &
    Pick<VendorSubmission, 'id' | 'status' | 'paymentReceived' | 'marketingPermission'>;
  standOrderStatus?: string | null;
  acknowledgeNoConsent: boolean;
}

export type PublishVendorListingResult =
  | { ok: true; outcome: 'created' | 'already-listed'; documentId: string }
  | { ok: false; reason: 'not-eligible' | 'consent-missing' };

export async function publishVendorListing(
  deps: { sanity: ListingSanityClient },
  input: PublishVendorListingInput,
): Promise<PublishVendorListingResult> {
  const { submission } = input;
  if (
    !isVendorListingEligible({
      status: submission.status,
      paymentReceived: submission.paymentReceived,
      standOrderStatus: input.standOrderStatus ?? null,
    })
  ) {
    return { ok: false, reason: 'not-eligible' };
  }
  if (resolveListingConsent(submission.marketingPermission) === 'missing' && !input.acknowledgeNoConsent) {
    return { ok: false, reason: 'consent-missing' };
  }

  const documentId = listingDocumentId(submission.id);
  const [published, draft] = await Promise.all([
    deps.sanity.getDocument(documentId),
    deps.sanity.getDocument(`${DRAFT_ID_PREFIX}${documentId}`),
  ]);
  if (published || draft) return { ok: true, outcome: 'already-listed', documentId };

  await deps.sanity.createIfNotExists({
    _id: documentId,
    _type: LISTING_DOCUMENT_TYPE,
    ...projectVendorListing(submission),
  });
  return { ok: true, outcome: 'created', documentId };
}
