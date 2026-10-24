// =============================================================
// SAOC — app/admin/login/layout.tsx
// /admin sits outside the (marketing) route group, so it never inherits the
// site's header/footer. The login page is public-facing and should look like
// part of the site rather than a bare standalone screen — but the dashboard
// (/admin) and the door scanner (/admin/door) must NOT get this chrome, so it
// is scoped to /admin/login only, mirroring app/(marketing)/layout.tsx.
// =============================================================

import { Header, Footer } from '@/components/chrome';

export default function AdminLoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer showCopyGap={false} />
    </>
  );
}
