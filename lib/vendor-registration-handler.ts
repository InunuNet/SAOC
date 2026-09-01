import {
  buildVendorSubmission,
  validateVendorSubmissionInput,
  type VendorSubmissionDraft,
} from '@/lib/vendor-submissions';
import {
  decideVendorRegistrationRateLimit,
  type VendorRegistrationAttemptRecord,
} from '@/lib/vendor-registration-rate-limit';
import { deliverConfirmationEmailAfterCommit } from '@/lib/confirmation-email';
import type { VendorRegistrationConfirmationInput } from '@/lib/vendor-registration-confirmation';
import type { VendorSubmission } from '@/types/index';

/**
 * Pure orchestrator for POST /api/vendors/register (mission vendor-registration F5). See
 * contracts/golden/vendor-f5-register-route/README.md for the full decision record, every
 * judgement call, and every defeating mutation this contract's checks guard against.
 *
 * Fully injectable -- no Firebase Admin SDK import, no Resend import, no network -- so every
 * load-bearing property (no parallel validation, commit-before-email with a non-fatal email
 * failure, rate-limit-shields-write, zero authorization meaning, no PII in logs) is proven
 * offline against this function directly, never by source-grep.
 */

export interface VendorRegistrationWriteResult {
  id: string;
}

export interface VendorRegistrationHandlerDeps {
  now: Date;
  rateLimitKey: string;
  getPriorAttempts(key: string): VendorRegistrationAttemptRecord[];
  recordAttempt(key: string, at: Date): void;
  write(doc: Omit<VendorSubmission, 'id'>): Promise<VendorRegistrationWriteResult>;
  sendConfirmationEmail(input: VendorRegistrationConfirmationInput): Promise<void>;
  /** G1 (vendor-flow-notifications) -- admin notice on full registration submitted. Fired
   *  immediately after sendConfirmationEmail, through the SAME onEmailError callback -- no new
   *  error channel. See contracts/golden/vendor-flow-notifications/README.md. */
  sendAdminNotice(input: {
    businessName: string;
    contactPersonName: string;
    vendorSubmissionId: string;
  }): Promise<void>;
  onEmailError(error: unknown): void;
}

export interface VendorRegistrationHandlerResult {
  status: number;
  body:
    | { success: true; id: string }
    | { error: string; fieldErrors?: string[] }
    | { error: string; retryAfterMs: number };
}

export async function handleVendorRegistration(
  rawInput: unknown,
  deps: VendorRegistrationHandlerDeps,
): Promise<VendorRegistrationHandlerResult> {
  // 1-3. Rate limit is checked, and the attempt recorded, BEFORE any parsing/validation of
  // rawInput -- a rate-limited caller never reaches validation, Firestore, or email.
  const decision = decideVendorRegistrationRateLimit(
    deps.rateLimitKey,
    deps.now,
    deps.getPriorAttempts(deps.rateLimitKey),
  );
  // Recorded unconditionally, whether or not the decision allows the request, so a caller
  // hammering the endpoint during a block keeps re-extending its own retryAfterMs rather than
  // getting a free re-roll once the first window's attempts age out mid-hammer.
  deps.recordAttempt(deps.rateLimitKey, deps.now);

  if (!decision.allowed) {
    return {
      status: 429,
      body: {
        error: 'Too many vendor registration attempts. Please try again later.',
        retryAfterMs: decision.retryAfterMs ?? VENDOR_REGISTER_DEFAULT_RETRY_AFTER_MS,
      },
    };
  }

  // 4. The REAL F4 validator -- never a second, hand-written validation routine.
  const validation = validateVendorSubmissionInput(rawInput);
  if (!validation.valid) {
    return {
      status: 400,
      body: { error: 'Invalid vendor registration submission.', fieldErrors: validation.errors },
    };
  }

  // 5. Safe only because step 4 already proved the shape -- no field is re-validated or
  // transformed a second time here.
  const built = buildVendorSubmission(rawInput as VendorSubmissionDraft, deps.now);

  // 6. On a write failure, return 500 immediately and NEVER call sendConfirmationEmail.
  let writeResult: VendorRegistrationWriteResult;
  try {
    writeResult = await deps.write(built);
  } catch {
    return { status: 500, body: { error: 'Failed to save vendor registration. Please try again.' } };
  }

  // 7. The REAL, already-shipped deliverConfirmationEmailAfterCommit (F10/F11) -- not a
  // reimplementation of "try/catch and swallow." A rejecting sendConfirmationEmail must never
  // change the eventual response.
  await deliverConfirmationEmailAfterCommit(
    () =>
      deps.sendConfirmationEmail({
        businessName: built.businessName,
        contactPersonName: built.contactPersonName,
        contactEmail: built.contactEmail,
      }),
    deps.onEmailError,
  );

  // 7b. G1 (vendor-flow-notifications) -- a second, independent admin notice, reusing the
  // SAME injected onEmailError. A rejecting sendAdminNotice must never change the eventual
  // response, same reasoning as step 7.
  await deliverConfirmationEmailAfterCommit(
    () =>
      deps.sendAdminNotice({
        businessName: built.businessName,
        contactPersonName: built.contactPersonName,
        vendorSubmissionId: writeResult.id,
      }),
    deps.onEmailError,
  );

  // 8. Zero authorization meaning: exactly { success, id }, never the submitted payload
  // echoed back, never a status/roles/admin-flavoured key of any kind.
  return { status: 201, body: { success: true, id: writeResult.id } };
}

/** Fallback only -- decideVendorRegistrationRateLimit always returns a non-null retryAfterMs
 *  when allowed is false, so this branch is defensive, not load-bearing. */
const VENDOR_REGISTER_DEFAULT_RETRY_AFTER_MS = 60 * 60 * 1000;
