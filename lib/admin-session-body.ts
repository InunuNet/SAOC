export const MAX_SESSION_BODY_BYTES = 4096;

export type CappedBody = { ok: true; text: string } | { ok: false };

/**
 * Reads a request body, counting the bytes actually pulled from the stream (never
 * trusting Content-Length). Cancels the stream and reports overflow once more than
 * `maxBytes` have been read. A null body is treated as empty.
 */
export async function readBodyCapped(
  request: Request,
  maxBytes: number = MAX_SESSION_BODY_BYTES,
): Promise<CappedBody> {
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}
