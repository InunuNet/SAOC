'use client';

// =============================================================
// NOS — components/nos-chrome/NosHeader.tsx
// The National Orchid Show site's own header (nos-site-split F3, NOS Design R1): the supplied
// full-colour lockup (links the NOS home), a top row of three click-only disclosure panels
// (Visit, Programme, Exhibit & trade), Show sponsors, Past shows (withheld in public until there is
// content, r64) and Contact (SAOC organises the show, so Contact is the SAOC contact), the Tickets
// call to action, and below 1384px a menu panel that ends with the SAOC credit. Labels, descriptors
// and order come from nos-nav.ts, which the SAOC site's old show mega carried verbatim; hrefs are
// shown as their public clean paths (nosPath). There is no SAOC utility bar here (R1.5).
// Renders the header and the menu panel as siblings so the panel can inert the rest of the page
// without inerting itself.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CONTACT_LINK } from '@/components/chrome/nav-config';
import type { NavColumn, NavItem, NavLeaf } from '@/components/chrome/nav-config';
import { FOOTER_ORG_NAME } from '@/components/chrome/footer-data';
import { anyNavCurrent, navAriaCurrent } from '@/lib/nav-current';
import { nosPath } from '@/lib/nos-paths';
import { SHOW_TITLE_EXPANDED } from '@/lib/show-title';

import { nosChromeFontClass } from './fonts';
import './nos-chrome.css';

type MegaItem = Extract<NavItem, { type: 'mega' }>;

const HUB_HREF = '/';
const LOCKUP_SRC = '/images/nos/nos-full-colour-horizontal-2400.png';
const LOCKUP_ALT = SHOW_TITLE_EXPANDED;
const LOCKUP_WIDTH = 2400;
const LOCKUP_HEIGHT = 589;
// The box is 448px wide from 780px up; below it the box follows the viewport up to 448px (390px
// at a 390px viewport, see LOCKUP_SIZES_NARROW). A width with no `sizes` gives a
// pixel-density list that stops at twice the box, which under-serves a 3x screen. The `sizes` below
// gives a width srcset over the whole variant ladder, so a 3x screen picks a wide enough one (LG-1).
const LOCKUP_BOX_WIDE = 448;
const LOCKUP_BOX_NARROW = 390;
// Below 780px the image is 110.6% of the container (viewport minus a 16px gutter each side), capped
// at the 448px box, so it reaches 448px from about 437px wide. 390px is only its width at 390.
const LOCKUP_SIZES_NARROW = `min(${LOCKUP_BOX_WIDE}px, calc(110.6vw - 35.4px))`;
const PANEL_BREAKPOINT_QUERY = '(min-width: 1384px)';
const INERT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE']);
// The "The show" links the top row carries as plain links; Tickets is the call to action.
const TICKETS_LEAF_ID = 'tickets';
const PLAIN_LEAF_IDS = ['show-sponsors', 'past-shows'] as const;

const lockupProps = (width: number, sizes: string) =>
  getImageProps({
    priority: true,
    src: LOCKUP_SRC,
    alt: LOCKUP_ALT,
    width,
    height: Math.round((width * LOCKUP_HEIGHT) / LOCKUP_WIDTH),
    sizes,
  }).props;
const wideLockup = lockupProps(LOCKUP_BOX_WIDE, `${LOCKUP_BOX_WIDE}px`);
const narrowLockup = lockupProps(LOCKUP_BOX_NARROW, LOCKUP_SIZES_NARROW);

