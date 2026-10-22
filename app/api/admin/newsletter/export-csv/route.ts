import { getAdminSession } from '@/lib/admin-auth';
import { handleNewsletterExport } from '@/lib/newsletter-handler';
import { listAllSubscribers } from '@/lib/newsletter-store';
import { nosOrigin, saocOrigin } from '@/lib/site-hosts';

// Unsubscribe links in the export use the configured site origin, never the request Host header:
// the NOS origin for nos-footer subscribers, the SAOC origin for everyone else.
const NOS_FOOTER_SOURCE = 'nos-footer';

function unsubscribeOrigin(source: string): string {
  return source === NOS_FOOTER_SOURCE ? nosOrigin() : saocOrigin();
}

export async function GET() {
  const result = await handleNewsletterExport({
    getSession: getAdminSession,
    origin: unsubscribeOrigin,
    listSubscribers: listAllSubscribers,
  });
  return new Response(result.body, { status: result.status, headers: result.headers });
}
