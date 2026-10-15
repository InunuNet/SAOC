'use client';

// =============================================================
// NOS — components/nos-chrome/NosHeader.tsx
// The NOS own-brand header for /national-show/*: the supplied full-colour
// lockup (links the hub), SAOC's top-level menu in NOS type, a click-only
// National Show mega-menu, the Tickets call to action, and (below 1260px) a
// menu panel. Labels, descriptors and hrefs all come from nav-config; the venue
// and dates come from the nationalShow singleton via show-meta. Renders the
// header and the menu panel as siblings so the panel can inert the rest of the
// page without inerting itself.
// =============================================================

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV } from '@/components/chrome/nav-config';
import type { NavColumn, NavItem } from '@/components/chrome/nav-config';
import type { ShowIdentity } from '@/types';

import { nosChromeFontClass } from './fonts';
import { getShowMeta } from './show-meta';
import './nos-chrome.css';

type MegaItem = Extract<NavItem, { type: 'mega' }>;

const HUB_HREF = '/national-show';
const TICKETS_HREF = '/national-show/tickets';
const CONTACT_HREF = '/contact';
const LOCKUP_SRC = '/images/nos/nos-full-colour-horizontal-1200.png';
const LOCKUP_ALT = 'National Orchid Show, Western Cape 2027';
const LOCKUP_WIDTH = 1200;
const LOCKUP_HEIGHT = 294;
const PANEL_BREAKPOINT_QUERY = '(min-width: 1260px)';
const INERT_SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE']);
const SUB_ID = 'nd-sub-national-show';

const megaItem = NAV.find((n): n is MegaItem => n.type === 'mega');

