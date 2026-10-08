
const SRC = (window.__resources && window.__resources.emblem) || 'assets/logo/saoc-emblem-colour.png';
const LAPIS = '#1f3a93', LAPIS_LT = '#9db1ec';
const PALETTES = [
  { id:'P1', label:'Sage & Paper', light:'#f4f3ec', tint:'#e8e6dc', dark:'#384138', name:'#171917', muted:'#636660', accent:'#9e8c6b', onDark:'#f4f3ec', onDarkMuted:'#c2b393' },
  { id:'P2', label:'Lapis & Pyrite', light:'#f5f4ee', tint:'#e4e6ec', dark:'#1f2f66', name:'#1f2f66', muted:'#5b6075', accent:'#b8962e', onDark:'#f5f4ee', onDarkMuted:'#d8c27a' },
  { id:'P3', label:'Lapis & Sun', light:'#fbf8ea', tint:'#f3ebc4', dark:'#172a5c', name:'#172a5c', muted:'#5a5f70', accent:'#c9a200', onDark:'#fbf8ea', onDarkMuted:'#f0d35a' },
  { id:'P4', label:'Leaf & Linen', light:'#f3f1e6', tint:'#e2e5d0', dark:'#2e3c22', name:'#2e3c22', muted:'#5f6553', accent:'#8a9a3a', onDark:'#f3f1e6', onDarkMuted:'#c3cc8a' },
  { id:'P5', label:'Ink & Bone', light:'#f6f5f1', tint:'#e7e5df', dark:'#1b1b1a', name:'#1b1b1a', muted:'#66655f', accent:'#8c8a84', onDark:'#f6f5f1', onDarkMuted:'#b3b1aa' },
];
const W = (a, b) => { const r = []; for (let w = a; w <= b; w += 100) r.push(w); return r; };
const NAME_FONTS = [
  { id:'N1', label:'Crimson Pro', css:"'Crimson Pro', serif", weights:W(300,700), def:600, track:0.002 },
  { id:'N2', label:'EB Garamond', css:"'EB Garamond', serif", weights:W(400,700), def:500, track:0 },
  { id:'N3', label:'Libre Caslon', css:"'Libre Caslon Text', serif", weights:[400,700], def:400, track:-0.01 },
  { id:'N4', label:'Newsreader', css:"'Newsreader', serif", weights:W(300,700), def:500, track:-0.005 },
  { id:'N5', label:'Source Serif', css:"'Source Serif 4', serif", weights:W(300,700), def:500, track:-0.01 },
  { id:'N6', label:'Spectral', css:"'Spectral', serif", weights:W(300,700), def:500, track:-0.005 },
  { id:'N8', label:'Libre Baskerville', css:"'Libre Baskerville', serif", weights:[400,700], def:400, track:-0.015 },
  { id:'N9', label:'Lora', css:"'Lora', serif", weights:W(400,700), def:500, track:-0.005 },
  { id:'N10', label:'Gelasio', css:"'Gelasio', serif", weights:W(400,700), def:500, track:-0.005 },
  { id:'N11', label:'Cormorant Garamond', css:"'Cormorant Garamond', serif", weights:W(300,700), def:400, track:0.02 },
];
const TAG_FONTS = [
  { id:'F1', label:'JetBrains Mono', css:"'JetBrains Mono', monospace", weights:W(300,600), def:500, track:0.22, upper:true },
  { id:'F2', label:'IBM Plex Mono', css:"'IBM Plex Mono', monospace", weights:W(300,600), def:400, track:0.2, upper:true },
  { id:'F3', label:'DM Mono', css:"'DM Mono', monospace", weights:W(300,500), def:400, track:0.2, upper:true },
  { id:'F4', label:'Red Hat Mono', css:"'Red Hat Mono', monospace", weights:W(300,600), def:400, track:0.2, upper:true },
  { id:'F5', label:'Courier Prime', css:"'Courier Prime', monospace", weights:[400,700], def:400, track:0.18, upper:true },
  { id:'F6', label:'Manrope caps', css:"'Manrope', sans-serif", weights:W(300,700), def:500, track:0.24, upper:true },
  { id:'F8', label:'Space Grotesk caps', css:"'Space Grotesk', sans-serif", weights:W(300,600), def:500, track:0.22, upper:true },
  { id:'F11', label:'Jost caps', css:"'Jost', sans-serif", weights:W(300,600), def:400, track:0.3, upper:true },
];
const WORDMARKS = [
  { id:'W1', label:'SA Orchid Council', a:'SA Orchid Council' },
  { id:'W2', label:'South African Orchid Council', a:'South African Orchid Council' },
  { id:'W3', label:'Suid-Afrikaanse Orgideeraad', a:'Suid-Afrikaanse Orgideeraad' },
];
const TAGS = [ { id:'T1', label:'Making a difference since 1968' }, { id:'T5', label:'No tagline' }, { id:'T6', label:'Custom' } ];
const TREAT = [ { id:'E1', label:'Full colour' }, { id:'E2', label:'Greyscale' }, { id:'E3', label:'Monotone ink' }, { id:'E4', label:'Lapis monotone' } ];
const GROUNDS = [ { id:'light', label:'Light' }, { id:'tint', label:'Tint' }, { id:'dark', label:'Dark' } ];
const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i + 2), 16));
const ON = { bg:'#384138', fg:'#f4f3ec', bd:'#384138' }, OFF = { bg:'#ffffff', fg:'#171917', bd:'#d9d7c9' };

