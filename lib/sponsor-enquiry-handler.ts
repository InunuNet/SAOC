import { consumeRateLimit, type RateLimitDeps } from './newsletter-rate-limit';
import {
  buildSponsorEnquiryDoc,
  validateSponsorEnquiry,
  type SponsorEnquiryDoc,
  type SponsorEnquiryFieldErrors,
  type SponsorEnquirySite,
} from './sponsor-enquiry';

/**
 * Pure, injectable orchestrator for POST /api/sponsors/enquire (mission sponsor-enquiry-form,
 * M1/F1). No firebase-admin and no `@/` import: the route supplies the store adapters. Order:
 * rate limit, honeypot, validate, write, then non-blocking notifications. Response shapes are
 * pinned by .agent/memory/project/specs/sponsor-enquiry-form/goldens/spec.md section 5.
 */

export const SPONSOR_ENQUIRY_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SPONSOR_ENQUIRY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const HONEYPOT_FIELD = '_hp';

const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

// Sourced: the newsletter copy (rate limit) and the vendor apply route (the other two).
const ERROR_RATE_LIMITED = 'Too many attempts. Please try again later.';
const ERROR_MALFORMED_JSON = 'Malformed JSON body.';
const ERROR_FIELDS = 'Please check the highlighted fields.';
const ERROR_WRITE_FAILED = 'Failed to submit. Please try again.';

export interface SponsorEnquiryHandlerResult {
  status: number;
  body: Record<string, unknown>;
  retryAfterSeconds?: number;
}

export interface SponsorEnquiryDeps extends RateLimitDeps {
  writeEnquiry(doc: SponsorEnquiryDoc): Promise<string>;
  afterCommit(id: string, doc: SponsorEnquiryDoc): Promise<void>;
  logError(message: string, context: Record<string, string>): void;
}

export interface SponsorEnquiryInput {
  body: unknown;
  /** True when the request body was not parseable JSON. */
  malformed?: boolean;
  rateLimitKey: string;
  /** Derived from the Host by the route, never from the body. */
  site: SponsorEnquirySite;
}

function exceptionType(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function isHoneypotHit(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof value === 'string' && value !== '';
}

function invalid(fieldErrors: SponsorEnquiryFieldErrors): SponsorEnquiryHandlerResult {
  return { status: HTTP_BAD_REQUEST, body: { error: ERROR_FIELDS, fieldErrors } };
}

export async function handleSponsorEnquiry(
  input: SponsorEnquiryInput,
  deps: SponsorEnquiryDeps,
): Promise<SponsorEnquiryHandlerResult> {
  const outcome = consumeRateLimit(
    deps,
    input.rateLimitKey,
    SPONSOR_ENQUIRY_RATE_LIMIT_MAX_ATTEMPTS,
    SPONSOR_ENQUIRY_RATE_LIMIT_WINDOW_MS,
  );
  if (!outcome.allowed) {
    return {
      status: HTTP_TOO_MANY_REQUESTS,
      body: { error: ERROR_RATE_LIMITED },
      retryAfterSeconds: outcome.retryAfterSeconds,
    };
  }

  if (input.malformed === true) {
    return { status: HTTP_BAD_REQUEST, body: { error: ERROR_MALFORMED_JSON } };
  }
  // A bot-filled honeypot looks like success and writes nothing, whatever else is wrong.
  if (isHoneypotHit(input.body)) return { status: HTTP_CREATED, body: { success: true } };

  const validation = validateSponsorEnquiry(input.body);
  if (!validation.ok) return invalid(validation.fieldErrors);

  const doc = buildSponsorEnquiryDoc(validation.value, input.site, deps.now);
  let id: string;
  try {
    id = await deps.writeEnquiry(doc);
  } catch (error) {
    deps.logError('sponsor enquiry write failed', {
      operation: 'write',
      exceptionType: exceptionType(error),
    });
    return { status: HTTP_SERVER_ERROR, body: { error: ERROR_WRITE_FAILED } };
  }

  // The enquiry is stored: a failed notification must never turn it into an error response.
  try {
    await deps.afterCommit(id, doc);
  } catch (error) {
    deps.logError('sponsor enquiry notification failed', {
      operation: 'notify',
      exceptionType: exceptionType(error),
    });
  }
  return { status: HTTP_CREATED, body: { success: true } };
}
