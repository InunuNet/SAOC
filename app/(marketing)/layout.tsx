// Breadcrumb component available from @/components/chrome for interior pages
import { SkipLink, UtilityBar, Header, Footer } from '@/components/chrome';
import { AdminPill } from '@/components/admin/AdminPill';
import { ChromeFrame } from '@/components/nos-chrome/ChromeFrame';
import { NosSkipLink } from '@/components/nos-chrome/NosSkipLink';
import { NosFooter } from '@/components/nos-chrome/NosFooter';
import { NosHeader } from '@/components/nos-chrome/NosHeader';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import type { ShowIdentity } from '@/types';

// F7: the utility bar's show pill renders on every marketing page, so the show-identity
// facts it needs are fetched once here rather than hardcoded into the component.
// nos-own-brand-chrome F1: /national-show/* swaps the SAOC header, footer and utility bar for
// the NOS own-brand chrome (ChromeFrame picks by route segment); every other route is unchanged.
// Brad (2026-10-16) keeps the SAOC utility bar above the NOS header, as its `nos` variant.
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const show = await sanityFetch<ShowIdentity>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });

  return (
    <>
      <ChromeFrame
        saoc={{
          skip: <SkipLink />,
          top: (
            <>
              <UtilityBar show={show} />
              <Header show={show} />
            </>
          ),
          bottom: <Footer />,
        }}
        nos={{
          skip: <NosSkipLink />,
          top: (
            <>
              <UtilityBar variant="nos" />
              <NosHeader show={show} />
            </>
          ),
          bottom: <NosFooter />,
        }}
      >
        {children}
      </ChromeFrame>
      <AdminPill />
    </>
  );
}
