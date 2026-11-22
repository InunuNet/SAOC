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

const FIRESTORE_AUTO_ID = /^[A-Za-z0-9]{20}$/;

/** True for the 20-character shape Firestore gives an auto-generated document id. */
export function isFirestoreAutoId(id: string): boolean {
  return FIRESTORE_AUTO_ID.test(id);
}

/**
 * Reads a request body as text, refusing (null) as soon as it passes `maxBytes`. Unlike
 * isBodyWithinLimit this accepts a missing Content-Length (a chunked body), counting the bytes
 * as they stream in, so a genuine sender that does not announce its length is still served.
 */
export async function readBodyTextWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!DECIMAL_INTEGER.test(declared) || Number(declared) > maxBytes)) {
    return null;
  }
  if (request.body === null) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
