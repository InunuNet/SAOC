const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/**
 * UI-legible discriminated union describing every real shape
 * VendorRegistrationHandlerResult (lib/vendor-registration-handler.ts, F5) can return, plus a
 * network-failure case for a thrown fetch. The only place API response bodies are turned into
 * copy the submitter reads -- see contracts/golden/vendor-form-ui/README.md.
 */
export type VendorRegisterResponseDescription =
  | { kind: 'success'; id: string; message: string }
  | { kind: 'validation-error'; message: string; fieldErrors: string[] }
  | { kind: 'rate-limited'; message: string; retryAfterMs: number; retryAfterLabel: string }
  | { kind: 'error'; message: string };

interface SuccessBody {
  success: true;
  id: string;
}

interface ValidationErrorBody {
  error: string;
  fieldErrors: string[];
}

interface RateLimitedBody {
  error: string;
  retryAfterMs: number;
}

interface GenericErrorBody {
  error: string;
}

function isSuccessBody(body: unknown): body is SuccessBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === true &&
    typeof (body as { id?: unknown }).id === 'string'
  );
}

function isValidationErrorBody(body: unknown): body is ValidationErrorBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { fieldErrors?: unknown }).fieldErrors)
  );
}

function isRateLimitedBody(body: unknown): body is RateLimitedBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { retryAfterMs?: unknown }).retryAfterMs === 'number'
  );
}

function isGenericErrorBody(body: unknown): body is GenericErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string';
}

/**
 * Formats a retry-after duration as legible copy (minutes below an hour, hours and remaining
 * minutes at or above an hour) -- never a raw millisecond count, which is not something a
 * submitter can act on.
 */
export function formatRetryAfter(ms: number): string {
  if (ms < MS_PER_HOUR) {
    const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  const hours = Math.floor(ms / MS_PER_HOUR);
  const remainingMinutes = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;
  if (remainingMinutes === 0) {
    return hourLabel;
  }
  const minuteLabel = remainingMinutes === 1 ? '1 minute' : `${remainingMinutes} minutes`;
  return `${hourLabel} ${minuteLabel}`;
}

/**
 * Maps an HTTP status + response body from POST /api/vendors/register into UI-legible copy.
 * `status` 0 with `body` undefined is this module's convention for a thrown fetch (no response
 * reached at all), mirroring TicketPurchaseForm's own catch-block treatment of a network
 * failure.
 */
export function describeVendorRegistrationResponse(
  status: number,
  body: unknown,
): VendorRegisterResponseDescription {
  if (status === 201 && isSuccessBody(body)) {
    return {
      kind: 'success',
      id: body.id,
      message: 'Your vendor registration has been received.',
    };
  }

  if (status === 400 && isValidationErrorBody(body)) {
    return {
      kind: 'validation-error',
      message: body.error,
      fieldErrors: body.fieldErrors,
    };
  }

  if (status === 429 && isRateLimitedBody(body)) {
    return {
      kind: 'rate-limited',
      message: body.error,
      retryAfterMs: body.retryAfterMs,
      retryAfterLabel: formatRetryAfter(body.retryAfterMs),
    };
  }

  if (isGenericErrorBody(body)) {
    return { kind: 'error', message: body.error };
  }

  return { kind: 'error', message: 'Something went wrong. Please try again.' };
}
