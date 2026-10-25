import { notFound } from 'next/navigation';

import { MediaKitPageBody } from '@/app/(marketing)/media-kit/MediaKitPageBody';

// Render-check fixture: the real media kit body, so its layout can be verified without a committee
// session. There is no auth bypass here and the gate is not called; the flag only exposes this page.
// The flag is never set in apphosting.yaml or any deploy file.
export const dynamic = 'force-dynamic';

export default function MediaKitFixturePage() {
  if (process.env.MEDIA_KIT_FIXTURES !== '1') notFound();
  return <MediaKitPageBody />;
}
