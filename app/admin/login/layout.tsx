// =============================================================
// SAOC — app/admin/login/layout.tsx
// /admin sits outside the (marketing) route group, so it never inherits the
// site's header/footer. The login page is public-facing and should look like
// part of the site rather than a bare standalone screen — but the dashboard
// (/admin) and the door scanner (/admin/door) must NOT get this chrome, so it
// is scoped to /admin/login only, mirroring app/(marketing)/layout.tsx.
// The page takes the chrome of the host it is served on: the NOS host (where
// the gated media kit redirects here) gets the NOS frame and theme scope, the
// SAOC host keeps the SAOC header and footer, mirroring app/(shared)/layout.tsx.
// =============================================================

import { Header, Footer } from '@/components/chrome';
import { NosFrame } from '@/components/site-chrome/NosFrame';
import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { requestSite } from '@/lib/request-site';

export default async function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  const site = await requestSite();
  if (site === 'nos') {
    return (
      <NosFrame>
        <NosThemeScope>{children}</NosThemeScope>
      </NosFrame>
    );
  }
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer showCopyGap={false} />
    </>
  );
}
