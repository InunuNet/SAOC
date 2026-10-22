import { getAdminSession } from '@/lib/admin-auth';
import { handleNewsletterExport } from '@/lib/newsletter-handler';
import { listAllSubscribers } from '@/lib/newsletter-store';

// Unsubscribe links in the export use the configured site origin, never the request Host header.
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function siteOrigin(): string {
  return (process.env['SITE_URL']?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

export async function GET() {
  const result = await handleNewsletterExport({
    getSession: getAdminSession,
    origin: siteOrigin(),
    listSubscribers: listAllSubscribers,
  });
  return new Response(result.body, { status: result.status, headers: result.headers });
}
