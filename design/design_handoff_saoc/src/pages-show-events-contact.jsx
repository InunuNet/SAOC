// National Show hub, Events calendar, Contact page.
const { useState: useStateShow, useEffect: useEffectShow, useMemo: useMemoShow } = React;

function ShowPage() {
  const D = window.SAOC_DATA;
  const next = D.shows.find((s) => s.status === 'upcoming');
  const past = D.shows.filter((s) => s.status === 'past');
  return (
    <>
      <section className="show-hero">
        <div className="show-hero__bg" style={{ backgroundImage: `url("${D.images.bench}")` }} />
        <div className="show-hero__scrim" />
        <div className="container show-hero__content">
          <div className="eyebrow eyebrow--light">The Flagship</div>
          <div className="show-hero__edition mono">XIX · Nineteenth Edition</div>
          <h1 className="show-hero__title">
            The South African
            <br />
            National Orchid Show
          </h1>
          <div className="show-hero__meta">
            <div>
              <div className="mono-label">Dates</div>
              <div>18–21 September 2027</div>
            </div>
            <div>
              <div className="mono-label">Host</div>
              <div>Western Cape</div>
            </div>
            <div>
              <div className="mono-label">Venue</div>
              <div>Cape Town ICC</div>
            </div>
            <div>
              <div className="mono-label">Cycle</div>
              <div>Every three years</div>
            </div>
          </div>
          <div style={{ marginTop: 28 }}>
            <ShowCountdown />
          </div>
          <div className="show-hero__ctas">
            <a href="#" className="btn btn--accent">
              Exhibitor registration opens Jul 2026
            </a>
            <a href="#" className="btn btn--ghost btn--ghost-light">
              Download the brief
            </a>
          </div>
        </div>
      </section>
      <Breadcrumb trail={['Home', 'National Orchid Show']} />

      <section className="section">
        <div className="container two-col">
          <div>
            <div className="eyebrow">What it is</div>
            <h2 className="h2">Four days. A thousand plants at their peak.</h2>
            <div className="prose">
              <p>
                The South African National Orchid Show is SAOC's flagship event, held every three
                years in a different host province. Over four days the country's finest cultivated
                orchids converge on a single venue — judged against a unified point system, awarded
                in ten classes, and seen by thousands of visitors.
              </p>
              <p>
                The show is both a competition and a gathering: display exhibits from each society,
                vendor tables, hybridiser talks, and a judges' symposium running on parallel tracks.
              </p>
            </div>
          </div>
          <div className="show-stats">
            <div>
              <div className="show-stats__n">18</div>
              <div className="show-stats__l">Editions hosted</div>
            </div>
            <div>
              <div className="show-stats__n">3</div>
              <div className="show-stats__l">Year cycle</div>
            </div>
            <div>
              <div className="show-stats__n">10</div>
              <div className="show-stats__l">Show classes</div>
            </div>
            <div>
              <div className="show-stats__n">1,240</div>
              <div className="show-stats__l">Entries, 2024</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="eyebrow">The three-year cycle</div>
          <h2 className="h2">A show that travels.</h2>
          <div className="cycle">
            <div className="cycle__item cycle__item--past">
              <div className="cycle__y">2024</div>
              <div className="cycle__host">KwaZulu-Natal</div>
              <div className="cycle__role">18th · Durban ICC</div>
            </div>
            <div className="cycle__rail" />
            <div className="cycle__item cycle__item--current">
              <div className="cycle__y">2027</div>
              <div className="cycle__host">Western Cape</div>
              <div className="cycle__role">19th · Cape Town ICC</div>
              <div className="cycle__badge">Next</div>
            </div>
            <div className="cycle__rail" />
            <div className="cycle__item cycle__item--future">
              <div className="cycle__y">2030</div>
              <div className="cycle__host">Gauteng</div>
              <div className="cycle__role">20th · Provisional</div>
            </div>
          </div>
          <p className="cycle__note">
            Host selection rotates between SAOC's three regions. 2030 host confirmation at the 2027
            AGM.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="eyebrow">Classes & judging</div>
          <h2 className="h2">Ten groups, judged side-by-side.</h2>
          <div className="classes-grid">
            {D.showClasses.map((c, i) => (
              <div key={i} className="classes-card">
                <div className="classes-card__icon mono">{c.icon}</div>
                <div className="classes-card__group mono">{c.group}</div>
                <div className="classes-card__name">{c.name}</div>
                <p className="classes-card__desc">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--dark">
        <div className="container">
          <div className="eyebrow eyebrow--light">Exhibitor information</div>
          <h2 className="h2 h2--light">Bringing plants to the bench.</h2>
          <div className="exhibitor-grid">
            <div className="exhibitor-card">
              <div className="exhibitor-card__stage mono">Stage 01</div>
              <div className="exhibitor-card__title">Intent to enter</div>
              <div className="exhibitor-card__when">Jul 2026 — Mar 2027</div>
              <p>
                Declare plants and estimated class. Society coordinators collect intent forms
                regionally.
              </p>
            </div>
            <div className="exhibitor-card">
              <div className="exhibitor-card__stage mono">Stage 02</div>
              <div className="exhibitor-card__title">Delivery & setup</div>
              <div className="exhibitor-card__when">16–17 Sep 2027</div>
              <p>
                Plants received, staged and labelled. Society displays built. Judging rooms
                prepared.
              </p>
            </div>
            <div className="exhibitor-card">
              <div className="exhibitor-card__stage mono">Stage 03</div>
              <div className="exhibitor-card__title">Judging & awards</div>
              <div className="exhibitor-card__when">18 Sep 2027</div>
              <p>
                Closed-benches morning session. Awards photographed and logged before public
                opening.
              </p>
            </div>
            <div className="exhibitor-card">
              <div className="exhibitor-card__stage mono">Stage 04</div>
              <div className="exhibitor-card__title">Public days</div>
              <div className="exhibitor-card__when">19–21 Sep 2027</div>
              <p>Four days of public viewing, vendor hall, talks and the judges' symposium.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <div>
              <div className="eyebrow">Past shows</div>
              <h2 className="h2">A record of eighteen editions.</h2>
            </div>
            <div className="mono-note">Full archive in Phase 2</div>
          </div>
          <div className="past-grid">
            {past.map((s, i) => (
              <div key={i} className="past-card">
                <div
                  className="past-card__img"
                  style={{
                    backgroundImage: `url("${D.images['past' + s.edition] || D.images.bench}")`,
                  }}
                >
                  <div className="past-card__edition mono">{ordinal(s.edition)}</div>
                </div>
                <div className="past-card__body">
                  <div className="past-card__year">
                    {s.year} · {s.host}
                  </div>
                  <div className="past-card__venue">{s.venue}</div>
                  <div className="past-card__stats">
                    {s.entries && <span>{s.entries.toLocaleString()} entries</span>}
                    {s.visitors && <span>{s.visitors.toLocaleString()} visitors</span>}
                    {s.trophies && <span>{s.trophies} trophies</span>}
                  </div>
                  {s.note && <div className="past-card__note mono">{s.note}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container cta-band">
          <div>
            <div className="eyebrow">For growers</div>
            <h2 className="h2">Start planning your entry now.</h2>
            <p>
              Show-quality plants take seasons, not weeks. Talk to your society's coordinator about
              repotting cycles, award candidates and transport logistics.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href="#societies"
              className="btn btn--primary"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('societies');
              }}
            >
              Find your society
            </a>
            <a
              href="#contact"
              className="btn btn--outline"
              onClick={(e) => {
                e.preventDefault();
                window.__saoc_nav('contact');
              }}
            >
              Ask the council
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

// -------------------- EVENTS --------------------
function EventsPage() {
  const D = window.SAOC_DATA;
  const [kind, setKind] = useStateShow('ALL');
  const [month, setMonth] = useStateShow('ALL');
  const [view, setView] = useStateShow('list');

  const kinds = ['ALL', 'Show', 'Workshop', 'Council', 'Launch'];
  const months = useMemoShow(() => {
    const seen = new Set();
    D.events.forEach((e) => {
      const d = new Date(e.date);
      seen.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return ['ALL', ...Array.from(seen).sort()];
  }, []);

  const filtered = useMemoShow(() => {
    return D.events
      .filter((e) => {
        if (kind !== 'ALL' && e.kind !== kind) return false;
        if (month !== 'ALL') {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (key !== month) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [kind, month]);

  function fmtMonthLabel(m) {
    if (m === 'ALL') return 'All months';
    const [y, mm] = m.split('-');
    return new Date(Number(y), Number(mm) - 1, 1).toLocaleDateString('en-ZA', {
      month: 'long',
      year: 'numeric',
    });
  }

  // Group by month for list view
  const groups = useMemoShow(() => {
    const g = {};
    filtered.forEach((e) => {
      const d = new Date(e.date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      (g[k] = g[k] || []).push(e);
    });
    return g;
  }, [filtered]);

  return (
    <>
      <PageHero
        eyebrow="Events"
        title={<>The 2025–2026 show calendar.</>}
        lede="Twenty-plus shows, workshops and council meetings a year. Filter by province, kind or month — or see them laid out on a timeline."
        bg={D.images.cymbidium}
      />
      <Breadcrumb trail={['Home', 'Events Calendar']} />

      <section className="section">
        <div className="container">
          <div className="events-filters">
            <div className="events-filters__group">
              <div className="mono-label">Kind</div>
              <div className="filters__chips">
                {kinds.map((k) => (
                  <button
                    key={k}
                    className={`chip ${kind === k ? 'is-active' : ''}`}
                    onClick={() => setKind(k)}
                  >
                    {k === 'ALL' ? 'All kinds' : k}
                  </button>
                ))}
              </div>
            </div>
            <div className="events-filters__group">
              <div className="mono-label">Month</div>
              <select className="select" value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {fmtMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>
            <div className="events-filters__group" style={{ marginLeft: 'auto' }}>
              <div className="mono-label">View</div>
              <div className="seg">
                <button
                  className={`seg__btn ${view === 'list' ? 'is-active' : ''}`}
                  onClick={() => setView('list')}
                >
                  List
                </button>
                <button
                  className={`seg__btn ${view === 'timeline' ? 'is-active' : ''}`}
                  onClick={() => setView('timeline')}
                >
                  Timeline
                </button>
              </div>
            </div>
          </div>

          <div className="mono-note" style={{ marginTop: 8 }}>
            {filtered.length} event{filtered.length === 1 ? '' : 's'} ·{' '}
            {kind === 'ALL' ? 'all kinds' : kind.toLowerCase()} ·{' '}
            {fmtMonthLabel(month).toLowerCase()}
          </div>

          {view === 'list' && (
            <div className="events-list">
              {Object.keys(groups)
                .sort()
                .map((k) => (
                  <div key={k} className="events-list__group">
                    <h3 className="events-list__head">{fmtMonthLabel(k)}</h3>
                    {groups[k].map((e) => {
                      const d = new Date(e.date);
                      const end = e.endDate ? new Date(e.endDate) : null;
                      return (
                        <div key={e.id} className="event-row">
                          <div className="event-row__date">
                            <div className="event-row__d">
                              {d.getDate()}
                              {end ? `–${end.getDate()}` : ''}
                            </div>
                            <div className="event-row__m">
                              {d.toLocaleDateString('en-ZA', { month: 'short' }).toUpperCase()}
                            </div>
                            <div className="event-row__y">{d.getFullYear()}</div>
                          </div>
                          <div className="event-row__body">
                            <div className="event-row__kind">
                              {e.kind} · {e.province}
                            </div>
                            <div className="event-row__title">{e.title}</div>
                            <div className="event-row__venue">{e.venue}</div>
                          </div>
                          <div className="event-row__host">{e.host}</div>
                          <a href="#" className="event-row__arrow">
                            →
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}

          {view === 'timeline' && (
            <div className="timeline-view">
              {Object.keys(groups)
                .sort()
                .map((k) => (
                  <div key={k} className="timeline-view__month">
                    <div className="timeline-view__label">{fmtMonthLabel(k)}</div>
                    <div className="timeline-view__row">
                      {groups[k].map((e) => (
                        <div
                          key={e.id}
                          className={`timeline-view__chip timeline-view__chip--${e.kind.toLowerCase()}`}
                        >
                          <div className="timeline-view__title">{e.title}</div>
                          <div className="timeline-view__venue">{e.venue}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="eyebrow">No events match</div>
              <button
                className="btn btn--outline"
                onClick={() => {
                  setKind('ALL');
                  setMonth('ALL');
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// -------------------- CONTACT --------------------
function ContactPage() {
  const D = window.SAOC_DATA;
  const [form, setForm] = useStateShow({
    name: '',
    email: '',
    topic: 'General enquiry',
    society: '',
    message: '',
  });
  const [errors, setErrors] = useStateShow({});
  const [submitted, setSubmitted] = useStateShow(false);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: null }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.message.trim().length < 10)
      e.message = 'A bit more detail, please — 10 characters minimum';
    return e;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setSubmitted(true);
  }

  return (
    <>
      <PageHero
        eyebrow="Get in Touch"
        title={
          <>
            Questions, media,
            <br />
            or a plant to show.
          </>
        }
        lede="The fastest route is through your local society — but the council is here for anything national, judging-related, or press."
        bg={D.images.community}
      />
      <Breadcrumb trail={['Home', 'Contact']} />

      <section className="section">
        <div className="container contact-grid">
          <div>
            <div className="eyebrow">Direct lines</div>
            <h2 className="h2">Reach the right desk.</h2>
            <div className="contact-list">
              {[
                {
                  role: 'General enquiries',
                  name: 'Council Secretary',
                  email: 'council@saoc.co.za',
                },
                {
                  role: 'Judging & accreditation',
                  name: 'Prof. Johan Botha',
                  email: 'judging@saoc.co.za',
                },
                {
                  role: 'Yearbook submissions',
                  name: 'Lindiwe Khumalo',
                  email: 'yearbook@saoc.co.za',
                },
                { role: 'National Show 2027', name: 'Show Committee', email: 'show@saoc.co.za' },
                { role: 'Media & press', name: 'Communications', email: 'media@saoc.co.za' },
              ].map((c, i) => (
                <div key={i} className="contact-item">
                  <div className="contact-item__role mono">{c.role}</div>
                  <div className="contact-item__name">{c.name}</div>
                  <a href={`mailto:${c.email}`} className="contact-item__email">
                    {c.email}
                  </a>
                </div>
              ))}
            </div>

            <div className="postal">
              <div className="mono-label">Postal</div>
              <div>South African Orchid Council</div>
              <div>PO Box 1968, Bloemfontein 9300</div>
              <div>South Africa</div>
            </div>
          </div>

          {!submitted ? (
            <form className="form" onSubmit={onSubmit} noValidate>
              <div className="eyebrow">Send a message</div>
              <h2 className="h2">Write to the council.</h2>

              <div className={`field ${errors.name ? 'is-error' : ''}`}>
                <label>Name</label>
                <input value={form.name} onChange={(e) => update('name', e.target.value)} />
                {errors.name && <div className="field__err">{errors.name}</div>}
              </div>
              <div className={`field ${errors.email ? 'is-error' : ''}`}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
                {errors.email && <div className="field__err">{errors.email}</div>}
              </div>
              <div className="field">
                <label>Topic</label>
                <select value={form.topic} onChange={(e) => update('topic', e.target.value)}>
                  {[
                    'General enquiry',
                    'Judging',
                    'Yearbook',
                    'National Show 2027',
                    'Media',
                    'Starting a society',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>
                  Your society{' '}
                  <span className="mono" style={{ opacity: 0.5 }}>
                    (optional)
                  </span>
                </label>
                <select value={form.society} onChange={(e) => update('society', e.target.value)}>
                  <option value="">—</option>
                  {D.societies.map((s) => (
                    <option key={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className={`field ${errors.message ? 'is-error' : ''}`}>
                <label>Message</label>
                <textarea
                  rows="5"
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                />
                {errors.message && <div className="field__err">{errors.message}</div>}
              </div>

              <button type="submit" className="btn btn--primary btn--block">
                Send message
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
              </button>
              <div className="mono-note" style={{ marginTop: 14 }}>
                Typical response within 3 working days. Urgent? Phone your regional society
                coordinator.
              </div>
            </form>
          ) : (
            <div className="form-success">
              <div className="form-success__icon">✓</div>
              <h2 className="h2">Message received.</h2>
              <p>
                Thanks {form.name.split(' ')[0] || 'for writing'} — we'll come back to you at{' '}
                <strong>{form.email}</strong> within three working days.
              </p>
              <button
                className="btn btn--outline"
                onClick={() => {
                  setSubmitted(false);
                  setForm({
                    name: '',
                    email: '',
                    topic: 'General enquiry',
                    society: '',
                    message: '',
                  });
                }}
              >
                Send another
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

Object.assign(window, { ShowPage, EventsPage, ContactPage });
