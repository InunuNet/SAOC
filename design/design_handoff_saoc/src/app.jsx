// App shell — routing, state, tweaks integration, global keyboard.
const { useState: useStateApp, useEffect: useEffectApp, useCallback: useCBApp } = React;

const ROUTES = ['home', 'about', 'societies', 'judging', 'show', 'events', 'contact'];

function App() {
  const [route, setRoute] = useStateApp(() => {
    const h = window.location.hash.replace('#', '');
    return ROUTES.includes(h) ? h : 'home';
  });
  const [searchOpen, setSearchOpen] = useStateApp(false);

  useEffectApp(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (ROUTES.includes(h)) setRoute(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffectApp(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (
        e.key === '/' &&
        document.activeElement.tagName !== 'INPUT' &&
        document.activeElement.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navigate = useCBApp((id) => {
    window.location.hash = id;
    setRoute(id);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffectApp(() => {
    window.__saoc_nav = navigate;
  }, [navigate]);

  let Page = HomePage;
  if (route === 'about') Page = AboutPage;
  else if (route === 'societies') Page = SocietiesPage;
  else if (route === 'judging') Page = JudgingPage;
  else if (route === 'show') Page = ShowPage;
  else if (route === 'events') Page = EventsPage;
  else if (route === 'contact') Page = ContactPage;

  return (
    <div className="app">
      <UtilityBar />
      <Header route={route} onNavigate={navigate} onSearch={() => setSearchOpen(true)} />
      <main key={route} className="main">
        <Page />
      </main>
      <Footer onNavigate={navigate} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
      <TweaksPanel />
    </div>
  );
}

// Tweaks panel
function TweaksPanel() {
  const [active, setActive] = useStateApp(false);
  const [tweaks, setTweaks] = useStateApp(() => ({ ...window.SAOC_TWEAKS }));

  useEffectApp(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode') setActive(true);
      if (e.data?.type === '__deactivate_edit_mode') setActive(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  function apply(patch) {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    window.SAOC_TWEAKS = next;
    window.__applyTweaks(next);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  }

  if (!active) return null;

  return (
    <div className="tweaks">
      <div className="tweaks__head">
        <div>
          <div className="tweaks__title">Tweaks</div>
          <div className="tweaks__sub mono">Live variants</div>
        </div>
      </div>
      <div className="tweaks__body">
        <div className="tweaks__group">
          <div className="tweaks__label">Display serif</div>
          <div className="tweaks__row">
            {[
              { id: 'crimson', name: 'Crimson Pro' },
              { id: 'playfair', name: 'Playfair' },
              { id: 'cormorant', name: 'Cormorant' },
              { id: 'fraunces', name: 'Fraunces' },
              { id: 'eb', name: 'EB Garamond' },
            ].map((f) => (
              <button
                key={f.id}
                className={`tweaks__btn ${tweaks.serif === f.id ? 'is-active' : ''}`}
                onClick={() => apply({ serif: f.id })}
              >
                <span style={{ fontFamily: `var(--serif-${f.id})`, fontSize: 16, fontWeight: 600 }}>
                  Aa
                </span>
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tweaks__group">
          <div className="tweaks__label">Density</div>
          <div className="tweaks__row">
            {['generous', 'compact'].map((d) => (
              <button
                key={d}
                className={`tweaks__btn ${tweaks.density === d ? 'is-active' : ''}`}
                onClick={() => apply({ density: d })}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
