import type { SanityClient } from 'next-sanity';

const HTTP_PAYMENT_REQUIRED = 402; // Sanity's "plan_limit_reached" (API CDN quota exhausted)
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_SERVER_ERROR_MAX = 599;

/** True when an error from a CDN fetch means the CDN itself is unavailable (quota, rate limit,
 * outage), so the same query is worth one retry against the non-CDN API host. */
export function isCdnUnavailableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return false;
  const { statusCode } = error;
  if (typeof statusCode !== 'number') return false;
  return (
    statusCode === HTTP_PAYMENT_REQUIRED ||
    statusCode === HTTP_TOO_MANY_REQUESTS ||
    (statusCode >= HTTP_SERVER_ERROR_MIN && statusCode <= HTTP_SERVER_ERROR_MAX)
  );
}

/**
 * Wraps a Sanity client so that `fetch` retries once against the API host (`useCdn: false`)
 * when a CDN fetch fails with a quota/rate-limit/5xx error. The first attempt is unchanged, and
 * a fetch that was not going to the CDN (e.g. draft mode) is never retried. Query, params and
 * every other option (perspective, next tags) are passed to the retry as-is.
 */
export function withCdnFallback(client: SanityClient): SanityClient {
  const fetchWithFallback = async (
    query: string,
    params?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): Promise<unknown> => {
    const usesCdn = (options?.useCdn as boolean | undefined) ?? client.config().useCdn === true;
    try {
      return await client.fetch(query, params, options);
    } catch (error) {
      if (!usesCdn || !isCdnUnavailableError(error)) throw error;
      const { statusCode } = error as { statusCode: number };
      console.warn('[sanityFetch] CDN unavailable, fell back to API', { statusCode });
      return client.fetch(query, params, { ...options, useCdn: false });
    }
  };

  return new Proxy(client, {
    get(target, prop) {
      // `fetch` has several overloads a single implementation cannot express; the wrapper
      // forwards its arguments untouched, so it honours each overload's contract.
      if (prop === 'fetch') return fetchWithFallback as SanityClient['fetch'];
      const value: unknown = Reflect.get(target, prop, target);
      // Bind to the real client: SanityClient methods read private fields off `this`.
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
