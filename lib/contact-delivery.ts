import { safeErrorType } from '@/lib/safe-log';

/**
 * Delivery of the two contact emails (visitor acknowledgement, admin notice) and the one-time
 * record of their outcome. Pure: no Firebase, no environment. The route supplies the senders and
 * the store write. Nothing here throws, and a failure is logged as `{ operation, exceptionType }`
 * only, never the error message, an address, a name or the submission body.
 */

export type ContactEmailOutcome = 'sent' | 'failed' | 'no_recipients';

export interface ContactDeliveryStatus {
  visitor: 'sent' | 'failed' | null;
  admin: ContactEmailOutcome | null;
}

export interface ContactDeliveryDeps {
  sendAcknowledgement(): Promise<void>;
  sendAdminNotice(): Promise<'sent' | 'no_recipients'>;
  recordStatus(status: ContactDeliveryStatus): Promise<void>;
  logError(message: string, context: Record<string, string>): void;
}

const LOG_MESSAGE = '[contact-delivery] non-fatal failure';

function logFailure(deps: ContactDeliveryDeps, operation: string, error: unknown): void {
  try {
    deps.logError(LOG_MESSAGE, { operation, exceptionType: safeErrorType(error) });
  } catch {
    // Logging must never break delivery.
  }
}

async function attempt<T>(
  deps: ContactDeliveryDeps,
  operation: string,
  run: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    logFailure(deps, operation, error);
    return { ok: false };
  }
}

/** `input` is accepted for call-site symmetry with the senders; it is never read or logged. */
export async function deliverContactEmails(
  input: unknown,
  deps: ContactDeliveryDeps,
): Promise<ContactDeliveryStatus> {
  void input;
  const [visitor, admin] = await Promise.all([
    attempt(deps, 'visitor_email', () => deps.sendAcknowledgement()),
    attempt(deps, 'admin_email', () => deps.sendAdminNotice()),
  ]);

  const status: ContactDeliveryStatus = {
    visitor: visitor.ok ? 'sent' : 'failed',
    admin: admin.ok ? admin.value : 'failed',
  };

  await attempt(deps, 'record_status', () => deps.recordStatus(status));
  return status;
}
