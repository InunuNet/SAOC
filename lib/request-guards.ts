// Pure guards for public route handlers: honeypot, a Content-Length pre-check, and a streamed
// body reader that counts the bytes actually received, whatever the header claims.

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

/**
 * False for a declared Content-Length that is empty, non-integer, negative or above `maxBytes`.
 * A missing header passes (a chunked body); only the streamed read can cap that.
 */
export function isDeclaredLengthWithinLimit(contentLength: string | null, maxBytes: number): boolean {
  if (contentLength === null) return true;
  return DECIMAL_INTEGER.test(contentLength) && Number(contentLength) <= maxBytes;
}

const FIRESTORE_AUTO_ID = /^[A-Za-z0-9]{20}$/;

/** True for the 20-character shape Firestore gives an auto-generated document id. */
export function isFirestoreAutoId(id: string): boolean {
  return FIRESTORE_AUTO_ID.test(id);
}

/**
 * Reads a request body as text, refusing (null) as soon as it passes `maxBytes`. A missing
 * Content-Length (a chunked body) is accepted, counting the bytes as they stream in, so a
 * genuine sender that does not announce its length is still served; a declared length that is
 * non-numeric or too large is refused before anything is read.
 */
export async function readBodyTextWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<string | null> {
  if (!isDeclaredLengthWithinLimit(request.headers.get('content-length'), maxBytes)) return null;
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

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too-large' | 'invalid-json' };

/**
 * Reads a request body as JSON under the same streamed cap as readBodyTextWithinLimit. A body
 * past `maxBytes` is `too-large`; one that is not valid JSON (an empty body, or a stream that
 * fails mid-read) is `invalid-json`, the outcome `request.json()` gave a caller before.
 */
export async function readJsonBodyWithinLimit(
  request: Request,
  maxBytes: number,
): Promise<JsonBodyResult> {
  let text: string | null;
  try {
    text = await readBodyTextWithinLimit(request, maxBytes);
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
  if (text === null) return { ok: false, reason: 'too-large' };
  try {
    // JSON.parse is typed any; unknown is the honest type, callers must validate the value.
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, reason: 'invalid-json' };
  }
}
