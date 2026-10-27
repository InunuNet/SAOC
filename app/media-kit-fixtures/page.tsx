import { notFound } from 'next/navigation';

import { MediaKitPageBody } from '@/app/(marketing)/media-kit/MediaKitPageBody';
import { isHostedRuntime } from '@/lib/fixture-route-guard';

// Render-check fixture: the real media kit body, so its layout can be verified without a committee
// session. There is no auth bypass here and the gate is not called; the flag only exposes this page.
// The flag is never set in apphosting.yaml or any deploy file, and the route also 404s on the hosted
// runtime (lib/fixture-route-guard.ts), so it cannot render on the deployed site even if the flag were set.
export const dynamic = 'force-dynamic';

export default function MediaKitFixturePage() {
  if (isHostedRuntime() || process.env.MEDIA_KIT_FIXTURES !== '1') notFound();
  return <MediaKitPageBody />;
}