class Component extends DCLogic {
  state = { WM:0, P:2, N:7, nw:500, F:0, fw:500, T:0, custom:'', rule:true, rs:100, es:140, ns:110, tsz:140, G:'light', E:0, transparent:true, ready:false };
  cache = {}; rootRef = React.createRef();

  componentDidMount() {
    const im = new Image(); im.onload = () => { this.img = im; this.setState({ ready:true }); }; im.src = SRC;
    this.ro = new ResizeObserver(this.fit); if (this.rootRef.current) this.ro.observe(this.rootRef.current);
    document.fonts && document.fonts.ready.then(this.fit);
    window.addEventListener('resize', this.fit); this.fit(); setTimeout(this.fit, 500);
  }
  componentDidUpdate() { this.fit(); requestAnimationFrame(this.fit); }
  componentWillUnmount() { this.ro && this.ro.disconnect(); window.removeEventListener('resize', this.fit); }
  fit = () => {
    const r = this.rootRef.current; if (!r) return;
    r.querySelectorAll('img[data-src]').forEach(im => { const u = im.getAttribute('data-src'); if (u && im.getAttribute('src') !== u) im.setAttribute('src', u); });
    r.querySelectorAll('[data-fit]').forEach(el => {
      el.style.zoom = 1;
      const w = el.parentElement.clientWidth - (parseFloat(el.getAttribute('data-fit')) || 0), lw = el.offsetWidth;
      const k = lw > 0 && w > 0 ? Math.min(1, w / lw) : 1;
      el.style.zoom = k.toFixed(3);
    });
  };

