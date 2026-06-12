// Chrome — utility bar, main header, search overlay, mobile menu, footer, breadcrumb.
const { useState, useEffect, useRef } = React;

const NAV = [
  { id: 'about', label: 'About' },
  { id: 'societies', label: 'Societies' },
  { id: 'judging', label: 'Judging & Awards' },
  { id: 'show', label: 'National Show' },
  { id: 'events', label: 'Events' },
  { id: 'learn', label: 'Learn', disabled: true },
];

function UtilityBar() {
  return (
    <div style={{ background: 'var(--primary-800)', color: 'var(--ivory)' }}>
      <div
        className="container"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '8px 0',
          fontSize: 12.5,
          fontFamily: 'var(--sans)',
        }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a
            href="mailto:council@saoc.co.za"
            style={{
              color: 'inherit',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: 0.9,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            council@saoc.co.za
          </a>
          <span
            className="utility-tagline"
            style={{
              opacity: 0.55,
              fontFamily: 'var(--mono)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontSize: 10.5,
            }}
          >
            Making a difference since 1968
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="#show" className="ubtn ubtn--ghost">
            19th National Show · Sep 2027
          </a>
          <a href="#about" className="ubtn ubtn--pill">
            Join a society
          </a>
        </div>
      </div>
    </div>
  );
}

function Header({ route, onNavigate, onSearch }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  return (
    <>
      <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
        <div className="container header__inner">
          <a
            href="#home"
            className="header__logo"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('home');
            }}
          >
            <SAOCLogo size={48} tone="ink" />
          </a>
          <nav className="header__nav" aria-label="Primary">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`header__link ${route === n.id ? 'is-active' : ''} ${n.disabled ? 'is-disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (!n.disabled) onNavigate(n.id);
                }}
              >
                {n.label}
                {n.disabled && <span className="soon">Soon</span>}
              </a>
            ))}
          </nav>
          <div className="header__actions">
            <button className="iconbtn" aria-label="Search" onClick={onSearch}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
            </button>
            <a href="#signin" className="header__signin" onClick={(e) => e.preventDefault()}>
              Sign in
            </a>
            <a
              href="#contact"
              className="btn btn--primary btn--sm"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('contact');
              }}
            >
              Contact
            </a>
            <button
              className="iconbtn mobile-only"
              aria-label="Menu"
              onClick={() => setMobileOpen(true)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="mobile-menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div className="mobile-menu__panel">
            <div className="mobile-menu__top">
              <SAOCLogo size={40} tone="ink" />
              <button className="iconbtn" aria-label="Close" onClick={() => setMobileOpen(false)}>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <nav>
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className={`mobile-menu__link ${route === n.id ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!n.disabled) onNavigate(n.id);
                  }}
                >
                  {n.label}
                  {n.disabled && <span className="soon">Soon</span>}
                </a>
              ))}
            </nav>
            <div className="mobile-menu__foot">
              <a href="mailto:council@saoc.co.za" className="mobile-menu__meta">
                council@saoc.co.za
              </a>
              <span
                className="mobile-menu__meta"
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  opacity: 0.55,
                }}
              >
                Est. 1968
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SearchOverlay({ open, onClose, onNavigate }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
      setQ('');
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const suggestions = [
    { label: 'Find a society near me', target: 'societies' },
    { label: '19th National Orchid Show, 2027', target: 'show' },
    { label: 'Become a judge', target: 'judging' },
    { label: 'Orchids South Africa yearbook', target: 'about' },
    { label: '2025 show calendar', target: 'events' },
  ];

  const results =
    q.trim().length > 0
      ? [
          ...(window.SAOC_DATA.societies || [])
            .filter(
              (s) =>
                s.name.toLowerCase().includes(q.toLowerCase()) ||
                s.region.toLowerCase().includes(q.toLowerCase())
            )
            .slice(0, 5)
            .map((s) => ({ label: s.name, sub: s.region, target: 'societies' })),
          ...(window.SAOC_DATA.events || [])
            .filter(
              (e) =>
                e.title.toLowerCase().includes(q.toLowerCase()) ||
                e.venue.toLowerCase().includes(q.toLowerCase())
            )
            .slice(0, 5)
            .map((e) => ({ label: e.title, sub: `${e.venue} · ${e.date}`, target: 'events' })),
        ]
      : [];

  if (!open) return null;
  return (
    <div
      className="search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-overlay__panel">
        <div className="search-overlay__bar">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.55 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3-3" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search societies, shows, classes, awards…"
            className="search-overlay__input"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="search-overlay__body">
          {q.length === 0 && (
            <>
              <div className="search-overlay__label">Try searching for</div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="search-overlay__row"
                  onClick={() => {
                    onNavigate(s.target);
                    onClose();
                  }}
                >
                  <span>{s.label}</span>
                  <span className="search-overlay__target">{s.target}</span>
                </button>
              ))}
            </>
          )}
          {q.length > 0 && (
            <>
              <div className="search-overlay__label">
                {results.length} result{results.length === 1 ? '' : 's'}
              </div>
              {results.length === 0 && (
                <div className="search-overlay__empty">
                  No matches. Try "Cape", "Durban", "judging".
                </div>
              )}
              {results.map((r, i) => (
                <button
                  key={i}
                  className="search-overlay__row"
                  onClick={() => {
                    onNavigate(r.target);
                    onClose();
                  }}
                >
                  <div>
                    <div>{r.label}</div>
                    {r.sub && <div className="search-overlay__sub">{r.sub}</div>}
                  </div>
                  <span className="search-overlay__target">→ {r.target}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ trail }) {
  return (
    <div className="breadcrumb">
      <div className="container">
        {trail.map((t, i) => (
          <span key={i}>
            {i > 0 && <span className="breadcrumb__sep"> / </span>}
            {i < trail.length - 1 ? (
              <a href="#home">{t}</a>
            ) : (
              <span className="breadcrumb__current">{t}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function Footer({ onNavigate }) {
  const D = window.SAOC_DATA;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <SAOCLogo variant="stacked" size={64} tone="paper" />
            <p className="footer__mission">
              A national coordinating body for 21 affiliated orchid societies across South Africa —
              promoting culture, hybridisation and appreciation of orchids in cultivation since
              1968.
            </p>
            <div className="footer__meta">
              <span className="mono">Reg# 1978/004040/08</span>
              <span className="mono">NPO 043-901</span>
            </div>
          </div>

          <div>
            <div className="footer__label">Explore</div>
            {NAV.filter((n) => !n.disabled).map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(n.id);
                }}
                className="footer__link"
              >
                {n.label}
              </a>
            ))}
          </div>

          <div>
            <div className="footer__label">Partners</div>
            {D.partners.map((p, i) => (
              <a key={i} className="footer__link" href="#">
                {p}
              </a>
            ))}
          </div>

          <div>
            <div className="footer__label">Stay in touch</div>
            <p
              style={{
                color: 'rgba(245,239,228,0.65)',
                fontSize: 13.5,
                lineHeight: 1.6,
                margin: '0 0 12px',
              }}
            >
              Quarterly bulletin — show dates, judging results and yearbook news.
            </p>
            <form
              className="footer__form"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <input type="email" placeholder="your@email.co.za" required />
              <button type="submit">Subscribe</button>
            </form>
            <div style={{ marginTop: 20 }}>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  color: 'rgba(245,239,228,0.55)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Looking for wild orchids?
              </div>
              <a
                href="#"
                className="footer__link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Visit Wild Orchids of Southern Africa →
              </a>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <div>© {new Date().getFullYear()} South African Orchid Council. All rights reserved.</div>
          <div className="footer__links-inline">
            <a href="#">Privacy</a>
            <a href="#">Constitution</a>
            <a href="#">Media kit</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Header, UtilityBar, Footer, SearchOverlay, Breadcrumb, NAV });
