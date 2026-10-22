/**
 * Failure logging for best-effort paths (the ticket PDF, the order visit loader). Logs the
 * operation and a built-in type label only: never `error.message` or `String(error)`, which can
 * carry buyer details or secrets. Nothing here can throw, so it is safe inside a catch block whose
 * caller promises never to throw (a hostile `name` getter, `toString` or Proxy is contained).
 */
const UNKNOWN_ERROR_TYPE = 'unknown';
const GENERIC_ERROR_TYPE = 'Error';
// Only these built-in names are ever logged; any other `name` is attacker- or data-controlled
// (even a class-looking one) and could carry PII or a secret.
const SAFE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'AggregateError',
  'AbortError',
  'TimeoutError',
]);

export function safeErrorType(error: unknown): string {
  try {
    if (!(error instanceof Error)) return typeof error;
    // No coercion: a non-string name could run attacker-controlled toString/toPrimitive code.
    const name: unknown = error.name;
    return typeof name === 'string' && SAFE_ERROR_NAMES.has(name) ? name : GENERIC_ERROR_TYPE;
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