  variant(e, dark) {
    if (e === 0 || !this.img) return { url:SRC, cv:this.img };
    const p = PALETTES[this.state.P], key = [e, p.id, dark].join('|');
    if (this.cache[key]) return this.cache[key];
    const im = this.img, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
    // Positive duotone: shadows → ink, highlights → paper. Alpha untouched so the bloom stays solid.
    const lo = e === 1 ? rgb('#1e1e1e') : e === 2 ? rgb(p.name) : rgb(LAPIS);
    const hi = e === 1 ? rgb('#ffffff') : e === 2 ? rgb(p.light) : rgb('#eef1fa');
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      let l = (0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]) / 255;
      l = Math.min(1, Math.max(0, 1.35 * l - 0.2));
      a[i] = lo[0] + (hi[0] - lo[0]) * l; a[i + 1] = lo[1] + (hi[1] - lo[1]) * l; a[i + 2] = lo[2] + (hi[2] - lo[2]) * l;
    }
    x.putImageData(d, 0, 0);
    return (this.cache[key] = { url:c.toDataURL('image/png'), cv:c });
  }

  tagText() { const s = this.state; return s.T === 0 ? TAGS[0].label : s.T === 2 ? s.custom.trim() : ''; }
  metrics() {
    const s = this.state, es = s.es / 100, ns = s.ns / 100, tz = s.tsz / 100, ts = (TAG_FONTS[s.F].scale || 1) * tz;
    const wm2 = WORDMARKS[s.WM].b, n2 = wm2 ? 46 * ns * 0.62 * 1.02 + 4 : 0;
    return { h:{ emb:88 * es, gap:22, name:46 * ns, name2:46 * ns * 0.62, tag:11.5 * ts, tagGap:9 * Math.max(ns, tz), ruleH:(46 * ns * 1.02 + n2 + (this.tagText() ? 9 * Math.max(ns, tz) + 11.5 * ts * 1.3 : 0)) * s.rs / 100 }, v:{ emb:130 * es, gap:22, name:50 * ns, name2:50 * ns * 0.62, tag:12 * ts, tagGap:12 * Math.max(ns, tz), ruleW:220 * ns * s.rs / 100 } };
  }
  code() {
    const s = this.state;
    return [WORDMARKS[s.WM].id, PALETTES[s.P].id, NAME_FONTS[s.N].id + '/' + s.nw, TAG_FONTS[s.F].id + '/' + s.fw, TAGS[s.T].id, TREAT[s.E].id, 'Rule ' + (s.rule ? 'on ' + s.rs + '%' : 'off'), 'Emblem ' + s.es + '%', 'Wordmark ' + s.ns + '%', 'Tag ' + s.tsz + '%'].join(' · ');
  }
  colours(dark, ground) {
    const p = PALETTES[this.state.P];
    return dark ? { bg:p.dark, name:p.onDark, tag:p.onDarkMuted, rule:'rgba(255,255,255,0.35)' }
                : { bg:ground === 'tint' ? p.tint : p.light, name:p.name, tag:p.muted, rule:p.accent };
  }
  download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
  fileBase() { return 'SAOC-lockup-' + this.code().replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, ''); }

  async exportPng(kind) {
    const s = this.state, nf = NAME_FONTS[s.N], tf = TAG_FONTS[s.F], dark = s.G === 'dark', col = this.colours(dark, s.G);
    const tStyle = tf.italic ? 'italic' : 'normal';
    await Promise.all([document.fonts.load(`${s.nw} 40px ${nf.css}`), document.fonts.load(`${tStyle} ${s.fw} 40px ${tf.css}`)]);
    const v = this.variant(s.E, dark); if (!v.cv) return;
    const k = 4, M = this.metrics()[kind], tag = this.tagText(), tagT = tf.upper ? tag.toUpperCase() : tag;
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const nSize = M.name * k, tSize = M.tag * k;
    const nFont = `${s.nw} ${nSize}px ${nf.css}`, tFont = `${tStyle} ${s.fw} ${tSize}px ${tf.css}`;
    const nLs = nf.track * nSize, tLs = tf.track * tSize;
    const meas = (f, ls, t) => { x.font = f; x.letterSpacing = ls + 'px'; return x.measureText(t).width; };
    const WM = WORDMARKS[s.WM], wm1 = WM.a, wm2 = WM.b || '';
    const n2Size = M.name2 * k, n2Font = `${s.nw} ${n2Size}px ${nf.css}`, n2Ls = nf.track * n2Size, n2H = wm2 ? n2Size * 1.02 + 4 * k : 0;
    const nW = meas(nFont, nLs, wm1), n2W = wm2 ? meas(n2Font, n2Ls, wm2) : 0, tW = tag ? meas(tFont, tLs, tagT) : 0;
    const embH = M.emb * k, embW = embH * v.cv.width / v.cv.height, gap = M.gap * k;
    const nLH = nSize * 1.02, tLH = tSize * 1.3, tGap = M.tagGap * k;
    let W, H, draw;
    if (kind === 'h') {
      const textW = Math.max(nW, n2W, tW), textH = nLH + n2H + (tag ? tGap + tLH : 0), ruleW = s.rule ? gap + k : 0;
      const cw = embW + gap + ruleW + textW, ch = Math.max(embH, textH), pad = embH * 0.3;
      W = cw + pad * 2; H = ch + pad * 2;
      draw = () => {
        x.drawImage(v.cv, pad, pad + (ch - embH) / 2, embW, embH);
        if (s.rule) { x.fillStyle = col.rule; const rh = M.ruleH * k; x.fillRect(pad + embW + gap, pad + (ch - rh) / 2, k, rh); }
        const tx = pad + embW + gap + ruleW, ty = pad + (ch - textH) / 2;
        x.textBaseline = 'middle'; x.textAlign = 'left';
        x.font = nFont; x.letterSpacing = nLs + 'px'; x.fillStyle = col.name; x.fillText(wm1, tx, ty + nLH / 2);
        if (wm2) { x.font = n2Font; x.letterSpacing = n2Ls + 'px'; x.fillText(wm2, tx, ty + nLH + 4 * k + n2Size * 0.51); }
        if (tag) { x.font = tFont; x.letterSpacing = tLs + 'px'; x.fillStyle = col.tag; x.fillText(tagT, tx, ty + nLH + n2H + tGap + tLH / 2); }
      };
    } else {
      const rW = s.rule ? M.ruleW * k : 0, rH = s.rule ? 14 * k + k : 0;
      const cw = Math.max(embW, nW, n2W, tW, rW), ch = embH + gap + nLH + n2H + rH + (tag ? tGap + tLH : 0), pad = embH * 0.25;
      W = cw + pad * 2; H = ch + pad * 2;
      draw = () => {
        const cx = W / 2; let y = pad;
        x.drawImage(v.cv, cx - embW / 2, y, embW, embH); y += embH + gap;
        x.textBaseline = 'middle'; x.textAlign = 'center';
        x.font = nFont; x.letterSpacing = nLs + 'px'; x.fillStyle = col.name; x.fillText(wm1, cx + nLs / 2, y + nLH / 2); y += nLH;
        if (wm2) { x.font = n2Font; x.letterSpacing = n2Ls + 'px'; x.fillText(wm2, cx + n2Ls / 2, y + 4 * k + n2Size * 0.51); y += n2H; }
        if (s.rule) { x.fillStyle = col.rule; x.fillRect(cx - rW / 2, y + 14 * k, rW, k); y += rH; }
        if (tag) { x.font = tFont; x.letterSpacing = tLs + 'px'; x.fillStyle = col.tag; x.fillText(tagT, cx + tLs / 2, y + tGap + tLH / 2); }
      };
    }
    c.width = Math.ceil(W); c.height = Math.ceil(H);
    if (!s.transparent) { x.fillStyle = col.bg; x.fillRect(0, 0, c.width, c.height); }
    draw();
    c.toBlob(b => this.download(b, `${this.fileBase()}-${kind === 'h' ? 'horizontal' : 'vertical'}.png`), 'image/png');
  }
  exportSpec() {
    const s = this.state, p = PALETTES[s.P], nf = NAME_FONTS[s.N], tf = TAG_FONTS[s.F];
    const spec = {
      code: this.code(), wordmark: { id:WORDMARKS[s.WM].id, primary:WORDMARKS[s.WM].a, secondary:WORDMARKS[s.WM].b || null }, tagline: this.tagText() || null,
      palette: { id:p.id, label:p.label, light:p.light, tint:p.tint, dark:p.dark, ink:p.name, muted:p.muted, accent:p.accent, onDark:p.onDark, onDarkMuted:p.onDarkMuted },
      nameType: { id:nf.id, family:nf.label, weight:s.nw, trackingEm:nf.track },
      taglineType: { id:tf.id, family:tf.label, weight:s.fw, trackingEm:tf.track, uppercase:!!tf.upper, italic:!!tf.italic },
      emblem: { treatment:TREAT[s.E].id + ' ' + TREAT[s.E].label, scalePercent:s.es, lapis:LAPIS }, wordmarkScalePercent:s.ns, taglineScalePercent:s.tsz, ruleScalePercent:s.rule ? s.rs : null,
      rule: s.rule, ground: s.G, metrics: this.metrics(), exported: new Date().toISOString(),
    };
    this.download(new Blob([JSON.stringify(spec, null, 2)], { type:'application/json' }), this.fileBase() + '-spec.json');
  }

  btn(on) { return on ? ON : OFF; }
  renderVals() {
    const clamp = { WM:WORDMARKS, P:PALETTES, N:NAME_FONTS, F:TAG_FONTS, T:TAGS, E:TREAT };
    for (const k in clamp) if (!clamp[k][this.state[k]]) this.state[k] = 0;
    const s = this.state, p = PALETTES[s.P], nf = NAME_FONTS[s.N], tf = TAG_FONTS[s.F], dark = s.G === 'dark';
    const tagline = this.tagText(), col = this.colours(dark, s.G);
    const opt = (key, list, i, extra = {}) => ({ id:list[i].id, label:list[i].label, swatches:extra.sw || [], font:extra.font || "'Manrope', sans-serif", ...this.btn(i === s[key]),
      swBd: i === s[key] ? 'rgba(244,243,236,0.7)' : 'rgba(0,0,0,0.12)', pick:extra.pick || (() => this.setState({ [key]:i })) });
    const weights = (list, wk) => list.map(w => ({ label:String(w), ...this.btn(w === s[wk]), pick:() => this.setState({ [wk]:w }) }));
    const WMs = WORDMARKS[s.WM];
    const groups = [
      { label:'Wordmark', code:WMs.id, options:WORDMARKS.map((o, i) => opt('WM', WORDMARKS, i)) },
      { label:'Palette', code:p.id, options:PALETTES.map((o, i) => opt('P', PALETTES, i, { sw:[o.light, o.dark, o.accent] })) },
      { label:'Wordmark typeface', code:nf.id + ' / ' + s.nw, hasSlider:true, slider:{ value:s.ns, min:60, max:160, onChange:e => this.setState({ ns:+e.target.value }) }, hasWeights:true, weights:weights(nf.weights, 'nw'),
        options:NAME_FONTS.map((o, i) => opt('N', NAME_FONTS, i, { font:o.css, pick:() => this.setState({ N:i, nw:o.weights.includes(s.nw) ? s.nw : o.def }) })) },
      { label:'Tagline typeface', code:tf.id, hasSlider:true, slider:{ value:s.tsz, min:60, max:200, onChange:e => this.setState({ tsz:+e.target.value }) },
        options:TAG_FONTS.map((o, i) => opt('F', TAG_FONTS, i, { font:o.css, pick:() => this.setState({ F:i, fw:o.def }) })) },
      { label:'Tagline', code:TAGS[s.T].id, showInput:s.T === 2, options:TAGS.map((o, i) => opt('T', TAGS, i)) },
      { label:'Emblem', code:s.es + '%', options:[], hasSlider:true, slider:{ value:s.es, min:60, max:200, onChange:e => this.setState({ es:+e.target.value }) } },
      { label:'Divider rule', code:s.rule ? s.rs + '%' : 'Off', options:[], hasToggle:true, hasSlider:s.rule, slider:{ value:s.rs, min:40, max:160, onChange:e => this.setState({ rs:+e.target.value }) } },
    ];
    const lightCol = this.colours(false, 'light'), darkCol = this.colours(true);
    return {
      rootRef:this.rootRef, groups, custom:s.custom, es:s.es, rule:s.rule, transparent:s.transparent,
      onCustom:e => this.setState({ custom:e.target.value }),
      toggleRule:() => this.setState({ rule:!s.rule }), ruleBtn:{ label:s.rule ? 'On' : 'Off', bg:s.rule ? '#384138' : '#ffffff', fg:s.rule ? '#f4f3ec' : '#384138' },
      toggleTransparent:() => this.setState({ transparent:!s.transparent }),
      exportH:() => this.exportPng('h'), exportV:() => this.exportPng('v'), exportSpec:() => this.exportSpec(),
      wm:WMs.a, wm2:WMs.b || '', hasWm2:!!WMs.b,
      code:this.code(), pal:p, nf, nw:s.nw, fw:s.fw,
      tf:{ css:tf.css, track:tf.track, style:tf.italic ? 'italic' : 'normal', case:tf.upper ? 'uppercase' : 'none' },
      tagline, hasTag:!!tagline, m:this.metrics(),
      treatBtns:TREAT.map((t, i) => ({ id:t.id, label:t.label, ...this.btn(i === s.E), pick:() => this.setState({ E:i }) })),
      grounds:GROUNDS.map(g => ({ label:g.label, ...this.btn(g.id === s.G), pick:() => this.setState({ G:g.id }) })),
      stage:{ ...col, src:this.variant(s.E, dark).url, divider:dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' },
      treatments:TREAT.map((t, i) => ({ id:t.id, label:t.label, status:i === s.E ? 'On stage' : 'Show on stage', bd:i === s.E ? '#384138' : '#d9d7c9',
        pick:() => this.setState({ E:i }),
        panels:[ { ...lightCol, src:this.variant(i, false).url }, { ...darkCol, src:this.variant(i, true).url } ] })),
      use:{ name2:22 * 0.62, ruleH:(22 * 1.02 + (tagline ? 5 + 9.5 * (tf.scale || 1) * 1.3 : 0)) * s.rs / 100, light:this.variant(s.E, false).url, dark:this.variant(s.E, true).url, tag:9.5 * (tf.scale || 1) },
    };
  }
}
