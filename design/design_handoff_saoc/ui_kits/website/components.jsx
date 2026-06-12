// SAOC Website UI Kit — modular components matching the live site.
// All components export to window; one styles object per component.

const { useState: useStateK } = React;

// LOGO — horizontal mark + wordmark + tagline
function Logo({ size = 44, tone = 'ink', showTag = true }) {
  const src =
    tone === 'paper'
      ? '../../assets/saoc-logo-flat-paper.png'
      : '../../assets/saoc-logo-ink-paper.png';
  const fg = tone === 'paper' ? 'var(--ivory)' : 'var(--ink)';
  const sub = tone === 'paper' ? 'rgba(244,243,236,0.65)' : 'var(--muted)';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: fg }}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      <div style={{ lineHeight: 1.02 }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: Math.max(19, size * 0.48),
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          SA Orchid Council
        </div>
        {showTag && (
          <div
            className="saoc-logo__tag"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: Math.max(9.5, size * 0.195),
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginTop: 5,
              color: sub,
              whiteSpace: 'nowrap',
            }}
          >
            Making a difference since 1968
          </div>
        )}
      </div>
    </div>
  );
}

// EYEBROW
function Eyebrow({ children, tone = 'default' }) {
  const styles =
    tone === 'light'
      ? {
          background: 'rgba(255,255,255,0.12)',
          color: 'var(--ivory)',
          border: '1px solid rgba(255,255,255,0.22)',
        }
      : { background: 'var(--bone)', color: 'var(--primary)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px',
        borderRadius: 999,
        fontFamily: 'var(--mono)',
        fontSize: 11,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...styles,
      }}
    >
      {children}
    </span>
  );
}

