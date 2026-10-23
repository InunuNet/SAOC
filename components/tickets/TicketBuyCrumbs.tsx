import Link from 'next/link';

// The checkout step's breadcrumb row. The page passes the ticket's name for the third crumb; its
// loader omits it, since the name is only known once the ticket has loaded.
export function TicketBuyCrumbs({ name }: { name?: string }) {
  return (
    <nav className="nk-crumbs" aria-label="Breadcrumb">
      <Link href="/">National Show</Link>
      <span className="nk-crumb">
        <span className="nk-sep" aria-hidden="true" />
        <Link href="/tickets">Tickets</Link>
      </span>
      {name ? (
        <span className="nk-crumb">
          <span className="nk-sep" aria-hidden="true" />
          <span aria-current="page">{name}</span>
        </span>
      ) : null}
    </nav>
  );
}
