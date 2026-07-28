// Breadcrumb component available from @/components/chrome for interior pages
import { UtilityBar, Header, Footer } from '@/components/chrome';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UtilityBar />
      <Header />
      {/* Breadcrumb injected by individual page layouts in M4+ */}
      <main>{children}</main>
      <Footer />
    </>
  );
}
