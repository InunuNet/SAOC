// fixture: a check that publishes to a live dataset
import { createClient } from '@sanity/client';
const client = createClient({ projectId: 'x', dataset: 'production', token: process.env.SANITY_API_TOKEN });
await client.patch('doc').set({ a: 1 }).commit();
