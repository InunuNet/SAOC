import { notFound } from 'next/navigation';

import { MediaKitPageBody } from '@/app/(marketing)/media-kit/MediaKitPageBody';

// Render-check fixture: the real media kit body, so its layout can be verified without a committee
// session. There is no auth bypass here and the gate is not called; the flag only exposes this page.
// The flag is never set in apphosting.yaml or any deploy file, and the route also 404s whenever K_SERVICE
// is set (Cloud Run, which runs Firebase App Hosting), so it cannot render on the deployed site even if
// the flag were set there. NODE_ENV cannot be the guard: it is 'production' under the local `next start`.
export const dynamic = 'force-dynamic';

export default function MediaKitFixturePage() {
  if (process.env.K_SERVICE || process.env.MEDIA_KIT_FIXTURES !== '1') notFound();
  return <MediaKitPageBody />;
}