function Chevron() {
  return (
    <svg className="nc-chev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

function groupsOf(mega: MegaItem): NavColumn[] {
  return [mega.lead?.theShow, ...mega.columns].filter((c): c is NavColumn => Boolean(c));
}

interface NosHeaderProps {
  /** The nationalShow Sanity singleton, fetched once in app/(marketing)/layout.tsx. */
  show?: ShowIdentity | null;
}

export function NosHeader({ show }: NosHeaderProps) {
  const pathname = usePathname();
  const meta = getShowMeta(show);
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // Set only by an explicit close (Menu button, Escape); every other close (a followed link, a
  // navigation, the viewport widening, unmount) leaves the scroll position alone.
  const restoreOnCloseRef = useRef(false);

  // Any navigation (Tickets button, back/forward, a link) closes both surfaces, so the new page
  // is never left inert behind an open panel.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setMegaOpen(false);
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

  // Mega-menu: a mousedown outside the item closes it.
  useEffect(() => {
    if (!megaOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node) || !itemRef.current?.contains(e.target)) setMegaOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [megaOpen]);

  // Escape closes whichever surface is open and returns focus to its opener.
  useEffect(() => {
    if (!megaOpen && !drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (drawerOpen) {
        restoreOnCloseRef.current = true;
        setDrawerOpen(false);
        burgerRef.current?.focus({ preventScroll: true });
      } else {
        setMegaOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [megaOpen, drawerOpen]);

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

  const current = (href: string) => (pathname === href ? ('page' as const) : undefined);
  const toggleDrawer = () => {
    restoreOnCloseRef.current = drawerOpen;
    setDrawerOpen(!drawerOpen);
  };

  const renderLeaf = (link: NavColumn['links'][number]) => (
    <li key={link.id}>
      <Link href={link.href} aria-current={current(link.href)}>
        <span className="nh-leaf">{link.label}</span>
        {link.descriptor && <span className="nh-desc">{link.descriptor}</span>}
      </Link>
    </li>
  );

  const railLinks =
    megaItem?.featureRail?.destinations.filter((d) => d.variant === 'secondary') ?? [];

  return (
    <>
      <span id="nh-sentinel" className="nh-sentinel" ref={sentinelRef} />
      <header
        id="nh"
        ref={headerRef}
        className={`nh ${nosChromeFontClass}${scrolled ? ' is-scrolled' : ''}`}
      >
        <div className="nh-bar">
          <Link
            className="nh-brand"
            href={HUB_HREF}
            aria-label={`${LOCKUP_ALT}, National Show home`}
            aria-current={current(HUB_HREF)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the supplied lockup ships byte-for-byte; next/image would re-encode it */}
            <img
              src={LOCKUP_SRC}
              alt={LOCKUP_ALT}
              width={LOCKUP_WIDTH}
              height={LOCKUP_HEIGHT}
              loading="eager"
              fetchPriority="high"
            />
          </Link>

          <nav className="nh-nav" aria-label="Primary">
            <ul>
              {NAV.map((n) => {
                if (n.type === 'link') {
                  return (
                    <li key={n.id}>
                      <Link className="nh-link" href={n.href} aria-current={current(n.href)}>
                        {n.label}
                      </Link>
                    </li>
                  );
                }
                return (
                  <li
                    key={n.id}
                    id="nh-show"
                    ref={itemRef}
                    onBlur={(e) => {
                      const next = e.relatedTarget;
                      if (!(next instanceof Node && e.currentTarget.contains(next))) {
                        setMegaOpen(false);
                      }
                    }}
                  >
                    <button
                      id="nh-show-trigger"
                      ref={triggerRef}
                      type="button"
                      className="nh-trigger"
                      aria-expanded={megaOpen}
                      aria-controls="nh-mega"
                      data-current=""
                      onClick={() => setMegaOpen((open) => !open)}
                    >
                      <span className="nh-label">{n.label}</span>
                      <Chevron />
                    </button>
                    <div
                      id="nh-mega"
                      className="nh-mega"
                      hidden={!megaOpen}
                      onClick={(e) => {
                        if (e.target instanceof Element && e.target.closest('a')) setMegaOpen(false);
                      }}
                    >
                      <div className="nh-mega-grid">
                        {n.lead && (
                          <div className="nh-mega-lead">
                            <Link
                              className="nh-mega-lead-link"
                              href={n.lead.leadHref}
                              aria-current={current(n.lead.leadHref)}
                            >
                              {n.lead.leadLabel}
                            </Link>
                            {meta.lead && <span className="nh-mega-meta">{meta.lead}</span>}
                            <h3 className="nh-mega-head">{n.lead.theShow.heading}</h3>
                            <ul className="nh-mega-list">{n.lead.theShow.links.map(renderLeaf)}</ul>
                          </div>
                        )}
                        {n.columns.map((column) => (
                          <div key={column.id} className="nh-mega-col">
                            <h3 className="nh-mega-head">{column.heading}</h3>
                            <ul className="nh-mega-list">{column.links.map(renderLeaf)}</ul>
                          </div>
                        ))}
                        {n.featureRail && (
                          <div className="nh-mega-rail">
                            {meta.rail && <span className="nh-mega-meta">{meta.rail}</span>}
                            <h4>{n.featureRail.heading}</h4>
                            <ul className="nh-mega-list">
                              {railLinks.map((d) => (
                                <li key={d.id}>
                                  <Link href={d.href} aria-current={current(d.href)}>
                                    <span className="nh-leaf">{d.label}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>

          <Link className="nh-cta" href={TICKETS_HREF} aria-current={current(TICKETS_HREF)}>
            Tickets
          </Link>

          <button
            id="nh-burger"
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

      <div
        id="nd"
        ref={drawerRef}
        className={`nd ${nosChromeFontClass}`}
        hidden={!drawerOpen}
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest('a')) setDrawerOpen(false);
        }}
      >
        <nav className="nd-inner" aria-label="Menu">
          <ul className="nd-list">
            {NAV.map((n) => {
              if (n.type === 'link') {
                return (
                  <li key={n.id}>
                    <Link className="nd-item" href={n.href} aria-current={current(n.href)}>
                      {n.label}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className="nd-item"
                    data-sub=""
                    data-current=""
                    aria-expanded={subOpen}
                    aria-controls={SUB_ID}
                    onClick={() => setSubOpen((open) => !open)}
                  >
                    <span>{n.label}</span>
                    <Chevron />
                  </button>
                  <div id={SUB_ID} className="nd-sub" hidden={!subOpen}>
                    {n.lead && (
                      <div className="nd-lead">
                        <Link href={n.lead.leadHref} aria-current={current(n.lead.leadHref)}>
                          {n.lead.leadLabel}
                        </Link>
                        {meta.lead && <span>{meta.lead}</span>}
                      </div>
                    )}
                    {groupsOf(n).map((group) => (
                      <div key={group.id} className="nd-group">
                        <h3>{group.heading}</h3>
                        <ul>{group.links.map(renderLeaf)}</ul>
                      </div>
                    ))}
                    {n.featureRail && (
                      <div className="nd-group">
                        <h3>{n.featureRail.heading}</h3>
                        <ul>
                          {railLinks.map((d) => (
                            <li key={d.id}>
                              <Link href={d.href} aria-current={current(d.href)}>
                                <span className="nh-leaf">{d.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            <li>
              <Link className="nd-item" href={CONTACT_HREF} aria-current={current(CONTACT_HREF)}>
                Contact
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
