import { NotFoundSection } from '../not-found';

export { metadata } from '../not-found';

// A notFound() from a marketing page (tickets, societies, events) renders inside the marketing
// chrome, which already owns the page's <main>, so the section goes in bare.
export default function MarketingNotFound() {
  return <NotFoundSection />;
}