function Chevron() {
  return (
    <svg className="nc-chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

interface NosHeaderProps {
  /** The show nav (lib/data/past-shows-public.ts getVisibleNav), without withheld routes. */
  nav: readonly NavItem[];
  /**
   * Absolute SAOC URLs, resolved on the server. This is a client component, and the SAOC origin
   * can come from a variable the client bundle does not carry, so it is never resolved here.
   */
  saocHomeHref: string;
  /** The show's own contact page (public NOS path). */
  contactHref: string;
}

export function NosHeader({ nav, saocHomeHref, contactHref }: NosHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // At most one top-row disclosure panel is open at a time.
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Drawer disclosure sections, independent of the top row.
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  // Set only by an explicit close (Menu button, Escape); every other close (a followed link, a
  // navigation, the viewport widening, unmount) leaves the scroll position alone.
  const restoreOnCloseRef = useRef(false);

  const mega = nav.find((n): n is MegaItem => n.type === 'mega');
  const groups: NavColumn[] = mega?.columns ?? [];
  const showLeaves = mega?.lead?.theShow.links ?? [];
  const ticketsLeaf = showLeaves.find((l) => l.id === TICKETS_LEAF_ID);
  const plainLeaves = PLAIN_LEAF_IDS.map((id) => showLeaves.find((l) => l.id === id)).filter(
    (l): l is NavLeaf => Boolean(l),
  );

  // Any navigation (Tickets button, back/forward, a link) closes both surfaces, so the new page
  // is never left inert behind an open panel.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpenGroupId(null);
    setDrawerOpen(false);
  }

  // Header elevation: the sentinel sits at the very top of the document, so it leaves the
  // viewport as soon as the page scrolls.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Disclosure panels: a mousedown outside the top row closes the open one.
  useEffect(() => {
    if (!openGroupId) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !navRef.current?.contains(e.target)) setOpenGroupId(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [openGroupId]);

  // Escape closes whichever surface is open and returns focus to its opener.
  useEffect(() => {
    if (!openGroupId && !drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drawerOpen) {
        restoreOnCloseRef.current = true;
        setDrawerOpen(false);
        burgerRef.current?.focus({ preventScroll: true });
      } else {
        const opener = navRef.current?.querySelector<HTMLElement>(
          `[data-group-trigger="${openGroupId}"]`,
        );
        setOpenGroupId(null);
        opener?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openGroupId, drawerOpen]);

  // Menu panel: the header stays live, everything else on the path to <body> goes inert, the
  // body stops scrolling, and on phones (header not sticky) the page returns to the top and
  // goes back to where it was on close (unless a link was followed).
  useEffect(() => {
    if (!drawerOpen) return;
    const header = headerRef.current;
    const drawer = drawerRef.current;
    if (!header || !drawer) return;

    const restoreY = getComputedStyle(header).position === 'sticky' ? null : window.scrollY;
    if (restoreY !== null) window.scrollTo(0, 0);

    const inerted: Element[] = [];
    for (let node: Element = header; node !== document.body && node.parentElement; ) {
      const parent: Element = node.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node || sibling === drawer || INERT_SKIP_TAGS.has(sibling.tagName)) continue;
        sibling.setAttribute('inert', '');
        inerted.push(sibling);
      }
      node = parent;
    }
    // A classic scrollbar vanishes with the lock; pad the body by its width so the header does not
    // shift sideways. Overlay scrollbars measure 0 and need nothing.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = 'hidden';
    drawer.style.top = `${Math.max(0, header.getBoundingClientRect().bottom)}px`;
    const first = Array.from(drawer.querySelectorAll<HTMLElement>('a, button')).find(
      (n) => n.offsetParent !== null,
    );
    first?.focus();

    return () => {
      for (const el of inerted) el.removeAttribute('inert');
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      drawer.style.top = '';
      if (restoreY !== null && restoreOnCloseRef.current) window.scrollTo(0, restoreY);
      restoreOnCloseRef.current = false;
    };
  }, [drawerOpen]);

  // The panel is for narrow viewports; it closes itself when the full nav takes over.
  useEffect(() => {
    const query = window.matchMedia(PANEL_BREAKPOINT_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setDrawerOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Hrefs are shown as public clean paths. The matcher accepts both the public and the internal
  // form, so the header also reads correctly on a host-less dev origin. A disclosure trigger does
  // not navigate, so it carries aria-current="true" (not "page") when one of its pages is current.
  const current = (href: string) => navAriaCurrent(pathname, href);
  const groupCurrent = (group: NavColumn) =>
    anyNavCurrent(
      pathname,
      group.links.map((l) => l.href),
    )
      ? ('true' as const)
      : undefined;
  const toggleDrawer = () => {
    restoreOnCloseRef.current = drawerOpen;
    setDrawerOpen(!drawerOpen);
  };

  const renderLeaf = (link: NavLeaf) => (
    <li key={link.id}>
      <Link href={nosPath(link.href)} aria-current={current(link.href)}>
        <span className="nh-leaf">{link.label}</span>
        {link.descriptor && <span className="nh-desc">{link.descriptor}</span>}
      </Link>
    </li>
  );

  return (
    <>
      <span id="nh-sentinel" className="nh-sentinel" ref={sentinelRef} />
      <header
        id="nh"
        ref={headerRef}
        className={`nh ${nosChromeFontClass}${scrolled ? ' is-scrolled' : ''}`}
      >
        <div className="nh-bar" data-hd="bar">
          <Link
            className="nh-brand"
            data-hd="brand"
            href={HUB_HREF}
            aria-label={`${LOCKUP_ALT}, National Show home`}
            aria-current={current(HUB_HREF)}
          >
            <picture>
              <source
                media="(max-width: 779px)"
                srcSet={narrowLockup.srcSet}
                sizes={narrowLockup.sizes}
              />
              <img
                {...wideLockup}
                alt={LOCKUP_ALT}
                width={LOCKUP_WIDTH}
                height={LOCKUP_HEIGHT}
                loading="eager"
                fetchPriority="high"
              />
            </picture>
          </Link>

          <nav className="nh-nav" data-hd="nav" aria-label="Primary">
            <ul ref={navRef}>
              {groups.map((group) => {
                const open = openGroupId === group.id;
                return (
                  <li
                    key={group.id}
                    className="nh-item"
                    onBlur={(e) => {
                      const next = e.relatedTarget;
                      if (open && !(next instanceof Node && e.currentTarget.contains(next))) {
                        setOpenGroupId(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="nh-trigger"
                      data-hd="item"
                      data-group-trigger={group.id}
                      aria-expanded={open}
                      aria-controls={`nh-panel-${group.id}`}
                      aria-current={groupCurrent(group)}
                      onClick={() => setOpenGroupId(open ? null : group.id)}
                    >
                      <span className="nh-label" data-hd="label">
                        {group.heading}
                      </span>
                      <Chevron />
                    </button>
                    <div
                      id={`nh-panel-${group.id}`}
                      className="nh-panel"
                      hidden={!open}
                      onClick={(e) => {
                        if (e.target instanceof Element && e.target.closest('a')) {
                          setOpenGroupId(null);
                        }
                      }}
                    >
                      <ul className="nh-mega-list">{group.links.map(renderLeaf)}</ul>
                    </div>
                  </li>
                );
              })}
              {plainLeaves.map((leaf) => (
                <li key={leaf.id}>
                  <Link
                    className="nh-link"
                    data-hd="item"
                    href={nosPath(leaf.href)}
                    aria-current={current(leaf.href)}
                  >
                    <span className="nh-label" data-hd="label">
                      {leaf.label}
                    </span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  className="nh-link"
                  data-hd="item"
                  href={contactHref}
                  aria-current={current(contactHref)}
                >
                  <span className="nh-label" data-hd="label">
                    {CONTACT_LINK.label}
                  </span>
                </Link>
              </li>
            </ul>
          </nav>

          {ticketsLeaf && (
            <Link
              className="nh-cta"
              data-hd="cta"
              href={nosPath(ticketsLeaf.href)}
            >
              {ticketsLeaf.label}
            </Link>
          )}

          <button
            id="nh-burger"
            data-hd="menu"
            ref={burgerRef}
            type="button"
            className="nh-burger"
            aria-expanded={drawerOpen}
            aria-controls="nd"
            onClick={toggleDrawer}
          >
            <svg className="is-bars" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <svg className="is-x" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span className="nh-burger-label">{drawerOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
      </header>

      <nav
        id="nd"
        aria-label="Main menu"
        ref={drawerRef}
        className={`nd ${nosChromeFontClass}`}
        hidden={!drawerOpen}
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest('a')) setDrawerOpen(false);
        }}
      >
        <div className="nd-inner">
          <ul className="nd-list">
            {groups.map((group) => {
              const open = drawerGroupId === group.id;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className="nd-item"
                    data-sub=""
                    aria-current={groupCurrent(group)}
                    aria-expanded={open}
                    aria-controls={`nd-sub-${group.id}`}
                    onClick={() => setDrawerGroupId(open ? null : group.id)}
                  >
                    <span>{group.heading}</span>
                    <Chevron />
                  </button>
                  <div id={`nd-sub-${group.id}`} className="nd-sub" hidden={!open}>
                    <div className="nd-group">
                      <ul>{group.links.map(renderLeaf)}</ul>
                    </div>
                  </div>
                </li>
              );
            })}
            {plainLeaves.map((leaf) => (
              <li key={leaf.id}>
                <Link className="nd-item" href={nosPath(leaf.href)} aria-current={current(leaf.href)}>
                  {leaf.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className="nd-item" href={contactHref} aria-current={current(contactHref)}>
                {CONTACT_LINK.label}
              </Link>
            </li>
          </ul>
          {/* R1.4: after a rule, the SAOC credit as text only: the organisation's name, linking
              to the SAOC site. */}
          <p className="nd-credit">
            <a href={saocHomeHref}>{FOOTER_ORG_NAME}</a>
          </p>
        </div>
      </nav>
    </>
  );
}
