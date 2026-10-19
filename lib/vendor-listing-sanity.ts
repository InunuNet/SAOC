import { createClient } from '@sanity/client';

import { apiVersion, dataset, projectId } from '@/sanity/env';
import type { ListingSanityClient } from '@/lib/vendor-listing';

/** Thrown when the server has no Sanity write token; the route maps it to 500 "CMS not configured". */
export class SanityNotConfiguredError extends Error {
  constructor() {
    super('SANITY_API_TOKEN is not set');
    this.name = 'SanityNotConfiguredError';
  }
}

/** Server-only Sanity write client, narrowed to the two methods the listing publish may use. */
export function createListingSanityClient(): ListingSanityClient {
  const token = process.env.SANITY_API_TOKEN;
  if (!token) throw new SanityNotConfiguredError();
  const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false });
  return {
    getDocument: (id) => client.getDocument<{ _id: string }>(id),
    createIfNotExists: (doc) => client.createIfNotExists(doc as { _id: string; _type: string }),
  };
}
