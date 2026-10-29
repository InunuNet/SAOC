import { notFound } from 'next/navigation';

// Claims every SAOC-host path no other route matches, so the 404 renders through
// app/(marketing)/not-found.tsx without app/not-found.tsx having to read the request host
// (headers() there would make the whole app dynamic). Static params are empty and nothing here
// reads headers or cookies, so the catch-all itself stays static.
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

export default function MarketingCatchAll(): never {
  notFound();
}
