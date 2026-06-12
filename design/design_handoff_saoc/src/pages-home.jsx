// Home page — full hero crossfade, mission, 4 nav blocks, show countdown, events strip, partners.
const { useState: useStateHome, useEffect: useEffectHome } = React;

function HeroCrossfade({ variant = 'full' }) {
  const D = window.SAOC_DATA;
  const [idx, setIdx] = useStateHome(0);

  useEffectHome(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % D.heroImages.length), 5500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="hero">
      <div className="hero__images">
        {D.heroImages.map((im, i) => (
          <div
            key={i}
            className="hero__image"
            style={{
              backgroundImage: `url("${im.url}")`,
              opacity: idx === i ? 1 : 0,
            }}
          />
        ))}
        <div className="hero__scrim" />
      </div>
      <div className="container hero__content">
        <div className="eyebrow eyebrow--light">Since 1968 · Bloemfontein</div>
        <h1 className="hero__title">
          The national home of <em>orchid culture</em>
          <br />
          in South Africa.
        </h1>
        <p className="hero__lede">
          Twenty-one affiliated societies. A nationally standardised judging system. A flagship show
          every three years. This is where cultivated orchids are grown, studied, exhibited and
          celebrated.
        </p>
        <div className="hero__ctas">
          <a
            href="#societies"
            className="btn btn--primary"
            onClick={(e) => {
              e.preventDefault();
              window.__saoc_nav('societies');
            }}
          >
            Find your society
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <a
            href="#show"
            className="btn btn--ghost"
            onClick={(e) => {
              e.preventDefault();
              window.__saoc_nav('show');
            }}
          >
            19th National Show, 2027
          </a>
        </div>
        <div className="hero__dots">
          {D.heroImages.map((_, i) => (
            <button
              key={i}
              aria-label={`Image ${i + 1}`}
              className={`hero__dot ${idx === i ? 'is-active' : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ShowCountdown() {
  const D = window.SAOC_DATA;
  const [remain, setRemain] = useStateHome(() => computeRemain(D.nextShowDate));
  useEffectHome(() => {
    const t = setInterval(() => setRemain(computeRemain(D.nextShowDate)), 1000);
    return () => clearInterval(t);
  }, []);
  function computeRemain(iso) {
    const total = new Date(iso).getTime() - Date.now();
    if (total < 0) return { d: 0, h: 0, m: 0, s: 0 };
    const d = Math.floor(total / (1000 * 60 * 60 * 24));
    const h = Math.floor((total / (1000 * 60 * 60)) % 24);
    const m = Math.floor((total / (1000 * 60)) % 60);
    const s = Math.floor((total / 1000) % 60);
    return { d, h, m, s };
  }
  const Cell = ({ n, label }) => (
    <div className="countdown__cell">
      <div className="countdown__n">{String(n).padStart(2, '0')}</div>
      <div className="countdown__l">{label}</div>
    </div>
  );
  return (
    <div className="countdown">
      <Cell n={remain.d} label="Days" />
      <Cell n={remain.h} label="Hours" />
      <Cell n={remain.m} label="Minutes" />
      <Cell n={remain.s} label="Seconds" />
    </div>
  );
}

function MissionBlock() {
  return (
    <section className="section mission">
      <div className="container mission__grid">
        <div>
          <div className="eyebrow">Our purpose</div>
          <h2 className="h2">
            Where South African growers bring their finest blooms to the bench.
          </h2>
        </div>
        <div className="mission__body">
          <p>
            SAOC exists to promote the culture, hybridisation and appreciation of orchids across
            South Africa. We do this through a federated network of 21 societies, a nationally
            accredited judging system first standardised in 1990, and our annual publication{' '}
            <em>Orchids South Africa</em>.
          </p>
          <p>
            Our remit is orchids <strong>in cultivation</strong> — on the show bench, in the
            greenhouse, and in the community. For indigenous species in the wild, our sibling
            organisation{' '}
            <a href="#" className="inline-link">
              Wild Orchids of Southern Africa
            </a>{' '}
            leads that work.
          </p>
          <div className="mission__stats">
            <div>
              <div className="mission__n">21</div>
              <div className="mission__l">Affiliated societies</div>
            </div>
            <div>
              <div className="mission__n">1968</div>
              <div className="mission__l">Founding year</div>
            </div>
            <div>
              <div className="mission__n">18</div>
              <div className="mission__l">National shows hosted</div>
            </div>
            <div>
              <div className="mission__n">56</div>
              <div className="mission__l">Accredited judges</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NavBlocks() {
  const D = window.SAOC_DATA;
  const blocks = [
    {
      id: 'societies',
      label: 'Societies',
      title: 'Twenty-one societies, nine provinces',
      body: 'From Cape Town to Polokwane — meet the affiliates, find one near you.',
      img: D.images.community,
      count: '21 societies',
    },
    {
      id: 'show',
      label: 'National Show',
      title: 'The 19th National Orchid Show, 2027',
      body: 'Every three years. Four days. A thousand plants at their peak.',
      img: D.images.bench,
      count: 'Sep 2027 · Cape Town',
    },
    {
      id: 'judging',
      label: 'Judging',
      title: 'A system overhauled in 1990, still evolving',
      body: 'AM, FCC, HCC and the regional judging network — how we award quality.',
      img: D.images.judging,
      count: '56 accredited judges',
    },
    {
      id: 'about',
      label: 'About',
      title: 'Since 1968, a federated body',
      body: 'Founded in Bloemfontein by four societies. Today a national council.',
      img: D.images.yearbook,
      count: 'Reg# 1978/004040/08',
    },
  ];
  return (
    <section className="section navblocks">
      <div className="container">
        <div className="section__head">
          <div>
            <div className="eyebrow">Find your way in</div>
            <h2 className="h2">Four ways into SAOC</h2>
          </div>
        </div>
        <div className="navblocks__grid">
          {blocks.map((b) => (
            <a
              key={b.id}
              href={`#${b.id}`}
              className="navblock"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav(b.id);
              }}
            >
              <div className="navblock__img" style={{ backgroundImage: `url("${b.img}")` }}>
                <div className="navblock__badge">{b.label}</div>
              </div>
              <div className="navblock__body">
                <h3 className="navblock__title">{b.title}</h3>
                <p className="navblock__body-text">{b.body}</p>
                <div className="navblock__meta">
                  <span>{b.count}</span>
                  <span className="navblock__arrow">→</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function NextShowStrip() {
  const D = window.SAOC_DATA;
  const next = D.shows.find((s) => s.status === 'upcoming');
  return (
    <section className="section nextshow">
      <div className="container nextshow__grid">
        <div className="nextshow__img" style={{ backgroundImage: `url("${D.images.bench}")` }} />
        <div className="nextshow__body">
          <div className="eyebrow eyebrow--light">Flagship event</div>
          <h2 className="h2 h2--light">
            The {ordinal(next.edition)} South African
            <br />
            National Orchid Show
          </h2>
          <div className="nextshow__meta">
            <div>
              <div className="mono-label">Dates</div>
              <div>{next.month} 2027</div>
            </div>
            <div>
              <div className="mono-label">Host region</div>
              <div>{next.host}</div>
            </div>
            <div>
              <div className="mono-label">Venue</div>
              <div>{next.venue}</div>
            </div>
            <div>
              <div className="mono-label">Duration</div>
              <div>{next.days} days</div>
            </div>
          </div>
          <ShowCountdown />
          <div className="nextshow__ctas">
            <a
              href="#show"
              className="btn btn--accent"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('show');
              }}
            >
              Show details
            </a>
            <a
              href="#show"
              className="btn btn--ghost btn--ghost-light"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('show');
              }}
            >
              Exhibitor info
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function UpcomingEventsStrip() {
  const D = window.SAOC_DATA;
  const upcoming = D.events.filter((e) => new Date(e.date) >= new Date('2025-03-01')).slice(0, 5);
  return (
    <section className="section events-strip">
      <div className="container">
        <div className="section__head">
          <div>
            <div className="eyebrow">What's on</div>
            <h2 className="h2">Upcoming society shows</h2>
          </div>
          <a
            href="#events"
            className="section__link"
            onClick={(e) => {
              e.preventDefault();
              window.__saoc_nav('events');
            }}
          >
            Full calendar
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
        </div>
        <div className="events-strip__list">
          {upcoming.map((e) => {
            const d = new Date(e.date);
            return (
              <a
                key={e.id}
                href="#events"
                className="event-row"
                onClick={(ev) => {
                  ev.preventDefault();
                  window.__saoc_nav('events');
                }}
              >
                <div className="event-row__date">
                  <div className="event-row__d">{d.getDate()}</div>
                  <div className="event-row__m">
                    {d.toLocaleDateString('en-ZA', { month: 'short' }).toUpperCase()}
                  </div>
                  <div className="event-row__y">{d.getFullYear()}</div>
                </div>
                <div className="event-row__body">
                  <div className="event-row__kind">{e.kind}</div>
                  <div className="event-row__title">{e.title}</div>
                  <div className="event-row__venue">{e.venue}</div>
                </div>
                <div className="event-row__host">{e.host}</div>
                <div className="event-row__arrow">→</div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function YearbookStrip() {
  const D = window.SAOC_DATA;
  return (
    <section className="section yearbook-strip">
      <div className="container yearbook-strip__grid">
        <div className="yearbook-strip__body">
          <div className="eyebrow">In print</div>
          <h2 className="h2">Orchids South Africa · 2025 yearbook</h2>
          <p>
            Our annual record of award-winning plants, hybridisation notes, society reports and
            judges' commentary. 184 pages. Available to members or via direct subscription.
          </p>
          <div className="yearbook-strip__meta">
            <div>
              <div className="mono-label">Editor</div>
              <div>Lindiwe Khumalo</div>
            </div>
            <div>
              <div className="mono-label">Pages</div>
              <div>184</div>
            </div>
            <div>
              <div className="mono-label">ISSN</div>
              <div>1816-0336</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <a
              href="#about"
              className="btn btn--primary"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('about');
              }}
            >
              Subscribe
            </a>
            <a
              href="#about"
              className="btn btn--outline"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('about');
              }}
            >
              Past editions
            </a>
          </div>
        </div>
        <div
          className="yearbook-strip__img"
          style={{ backgroundImage: `url("${D.images.yearbook}")` }}
        >
          <div className="yearbook-strip__tag">Est. 1968</div>
        </div>
      </div>
    </section>
  );
}

function PartnersFooter() {
  const D = window.SAOC_DATA;
  return (
    <section className="section partners">
      <div className="container">
        <div className="eyebrow" style={{ textAlign: 'center' }}>
          In collaboration with
        </div>
        <div className="partners__grid">
          {D.partners.map((p, i) => (
            <div key={i} className="partners__item">
              {p}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'],
    v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function HomePage() {
  return (
    <>
      <HeroCrossfade />
      <MissionBlock />
      <NavBlocks />
      <NextShowStrip />
      <UpcomingEventsStrip />
      <YearbookStrip />
      <PartnersFooter />
    </>
  );
}

Object.assign(window, { HomePage, ordinal });
