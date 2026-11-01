export const MAX_SESSION_BODY_BYTES = 4096;

export type CappedBody =
  | { ok: true; text: string }
  | { ok: false; reason: 'too-large' | 'read-failed' };

/**
 * Reads a request body, counting the bytes actually pulled from the stream (never
 * trusting Content-Length). Cancels the stream and reports overflow once more than
 * `maxBytes` have been read; a stream error reports `read-failed`. A null body is
 * treated as empty. The reader lock is always released.
 */
export async function readBodyCapped(
  request: Request,
  maxBytes: number = MAX_SESSION_BODY_BYTES,
): Promise<CappedBody> {
  if (!request.body) return { ok: true, text: '' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        // A failing cancel must never turn the 413 into a 500.
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too-large' };
      }
      chunks.push(value);
    }
  } catch (error) {
    console.warn('[admin-session] body read failed', {
      operation: 'POST /api/admin/session',
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { ok: false, reason: 'read-failed' };
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}
