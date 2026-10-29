import { NotFoundSection } from '@/components/site-chrome/SaocNotFound';

export { saocNotFoundMetadata as metadata } from '@/components/site-chrome/SaocNotFound';

// A notFound() from a marketing page (tickets, societies, events) renders inside the marketing
// chrome, which already owns the page's <main>, so the section goes in bare.
export default function MarketingNotFound() {
  return <NotFoundSection />;
}