// BUTTON
function Button({ children, variant = 'primary', size = 'md', onDark = false, ...rest }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: size === 'sm' ? '9px 14px' : '13px 20px',
    fontFamily: 'var(--sans)',
    fontSize: size === 'sm' ? 13 : 14,
    fontWeight: 500,
    borderRadius: 2,
    border: '1px solid transparent',
    cursor: 'pointer',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'all 150ms ease',
  };
  const variants = {
    primary: { background: 'var(--primary)', color: 'var(--ivory)' },
    accent: { background: 'var(--accent)', color: 'var(--ink)' },
    outline: {
      background: 'transparent',
      color: onDark ? 'var(--ivory)' : 'var(--ink)',
      borderColor: onDark ? 'var(--ivory)' : 'var(--ink)',
    },
    ghost: onDark
      ? {
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--ivory)',
          border: '1px solid rgba(244,243,236,0.4)',
        }
      : { background: 'transparent', color: 'var(--ink)', border: '1px solid rgba(28,22,24,0.25)' },
  };
  return (
    <button {...rest} style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

// NAVBLOCK
function NavBlock({ label, title, body, img, count }) {
  return (
    <a
      href="#"
      style={{
        textDecoration: 'none',
        color: 'var(--ink)',
        background: 'var(--parchment)',
        border: '1px solid var(--rule)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 200ms',
      }}
    >
      <div
        style={{
          aspectRatio: '4/5',
          backgroundImage: `url("${img}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(22,26,22,0.75)',
            color: 'var(--ivory)',
            backdropFilter: 'blur(8px)',
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '5px 11px',
            borderRadius: 2,
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ padding: 22, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 22,
            lineHeight: 1.18,
            margin: '0 0 12px',
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.55, marginBottom: 18 }}>
          {body}
        </div>
        <div
          style={{
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid var(--rule)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--muted)',
          }}
        >
          <span>{count}</span>
          <span style={{ color: 'var(--primary)', fontSize: 18 }}>→</span>
        </div>
      </div>
    </a>
  );
}

// SOCIETY CARD
function SocietyCard({ name, region, province, members, founded }) {
  return (
    <div
      style={{
        background: 'var(--parchment)',
        border: '1px solid var(--rule)',
        padding: 24,
        transition: 'all 200ms',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div style={{ width: 36, height: 36, background: 'var(--rule-soft)' }} />
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            color: 'var(--accent)',
            background: 'rgba(158,140,107,0.14)',
            padding: '4px 8px',
            textTransform: 'uppercase',
          }}
        >
          {province}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, lineHeight: 1.2 }}>
        {name}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>{region}</div>
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12 }}>
          <dt
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            Members
          </dt>
          <dd style={{ margin: 0, fontSize: 13 }}>{members}</dd>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12 }}>
          <dt
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
            }}
          >
            Founded
          </dt>
          <dd style={{ margin: 0, fontSize: 13 }}>{founded}</dd>
        </div>
      </dl>
    </div>
  );
}

// EVENT ROW
function EventRow({ d, m, y, kind, title, venue, host }) {
  return (
    <a
      href="#"
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 1fr auto auto',
        gap: 24,
        alignItems: 'center',
        padding: '20px 0',
        borderBottom: '1px solid var(--rule)',
        textDecoration: 'none',
        color: 'var(--ink)',
      }}
    >
      <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 14 }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 32,
            fontWeight: 500,
            lineHeight: 1,
            color: 'var(--primary)',
          }}
        >
          {d}
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.16em',
            color: 'var(--muted)',
            marginTop: 4,
          }}
        >
          {m} {y}
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
          }}
        >
          {kind}
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginTop: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{venue}</div>
      </div>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          textAlign: 'right',
        }}
      >
        {host}
      </div>
      <span style={{ color: 'var(--primary)', fontSize: 18 }}>→</span>
    </a>
  );
}

// HEADER (chrome) — responsive: collapses nav + tagline + utility bar < 1100px
function Header() {
  const [open, setOpen] = useStateK(false);
  return (
    <header className="saoc-header">
      <style>{`
        .saoc-header { background:var(--parchment); border-bottom:1px solid var(--rule); position:relative; }
        .saoc-header__util { background:var(--primary-800); color:var(--ivory); }
        .saoc-header__util-inner { display:flex; justify-content:space-between; padding:8px 0; font-size:12.5px; font-family:var(--sans); }
        .saoc-header__util-tag { opacity:0.55; font-family:var(--mono); letter-spacing:0.16em; text-transform:uppercase; font-size:10.5px; white-space:nowrap; }
        .saoc-header__main { display:flex; align-items:center; justify-content:space-between; padding:18px 0; gap:16px; }
        .saoc-header__nav { display:flex; gap:4px; }
        .saoc-header__nav a { padding:10px 14px; text-decoration:none; color:var(--ink); font-size:14px; font-weight:500; position:relative; white-space:nowrap; }
        .saoc-header__nav a.is-active { color:var(--primary); }
        .saoc-header__nav a.is-active::after { content:""; position:absolute; left:14px; right:14px; bottom:4px; height:2px; background:var(--accent); }
        .saoc-header__menu { display:none; background:transparent; border:1px solid rgba(28,22,24,0.25); border-radius:2px; padding:9px 14px; font-family:var(--mono); font-size:11px; letter-spacing:0.18em; text-transform:uppercase; cursor:pointer; }
        .saoc-header__sheet { display:none; position:absolute; left:0; right:0; top:100%; background:var(--parchment); border-bottom:1px solid var(--rule); padding:8px 0 16px; flex-direction:column; z-index:30; box-shadow:0 12px 24px rgba(34,40,31,0.06); }
        .saoc-header__sheet a { padding:14px 32px; text-decoration:none; color:var(--ink); font-size:15px; border-bottom:1px solid var(--rule-soft); }
        .saoc-header__sheet a.is-active { color:var(--primary); }
        .saoc-header__sheet.is-open { display:flex; }
        @media (max-width: 1240px) {
          .saoc-header__util-tag { display:none; }
          .saoc-header__nav { display:none; }
          .saoc-header__menu { display:inline-flex; }
          .saoc-header .saoc-logo__tag { display:none; }
        }
        @media (max-width: 640px) {
          .saoc-header__cta { display:none; }
        }
      `}</style>
      <div className="saoc-header__util">
        <div className="container saoc-header__util-inner">
          <a
            href="mailto:council@saoc.co.za"
            style={{ color: 'inherit', textDecoration: 'none', opacity: 0.9 }}
          >
            council@saoc.co.za
          </a>
          <span className="saoc-header__util-tag">Making a difference since 1968</span>
        </div>
      </div>
      <div className="container saoc-header__main">
        <Logo size={48} />
        <nav className="saoc-header__nav">
          {['About', 'Societies', 'Judging', 'National Show', 'Events', 'Contact'].map((n, i) => (
            <a key={n} href="#" className={i === 3 ? 'is-active' : ''}>
              {n}
            </a>
          ))}
        </nav>
        <button
          className="saoc-header__menu"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <div className="saoc-header__cta">
          <Button variant="primary" size="sm">
            Become a member
          </Button>
        </div>
      </div>
      <div className={'saoc-header__sheet' + (open ? ' is-open' : '')}>
        {['About', 'Societies', 'Judging', 'National Show', 'Events', 'Contact'].map((n, i) => (
          <a key={n} href="#" className={i === 3 ? 'is-active' : ''} onClick={() => setOpen(false)}>
            {n}
          </a>
        ))}
      </div>
    </header>
  );
}

// FOOTER
function Footer() {
  return (
    <footer
      className="saoc-footer"
      style={{ background: 'var(--primary-800)', color: 'var(--ivory)', padding: '72px 0 28px' }}
    >
      <style>{`
        .saoc-footer__grid { display:grid; grid-template-columns:1.5fr 1fr 1fr 1.2fr; gap:40px; }
        @media (max-width: 900px) { .saoc-footer__grid { grid-template-columns:1fr 1fr; } }
        @media (max-width: 520px) { .saoc-footer__grid { grid-template-columns:1fr; } }
      `}</style>
      <div className="container saoc-footer__grid">
        <div>
          <Logo size={56} tone="paper" />
          <p
            style={{
              color: 'rgba(244,243,236,0.65)',
              fontSize: 14,
              lineHeight: 1.6,
              margin: '24px 0 0',
              maxWidth: 320,
            }}
          >
            A federated body coordinating twenty-one orchid societies across South Africa since
            1968.
          </p>
        </div>
        {[
          ['Council', ['About', 'Board', 'Constitution']],
          ['Programmes', ['National Show', 'Judging', 'Events']],
          ['Contact', ['council@saoc.co.za', '+27 21 555 0100', 'PO Box 8412, Cape Town']],
        ].map(([label, rows]) => (
          <div key={label}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--accent-soft)',
                marginBottom: 16,
              }}
            >
              {label}
            </div>
            {rows.map((r) => (
              <div
                key={r}
                style={{ color: 'rgba(244,243,236,0.75)', padding: '5px 0', fontSize: 14 }}
              >
                {r}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        className="container"
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid rgba(244,243,236,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          color: 'rgba(244,243,236,0.5)',
          fontSize: 13,
        }}
      >
        <span>© 2026 South African Orchid Council · Reg# 1978/004040/08</span>
        <span style={{ display: 'flex', gap: 24 }}>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>
            Privacy
          </a>
          <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>
            Sitemap
          </a>
        </span>
      </div>
    </footer>
  );
}

Object.assign(window, { Logo, Eyebrow, Button, NavBlock, SocietyCard, EventRow, Header, Footer });
