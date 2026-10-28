import { notFound } from 'next/navigation';

// proxy.ts passes /vsp/* through un-rewritten on the NOS host, so an unknown /vsp/<path> reaches no
// route. This catch-all claims it and renders (nos)/not-found.tsx (NOS chrome and copy). Static
// params are empty and nothing here reads headers or cookies.
export function generateStaticParams(): { slug: string[] }[] {
  return [];
}

export default function VspCatchAll(): never {
  notFound();
}
