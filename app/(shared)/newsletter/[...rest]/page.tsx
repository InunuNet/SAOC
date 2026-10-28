import { notFound } from 'next/navigation';

// An unknown /newsletter/<path> on either host. app/(shared)/not-found.tsx picks the host's chrome.
export function generateStaticParams(): { rest: string[] }[] {
  return [];
}

export default function NewsletterCatchAll(): never {
  notFound();
}
