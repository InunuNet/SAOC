// Interior pages — About, Societies (filterable), Judging.
const { useState: useStateInt, useMemo: useMemoInt } = React;

function PageHero({ eyebrow, title, lede, bg }) {
  const D = window.SAOC_DATA;
  const bgUrl = bg || D.images.greenhouse;
  return (
    <section className="pagehero">
      <div className="pagehero__bg" style={{ backgroundImage: `url("${bgUrl}")` }} />
      <div className="pagehero__scrim" />
      <div className="container pagehero__content">
        <div className="eyebrow eyebrow--light">{eyebrow}</div>
        <h1 className="pagehero__title">{title}</h1>
        {lede && <p className="pagehero__lede">{lede}</p>}
      </div>
    </section>
  );
}

// -------------------- ABOUT --------------------
function AboutPage() {
  const D = window.SAOC_DATA;
  return (
    <>
      <PageHero
        eyebrow="Our Heritage"
        title={
          <>
            A federated body of growers,
            <br />
            since 1968.
          </>
        }
        lede="Four societies met in Bloemfontein on the 28th of July 1968 to form a national council. Fifty-eight years later, that council coordinates twenty-one societies from the Cape to the Limpopo."
        bg={D.images.yearbook}
      />
      <Breadcrumb trail={['Home', 'About SAOC']} />

      <section className="section">
        <div className="container two-col">
          <div>
            <div className="eyebrow">The origin story</div>
            <h2 className="h2">Bloemfontein, 28 July 1968.</h2>
            <div className="prose">
              <p>
                On a winter's morning in the Free State, delegates from the Cape, Natal, Transvaal
                and Northern Transvaal Orchid Societies met in Bloemfontein and founded the South
                African Orchid Council. The intent was straightforward: a national body to
                coordinate shows, standardise judging, and give the country's growers a shared
                voice.
              </p>
              <p>
                In the decades since we have hosted eighteen National Orchid Shows, welcomed the
                21st World Orchid Conference to Sandton in 2014, published the annual yearbook{' '}
                <em>Orchids South Africa</em> without a break, and overhauled our judging system
                onto a regional model in 1990 — a structure that still underpins how accredited
                judges are trained today.
              </p>
            </div>
          </div>
          <figure className="figure">
            <div
              className="figure__img"
              style={{ backgroundImage: `url("${D.images.greenhouse}")` }}
            />
            <figcaption>Members' glasshouse — Cape Orchid Society, 2024.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="eyebrow" style={{ textAlign: 'center' }}>
            What we stand for
          </div>
          <h2
            className="h2"
            style={{ textAlign: 'center', maxWidth: 820, margin: '8px auto 40px' }}
          >
            Mission, vision and the line between us and WOSA.
          </h2>
          <div className="pillars">
            <div className="pillar">
              <div className="pillar__n">Mission</div>
              <p>
                To promote the culture, hybridisation and appreciation of orchids in South Africa —
                through education, a nationally standardised judging system, a network of affiliated
                societies, and a respected publication record.
              </p>
            </div>
            <div className="pillar">
              <div className="pillar__n">Vision</div>
              <p>
                A vibrant, skilled community of South African growers whose work sits alongside the
                best in the world — on show benches, in print, and at international conferences.
              </p>
            </div>
            <div className="pillar">
              <div className="pillar__n">Our remit</div>
              <p>
                Orchids <strong>in cultivation</strong>: growing, showing, hybridising, judging,
                community. For indigenous species in the wild, Wild Orchids of Southern Africa leads
                the work.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div>
              <div className="eyebrow">Board & Council 2025</div>
              <h2 className="h2">The people who run SAOC</h2>
            </div>
            <div className="mono-note">Elected biennially · AGM held in July</div>
          </div>
          <div className="board-grid">
            {D.board.map((m, i) => (
              <div key={i} className="board-card">
                <div className="board-card__avatar">
                  <span>
                    {m.name
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                </div>
                <div className="board-card__role">{m.role}</div>
                <div className="board-card__name">{m.name}</div>
                <div className="board-card__society">{m.society}</div>
                <div className="board-card__tenure mono">{m.tenure}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="container timeline">
          <div className="eyebrow eyebrow--light" style={{ textAlign: 'center' }}>
            Selected milestones
          </div>
          <h2 className="h2 h2--light" style={{ textAlign: 'center', marginBottom: 40 }}>
            A working chronology
          </h2>
          <div className="timeline__rail">
            {[
              { y: '1968', t: 'Council founded in Bloemfontein by four societies.' },
              { y: '1974', t: 'First combined National Orchid Show hosted under SAOC.' },
              { y: '1990', t: 'Judging system overhauled onto a regional model.' },
              { y: '2014', t: 'Sandton hosts the 21st World Orchid Conference.' },
              { y: '2024', t: '18th National Orchid Show, Durban — 1,240 entries.' },
              { y: '2027', t: '19th National Orchid Show, Cape Town.' },
            ].map((e, i) => (
              <div key={i} className="timeline__item">
                <div className="timeline__y">{e.y}</div>
                <div className="timeline__t">{e.t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// -------------------- SOCIETIES --------------------
function SocietiesPage() {
  const D = window.SAOC_DATA;
  const [province, setProvince] = useStateInt('ALL');
  const [q, setQ] = useStateInt('');

  const filtered = useMemoInt(() => {
    return D.societies
      .filter((s) => province === 'ALL' || s.province === province)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.region.toLowerCase().includes(q.toLowerCase())
      );
  }, [province, q]);

  const counts = useMemoInt(() => {
    const c = {};
    D.societies.forEach((s) => {
      c[s.province] = (c[s.province] || 0) + 1;
    });
    c.ALL = D.societies.length;
    return c;
  }, []);

  return (
    <>
      <PageHero
        eyebrow="Find a Society"
        title={
          <>
            Twenty-one societies,
            <br />
            nine provinces.
          </>
        }
        lede="Orchid societies are the heartbeat of SAOC. Each runs its own meetings, shows and community — find the one nearest you and get growing."
        bg={D.images.community}
      />
      <Breadcrumb trail={['Home', 'Affiliated Societies']} />

      <section className="section">
        <div className="container">
          <div className="filters">
            <div className="filters__chips">
              {D.provinces.map((p) => (
                <button
                  key={p.code}
                  className={`chip ${province === p.code ? 'is-active' : ''}`}
                  onClick={() => setProvince(p.code)}
                >
                  {p.name}
                  <span className="chip__n">{counts[p.code] || 0}</span>
                </button>
              ))}
            </div>
            <div className="filters__search">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by society or town…"
              />
            </div>
          </div>

          <div className="mono-note" style={{ marginTop: 10 }}>
            Showing {filtered.length} of {D.societies.length} societies
          </div>

          <div className="society-grid">
            {filtered.map((s, i) => (
              <div key={i} className="society-card">
                <div className="society-card__top">
                  <div className="society-card__badge" aria-hidden="true">
                    <SAOCOrchidMark size={24} color="var(--primary)" accent="var(--accent)" />
                  </div>
                  <div className="society-card__province mono">{s.province}</div>
                </div>
                <h3 className="society-card__name">{s.name}</h3>
                <div className="society-card__region">
                  {s.region} · Founded {s.founded}
                </div>
                <dl className="society-card__dl">
                  <div>
                    <dt>Meets</dt>
                    <dd>{s.meet}</dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>{s.venue}</dd>
                  </div>
                  <div>
                    <dt>Members</dt>
                    <dd>{s.members}</dd>
                  </div>
                </dl>
                <a href="#" className="society-card__link">
                  Society page <span>→</span>
                </a>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="eyebrow">No matches</div>
              <p>Try a different province or clear your search.</p>
              <button
                className="btn btn--outline"
                onClick={() => {
                  setProvince('ALL');
                  setQ('');
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="section section--tint">
        <div className="container cta-band">
          <div>
            <div className="eyebrow">Not near a society?</div>
            <h2 className="h2">Start one.</h2>
            <p>
              Ten members and a willing venue is all it takes. SAOC can help you affiliate, set up
              judging relationships and bring your first show to the calendar.
            </p>
          </div>
          <div>
            <a
              href="#contact"
              className="btn btn--primary"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('contact');
              }}
            >
              Talk to the council
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

// -------------------- JUDGING --------------------
function JudgingPage() {
  const D = window.SAOC_DATA;
  return (
    <>
      <PageHero
        eyebrow="Judging & Awards"
        title={
          <>
            A system rebuilt in 1990,
            <br />
            refined ever since.
          </>
        }
        lede="SAOC operates a nationally standardised judging system. Accredited judges train through a regional network, and awards follow the internationally recognised 100-point scale."
        bg={D.images.judging}
      />
      <Breadcrumb trail={['Home', 'Judging & Awards']} />

      <section className="section">
        <div className="container two-col">
          <div>
            <div className="eyebrow">How the system works</div>
            <h2 className="h2">Three regions, one standard.</h2>
            <div className="prose">
              <p>
                In 1990 the council restructured the judging system onto a regional model: judges
                train, gather and award within a region, but the point scale, the award thresholds
                and the plant classes are shared nationally. The result is consistency — an FCC
                awarded in Durban means the same thing as one awarded in Cape Town.
              </p>
              <p>
                New judges enter through a six-year training pathway: Student Judge (years 1–3),
                Accredited Judge (year 4+), with further progression to Senior Judge and National
                Judge based on years of service and demonstrated capability at National Show level.
              </p>
            </div>
            <div className="judge-stats">
              <div>
                <div className="mono-label">Accredited judges</div>
                <div className="judge-stats__n">56</div>
              </div>
              <div>
                <div className="mono-label">Student judges</div>
                <div className="judge-stats__n">23</div>
              </div>
              <div>
                <div className="mono-label">Regions</div>
                <div className="judge-stats__n">3</div>
              </div>
            </div>
          </div>
          <figure className="figure">
            <div
              className="figure__img figure__img--tall"
              style={{ backgroundImage: `url("${D.images.judging}")` }}
            />
            <figcaption>Judging panel at work — 18th National Show, Durban 2024.</figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="eyebrow">The awards</div>
          <h2 className="h2" style={{ marginBottom: 36 }}>
            Six awards, one 100-point scale.
          </h2>
          <div className="award-grid">
            {D.awards.map((a, i) => (
              <div key={i} className="award-card">
                <div className="award-card__code mono">{a.code}</div>
                <div className="award-card__name">{a.name}</div>
                <div className="award-card__threshold">{a.threshold}</div>
                <p className="award-card__desc">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-split">
          <div className="cta-split__side" style={{ backgroundImage: `url("${D.images.paph}")` }}>
            <div className="cta-split__scrim" />
            <div className="cta-split__tag">Training intake opens March 2026</div>
          </div>
          <div className="cta-split__body">
            <div className="eyebrow">Become a judge</div>
            <h2 className="h2">The six-year pathway.</h2>
            <ol className="steps">
              <li>
                <span className="steps__n">01</span>
                <div>
                  <div className="steps__t">Member in good standing</div>
                  <p>
                    Three years of active society membership, with verifiable plants exhibited on
                    regional benches.
                  </p>
                </div>
              </li>
              <li>
                <span className="steps__n">02</span>
                <div>
                  <div className="steps__t">Student Judge (yrs 1–3)</div>
                  <p>Attend regional judging days, sit written and practical exams each year.</p>
                </div>
              </li>
              <li>
                <span className="steps__n">03</span>
                <div>
                  <div className="steps__t">Accreditation</div>
                  <p>
                    Full voting judge at regional level. Eligible to sit on National Show panels
                    from year 5.
                  </p>
                </div>
              </li>
              <li>
                <span className="steps__n">04</span>
                <div>
                  <div className="steps__t">Senior & National</div>
                  <p>
                    Further progression based on years of service and National Show participation.
                  </p>
                </div>
              </li>
            </ol>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <a
                href="#contact"
                className="btn btn--primary"
                onClick={(e) => {
                  e.preventDefault();
                  window.__saoc_nav('contact');
                }}
              >
                Apply to join
              </a>
              <a href="#" className="btn btn--outline">
                Download handbook (PDF)
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Object.assign(window, { AboutPage, SocietiesPage, JudgingPage, PageHero });
