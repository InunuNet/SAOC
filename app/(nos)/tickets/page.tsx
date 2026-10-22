import { permanentRedirect } from 'next/navigation';

// The bare /tickets listing is retired (R62): the tickets hub lives at /national-show/tickets, so
// an old link, a bookmark or a search result lands there instead of on a 404.
export default function TicketsPage() {
  permanentRedirect('/national-show/tickets');
}
