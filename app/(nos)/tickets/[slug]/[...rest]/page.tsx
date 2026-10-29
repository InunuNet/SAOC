import { notFound } from 'next/navigation';

// proxy.ts passes /tickets/<a>/<b> through un-rewritten on the NOS host; (nos)/tickets/[slug] covers
// one segment only. This catch-all claims the deeper paths and renders (nos)/not-found.tsx. Nothing
// here reads headers or cookies. It is force-dynamic because the parent [slug]/layout.tsx makes a live
// (no-store) ticket read, which a statically rendered page cannot sit under.
export const dynamic = 'force-dynamic';

export default function TicketsCatchAll(): never {
  notFound();
}
