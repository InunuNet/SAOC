import { NotFoundSection } from '../not-found';

export { metadata } from '../not-found';

// A notFound() from a show route outside /national-show (tickets, vsp) renders inside the NOS
// chrome, which already owns the page's <main>, so the section goes in bare.
export default function NosNotFound() {
  return <NotFoundSection />;
}
