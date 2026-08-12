import { permanentRedirect } from 'next/navigation';

export { metadata } from '../page';

// F5 (show-visitor-info): a 308 rather than a 307, so search engines consolidate this
// URL onto /national-show instead of holding it as a temporary detour. There is no
// upcoming-show page to build — the show landing page is the upcoming show.
export default function UpcomingShowPage() {
  permanentRedirect('/national-show');
}
