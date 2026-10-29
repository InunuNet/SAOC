/**
 * Bounded body read for the payment notification routes (SEC-17). Those routes are exempt from
 * the proxy gate and verify a signature only AFTER the body is read, so an unbounded read is the
 * one pre-auth cost. 16 KiB is 2.2x the largest documented notification (spec.md D6); the real
 * ones are a few hundred bytes to 2 KB.
 *
 * A declared Content-Length over the cap is refused without reading. Otherwise the stream is read
 * chunk by chunk and cancelled the moment it passes the cap, so a missing or lying
 * Content-Length cannot bypass it. (isBodyWithinLimit is not reused: it rejects a missing
 * Content-Length, which would refuse a legitimate chunked notification.)
 */

export const WEBHOOK_MAX_BODY_BYTES = 16384;

const DECIMAL_INTEGER = /^\d+$/;

export type CappedBody = { ok: true; text: string } | { ok: false; bytesSeen: number };

export async function readCappedBody(
  request: Request,
  maxBytes: number = WEBHOOK_MAX_BODY_BYTES,
): Promise<CappedBody> {
  const declared = request.headers.get('content-length');
  if (declared !== null && DECIMAL_INTEGER.test(declared)) {
    // anchor: webhook-declared
    if (Number(declared) > maxBytes) {
      // anchor: webhook-declared-cancel
      await request.body?.cancel();
      return { ok: false, bytesSeen: Number(declared) };
    }
  }
  if (request.body === null) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    // anchor: webhook-stream
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, bytesSeen: total };
    }
    text += decoder.decode(value, { stream: true });
  }
  return { ok: true, text: text + decoder.decode() };
}
