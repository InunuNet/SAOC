// F16 (launch-weekend, R31 #1b) — Server Component. The audience index directly under the
// tickets hero: four anchors to the groups below. Labels trace to components/chrome/nav-config.ts
// (Visit; Exhibit & Trade split; Conference Registration + Workshops). A <nav> in a wrap, like
// the R27 sub-nav, so it is exempt from the section rhythm but not from the container rule.
const AUDIENCE_LINKS = [
  { label: 'Visit', href: '#visit' },
  { label: 'Exhibit', href: '#exhibit' },
  { label: 'Trade', href: '#trade' },
  { label: 'Conference & Workshops', href: '#conference-workshops' },
] as const;

export function TicketAudienceIndex() {
  return (
    <nav data-ticket-index="" aria-label="What are you here for?" className="nos-ticket-index">
      <div data-nos-wrap="">
        <ul className="nos-ticket-index-row">
          {AUDIENCE_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="nos-ticket-index-link">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
