// SAOC Logo — composed: ink-paper line-art orchid + "SA Orchid Council" wordmark + tagline.
// Uses assets/saoc-logo-ink-paper.png for the botanical mark.
//
// variants:
//   horizontal (default) — mark + 2-line wordmark, for header
//   stacked              — mark above centered wordmark, for footer / hero
//   mark                 — mark only (favicon, compact)
//
// variant colors:
//   default: ink mark on parchment
//   onSage=true: paper-flat silhouette on dark sage (utility bar, dark hero)

const LOGO_INK_PAPER = 'assets/saoc-logo-ink-paper.png';
const LOGO_FLAT_PAPER = 'assets/saoc-logo-flat-paper.png';
const LOGO_FLAT_SAGE = 'assets/saoc-logo-flat-sage.png';

function SAOCMark({ size = 44, tone = 'ink' }) {
  // tone: 'ink' (default line-art), 'paper' (pale silhouette on dark), 'sage' (dark silhouette on light)
  const src =
    tone === 'paper' ? LOGO_FLAT_PAPER : tone === 'sage' ? LOGO_FLAT_SAGE : LOGO_INK_PAPER;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}

function SAOCLogo({
  variant = 'horizontal',
  size = 44,
  tone = 'ink', // 'ink' (line-art on light) | 'paper' (silhouette on dark) | 'sage' (silhouette on light)
  wordmarkColor, // override text color
  taglineColor, // override tagline color
}) {
  const textColor = wordmarkColor || (tone === 'paper' ? 'var(--ivory)' : 'var(--ink)');
  const subColor = taglineColor || (tone === 'paper' ? 'rgba(244,243,236,0.65)' : 'var(--muted)');

  if (variant === 'mark') {
    return <SAOCMark size={size} tone={tone} />;
  }

  if (variant === 'stacked') {
    return (
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          color: textColor,
        }}
      >
        <SAOCMark size={size} tone={tone} />
        <div style={{ textAlign: 'center', lineHeight: 1.05 }}>
          <div
            style={{
              fontFamily: 'var(--serif)',
              fontSize: Math.max(18, size * 0.42),
              fontWeight: 600,
              letterSpacing: '0.005em',
              lineHeight: 1.05,
            }}
          >
            SA Orchid Council
          </div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: Math.max(10, size * 0.17),
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              marginTop: 8,
              color: subColor,
            }}
          >
            Making a difference since 1968
          </div>
        </div>
      </div>
    );
  }

  // horizontal — mark + 2-line wordmark
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: textColor }}>
      <SAOCMark size={size} tone={tone} />
      <div style={{ lineHeight: 1.02 }}>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontSize: Math.max(19, size * 0.48),
            fontWeight: 600,
            letterSpacing: '0.002em',
            lineHeight: 1.02,
          }}
        >
          SA Orchid Council
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: Math.max(9.5, size * 0.195),
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            marginTop: 5,
            color: subColor,
          }}
        >
          Making a difference since 1968
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SAOCLogo, SAOCMark });
