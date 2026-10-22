/**
 * Failure logging for best-effort paths (the ticket PDF, the order visit loader). Logs the
 * operation and an allowlisted type label only: never `error.message` or `String(error)`, which can carry
 * buyer details or secrets. Nothing here can throw, so it is safe inside a catch block whose
 * caller promises never to throw (a hostile `name` getter, `toString` or Proxy is contained).
 */
const UNKNOWN_ERROR_TYPE = 'unknown';
const GENERIC_ERROR_TYPE = 'Error';
// Only a class-style name (TypeError, FetchError, ...) is logged; any other `name` is
// attacker- or data-controlled and could carry PII or a secret.
const SAFE_ERROR_NAME = /^[A-Z][A-Za-z]{0,40}Error$/;

export function safeErrorType(error: unknown): string {
  try {
    if (!(error instanceof Error)) return typeof error;
    const name = String(error.name);
    return SAFE_ERROR_NAME.test(name) ? name : GENERIC_ERROR_TYPE;
  } catch {
    return UNKNOWN_ERROR_TYPE;
  }
}

export function logFailureSafely(message: string, error: unknown): void {
  try {
    console.error(message, { errorType: safeErrorType(error) });
  } catch {
    // Logging must never break the caller; there is nowhere safer to report this.
  }
}
