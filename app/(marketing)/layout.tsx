// Breadcrumb component available from @/components/chrome for interior pages
import { UtilityBar, Header, Footer } from '@/components/chrome';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import type { ShowIdentity } from '@/types';

// F7: the utility bar's show pill renders on every marketing page, so the show-identity
// facts it needs are fetched once here rather than hardcoded into the component.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const show = await sanityFetch<ShowIdentity>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });

  return (
    <>
      <UtilityBar show={show} />
      <Header />
      {/* Breadcrumb injected by individual page layouts in M4+ */}
      <main>{children}</main>
      <Footer />
    </>
  );
}
