/**
 * Failure logging for best-effort paths (the ticket PDF, the order visit loader). Logs the
 * operation and a type label only: never `error.message` or `String(error)`, which can carry
 * buyer details or secrets. Nothing here can throw, so it is safe inside a catch block whose
 * caller promises never to throw (a hostile `name` getter, `toString` or Proxy is contained).
 */
const UNKNOWN_ERROR_TYPE = 'unknown';

export function safeErrorType(error: unknown): string {
  try {
    return error instanceof Error ? String(error.name) : typeof error;
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
