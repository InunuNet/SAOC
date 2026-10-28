import { notFound } from 'next/navigation';

// proxy.ts passes /tickets/<a>/<b> through un-rewritten on the NOS host; (nos)/tickets/[slug] covers
// one segment only. This catch-all claims the deeper paths and renders (nos)/not-found.tsx. Static
// params are empty and nothing here reads headers or cookies.
export function generateStaticParams(): { slug: string; rest: string[] }[] {
  return [];
}

export default function TicketsCatchAll(): never {
  notFound();
}
