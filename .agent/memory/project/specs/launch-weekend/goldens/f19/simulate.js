// Architect self-test only (F19_SIMULATE=1 in contracts/checks/launch-weekend/f19/_lib.mjs). A throwaway DOM/CSS patch that
// imitates the intended F19 result on an UNTOUCHED main build, so each runtime check can be seen going green. It is NOT a
// reference implementation and is never run by the gate. It does not cover the axis (A7) or /judging (A8) checks.
(() => {
  const css = document.createElement('style');
  css.textContent = `
    @media (max-width: 639px) { [data-hero-ctas] { width: 100%; flex-direction: column; } [data-hero-ctas] > a { width: 100%; justify-content: center; text-align: center; } }
    @media (max-width: 767px) { [data-hero-scrim="veil"] { background: radial-gradient(ellipse 100% 62% at 50% 50%, rgb(34 40 31 / .90) 0%, rgb(34 40 31 / .86) 70%, rgb(34 40 31 / 0) 100%) !important; } }
    [data-yearbook-content] { justify-content: flex-start !important; gap: 32px !important; align-self: start; }
    [data-page-hero] p { font-size: 16px !important; line-height: 1.55 !important; }`;
  document.head.appendChild(css);

  const hero = document.querySelector('section[aria-roledescription=carousel]');
  if (hero) {
    const old = hero.querySelector(':scope > div[aria-hidden=true]:not([role])'); if (old) old.remove();
    const content = hero.lastElementChild;
    const add = (k, bg) => { const d = document.createElement('div'); d.setAttribute('data-hero-scrim', k); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;inset:0;background:' + bg; hero.insertBefore(d, content); };
    add('diagonal', 'linear-gradient(135deg, rgb(56 65 56 / .60) 0%, rgb(56 65 56 / .25) 100%)');
    add('veil', 'radial-gradient(ellipse 56% 54% at 50% 50%, rgb(34 40 31 / .88) 0%, rgb(34 40 31 / .84) 62%, rgb(34 40 31 / 0) 100%)');
    add('bone', 'linear-gradient(to top, #e8e6dc 0, rgb(232 230 220 / 0) 80px)');
    const lede = hero.querySelector('p'); lede.setAttribute('data-hero-lede', '');
    const h1 = hero.querySelector('h1'); h1.style.marginBottom = '20px';
    const a0 = hero.querySelector('a[href]');
    if (a0) { const wrap = a0.parentElement; wrap.setAttribute('data-hero-ctas', ''); [...wrap.children].forEach((a, i) => a.setAttribute('data-hero-cta', i ? 'secondary' : 'primary')); }
    if (a0) { const kids = [...a0.parentElement.children]; Object.assign(kids[0].style, { background: '#e8e6dc', color: '#383f38', border: '1px solid #e8e6dc' }); if (kids[1]) Object.assign(kids[1].style, { background: 'transparent', color: '#f4f3ec', border: '1px solid #f4f3ec' }); }
    const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.includes('Find Your Society')) walker.currentNode.textContent = walker.currentNode.textContent.replace('Find Your Society', 'Find your society');
  }

  const ev = [...document.querySelectorAll('main section')].find((s) => s.querySelector('.eyebrow') && /What.s on/.test(s.querySelector('.eyebrow').textContent));
  if (ev) { ev.setAttribute('data-home-section', 'events'); ev.querySelector('h2').textContent = 'What’s on'; const eb = ev.querySelector('.eyebrow'); (eb.parentElement.tagName === 'DIV' ? eb.parentElement : eb).remove(); }

  const yb = document.querySelector('[data-yearbook-content] p'); if (yb) yb.setAttribute('data-yearbook-copy', '');

  document.querySelectorAll('main p, main li, main dd').forEach((el) => {
    if (el.closest('[data-page-hero]') || el.closest('section[aria-roledescription=carousel]')) return;
    const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    const cs = getComputedStyle(el); if (words < 7 || cs.fontFamily.toLowerCase().includes('mono') || el.querySelector('p, li')) return;
    const fs = parseFloat(cs.fontSize);
    if (fs >= 13 && fs <= 18) { el.style.fontSize = '16px'; el.style.lineHeight = '1.55'; }
  });
  document.querySelectorAll('main section.relative.isolate').forEach((s) => s.setAttribute('data-page-hero', ''));
})();
