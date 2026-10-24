// Pure guards for public route handlers: honeypot, and a body-size gate that runs from the
// Content-Length header before the body is parsed.

// Allowance for the JSON envelope around a base64 file: fileName, mimeType, sizeBytes.
const JSON_ENVELOPE_ALLOWANCE_BYTES = 16 * 1024;
const BASE64_CHARS_PER_BYTE_GROUP = 4;
const BYTES_PER_BASE64_GROUP = 3;
const DECIMAL_INTEGER = /^\d+$/;

/** True when the hidden `_hp` field holds anything: only a bot fills it in. */
export function isHoneypotHit(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>)._hp;
  return typeof value === 'string' && value !== '';
}

/** The largest request body for a file of `maxDecodedBytes`: base64 expansion plus the envelope. */
export function base64BodyLimitBytes(maxDecodedBytes: number): number {
  return (
    Math.ceil(maxDecodedBytes / BYTES_PER_BASE64_GROUP) * BASE64_CHARS_PER_BYTE_GROUP +
    JSON_ENVELOPE_ALLOWANCE_BYTES
  );
}

/** False for a missing, empty, non-integer, negative or oversized Content-Length. */
export function isBodyWithinLimit(contentLength: string | null, maxBytes: number): boolean {
  if (contentLength === null || !DECIMAL_INTEGER.test(contentLength)) return false;
  return Number(contentLength) <= maxBytes;
}
