import { notFound } from 'next/navigation';

// An unknown /newsletter/<path> on either host. app/(shared)/not-found.tsx picks the host's chrome.
// force-dynamic because app/(shared)/layout.tsx reads the request host, which a statically rendered
// page cannot sit under. This page itself reads no headers or cookies.
export const dynamic = 'force-dynamic';

export default function NewsletterCatchAll(): never {
  notFound();
}
