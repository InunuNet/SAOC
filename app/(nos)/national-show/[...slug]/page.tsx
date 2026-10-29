import { notFound } from 'next/navigation';

// proxy.ts rewrites every unmatched NOS-host path to /national-show/<path>; this catch-all claims
// those that match no show route, so the 404 renders through (nos)/national-show/not-found.tsx
// (NOS chrome and copy) without app/not-found.tsx having to read the request host. Static params
// are empty and nothing here reads headers or cookies, so the catch-all itself stays static.
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

export default function NosCatchAll(): never {
  notFound();
}
