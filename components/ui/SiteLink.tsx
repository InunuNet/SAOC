// components/ui/SiteLink.tsx
// Server Component. The one anchor for any link whose destination may be the other site (SAOC <->
// National Orchid Show) or an external origin. lib/link-target.ts decides from the resolved href and
// the site this page is rendered for: a link that leaves the site opens in a new tab (target and rel)
// and carries the repo's screen-reader cue; a same-site link stays a normal next/link in the same tab.
// `portableLinkMarks` gives Sanity portable text the same rule for its `link` annotation.
import Link from 'next/link';
import type { PortableTextComponents } from '@portabletext/react';
import type { ComponentProps, ReactNode } from 'react';

import { NEW_TAB_CUE, newTabAttrs } from '@/lib/link-target';
import type { Site } from '@/lib/site-hosts';

type AnchorProps = Omit<ComponentProps<'a'>, 'href' | 'target' | 'rel'>;

export interface SiteLinkProps extends AnchorProps {
  href: string;
  /** The site this page is rendered for. */
  own: Site;
  /** Passed to next/link on a same-site link only. */
  prefetch?: boolean;
  children?: ReactNode;
}

export function SiteLink({ href, own, prefetch, children, ...rest }: SiteLinkProps) {
  const attrs = newTabAttrs(href, own);
  if (attrs.target) {
    return (
      <a href={href} {...attrs} {...rest}>
        {children}
        <span className="sr-only"> {NEW_TAB_CUE}</span>
      </a>
    );
  }
  if (href.startsWith('/')) {
    return (
      <Link href={href} prefetch={prefetch} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

interface LinkMarkValue {
  href?: string;
}

/** The portable-text `link` mark for the `own` site: same new-tab rule as every other anchor. */
export function portableLinkMarks(own: Site): NonNullable<PortableTextComponents['marks']> {
  return {
    link: ({ value, children }) => {
      const href = (value as LinkMarkValue | undefined)?.href; // Sanity link annotation: { _type: 'link', href }
      if (!href) return <>{children}</>;
      return (
        <SiteLink href={href} own={own}>
          {children}
        </SiteLink>
      );
    },
  };
}
