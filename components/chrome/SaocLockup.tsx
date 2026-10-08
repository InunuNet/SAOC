import Image from 'next/image';
import Link from 'next/link';
import { Lora } from 'next/font/google';

// =============================================================
// SAOC — components/chrome/SaocLockup.tsx
//
// Live HTML/CSS reproduction of Brad's Claude Design artifact lockup
// ("SAOC - Lockup explorer", scripts/lockup-export-harness/app.js), replacing
// the earlier whole-lockup raster PNG export (crisp text at any DPI/zoom
// instead of a soft raster, and no re-export step when copy changes). Only
// the emblem is an image — the wordmark, rule and tagline are real text,
// sized and coloured to the artifact's own numbers.
//
// Every size below is drawn directly from the artifact's metrics()/colours()
// (app.js:89-101) at its DEFAULT state — es:140, ns:110, tsz:140, rs:100,
// WM:0 'SA Orchid Council', N:7 Lora/500, F:0 JetBrains Mono/500, T:0
// tagline on, P:2 'Lapis & Sun', rule:true — never re-derived by hand. The
// *_UNITS objects are that formula's raw output; each is then multiplied by
// a render-scale factor per breakpoint (SCALE below) and rounded to the
// literal px values used in the JSX className strings — Tailwind's
// arbitrary-value classes must appear as complete literal tokens for its
// build-time scanner to pick them up, so the px numbers are computed once,
// by hand, from UNITS × SCALE (shown in each comment) rather than
// interpolated at runtime.
//
// Emblem assets: the E1 (full colour) and E4 ("Lapis monotone") treatments,
// already trimmed to the source's own opaque bounding box and recoloured
// exactly per app.js's variant() duotone formula (LAPIS_LO '#1f3a93' →
// LAPIS_HI '#eef1fa') by scripts/generate-saoc-emblem-web-assets.py (mission
// round 1) — public/images/saoc-emblem-lockup-2x.png (E1) and
// saoc-emblem-footer-lapis-2x.png (E4). Both are 640×618 (aspect 1.0356:1).
// =============================================================

const lora = Lora({ subsets: ['latin'], weight: '500', style: 'normal', display: 'swap' });

// colours(dark, ground) at palette P2 index (id P3, "Lapis & Sun"): light
// ground → name/tag/rule; dark ground → onDark/onDarkMuted/translucent-white
// rule. app.js:98-102.
const TONE_COLOURS = {
  light: { name: '#172a5c', tag: '#5a5f70', rule: '#c9a200' },
  dark: { name: '#fbf8ea', tag: '#f0d35a', rule: 'rgba(255,255,255,0.35)' },
} as const;

const WORDMARK = 'SA Orchid Council';
const TAGLINE = 'Making a difference since 1968';
const ACCESSIBLE_LABEL = `South African Orchid Council — ${TAGLINE}`;

const LINK_CLASSES =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2';

interface SaocLockupProps {
  orientation: 'horizontal' | 'vertical';
  tone: 'light' | 'dark';
  /** Forces the compact (mobile) horizontal scale regardless of viewport —
   * used by MobileMenu.tsx, whose drawer stays ≤360px wide no matter the
   * actual window width, so it can never key off a `sm:` media query.
   * Ignored for orientation="vertical" (that tier is already fixed). */
  compact?: boolean;
  className?: string;
  priority?: boolean;
}

export function SaocLockup({ orientation, tone, compact = false, className, priority }: SaocLockupProps) {
  const col = TONE_COLOURS[tone];
  const emblemSrc = tone === 'dark' ? '/images/saoc-emblem-footer-lapis-2x.png' : '/images/saoc-emblem-lockup-2x.png';

  if (orientation === 'horizontal') {
    // metrics().h at the default state, app.js:92 — embBoxH = 88*1.4 = 123.2;
    // gap = 22; name = 46*1.1 = 50.6; tag = 11.5*(1*1.4) = 16.1; tagGap =
    // 9*max(1.1,1.4) = 12.6; ruleH = (46*1.1*1.02 + (9*1.4 + 11.5*1.4*1.3))*1
    // = 85.142 (tagline present).
    //
    // Desktop tier, s=0.70 (Brad's own number): embBoxH 86, emblem width
    // 86×1.0356 ≈ 89, gap 15, name 35, tag 11, tagGap 9, ruleH 60. Shown at
    // the `md` (768px) breakpoint and above — verified directly (Playwright)
    // across 640-1239px: at exactly 640px the hamburger was pushed 16px past
    // the viewport edge (the Contact button reappears at `sm`, leaving too
    // little room for the full four-element lockup at that width), clean
    // from 768px up (hamburgerRight=736 at a 768px viewport, 32px margin) —
    // so the switch point moved from `sm` to `md` rather than shrinking the
    // desktop tier further.
    //
    // Narrow tier — emblem + wordmark ONLY, no rule, no tagline. Below 768px
    // the header's logo slot shares a 320px row with the search and
    // hamburger buttons; measured directly (Playwright, 320px viewport):
    // header content width 256px (320 - px-8×2) minus actions-zone ≈84px
    // (search 34px + hamburger 38px + their gap) minus the header's own
    // gap-6 (24px minimum between flex children) leaves ≈148px for the
    // whole logo. A first pass at embBoxH 44/name 22px measured 243px total
    // (63px of real overflow, hamburger pushed off-screen) — neither the
    // rule nor the tagline fit at any legible size, so both are dropped;
    // emblem height 27 (width 27×1.0356 ≈ 28), gap 6, name 13px measured
    // ≈145px, verified to clear the hamburger with no document overflow.
    // Forced unconditionally when `compact` is set (MobileMenu.tsx), since
    // that drawer stays narrow regardless of the actual viewport width.
    return (
      <Link href="/" aria-label={ACCESSIBLE_LABEL} className={[LINK_CLASSES, 'flex items-center', className ?? ''].join(' ')}>
        {/* Narrow — emblem + wordmark only. */}
        <span aria-hidden="true" className={['flex items-center gap-[6px]', compact ? 'flex' : 'flex md:hidden'].join(' ')}>
          <span className="relative shrink-0 w-[28px] h-[27px]">
            <Image src={emblemSrc} alt="" fill sizes="28px" className="object-contain" priority={priority} />
          </span>
          <span
            className={[lora.className, 'text-[13px] leading-[1.02] whitespace-nowrap'].join(' ')}
            style={{ letterSpacing: '-0.005em', color: col.name }}
          >
            {WORDMARK}
          </span>
        </span>

        {/* Desktop (≥768px) — full emblem + rule + wordmark + tagline. */}
        {!compact && (
          <span aria-hidden="true" className="hidden md:flex items-center gap-[15px]">
            <span className="relative shrink-0 w-[89px] h-[86px]">
              <Image src={emblemSrc} alt="" fill sizes="89px" className="object-contain" priority={priority} />
            </span>
            <span className="w-px shrink-0 h-[60px]" style={{ background: col.rule }} />
            <span className="flex flex-col gap-[9px]">
              <span
                className={[lora.className, 'text-[35px] leading-[1.02] whitespace-nowrap'].join(' ')}
                style={{ letterSpacing: '-0.005em', color: col.name }}
              >
                {WORDMARK}
              </span>
              <span
                className="font-mono font-medium uppercase text-[11px] leading-[1.3] whitespace-nowrap"
                style={{ letterSpacing: '0.22em', color: col.tag }}
              >
                {TAGLINE}
              </span>
            </span>
          </span>
        )}
      </Link>
    );
  }

  // Vertical (footer) — single fixed scale (no responsive tiers: the
  // footer's own grid controls column width at every breakpoint), centred,
  // with no background box — it sits directly on the footer's own
  // background colour per Brad's instruction.
  //
  // Wordmark/rule/tagline sizes are metrics().v at the default state,
  // app.js:92, scaled at s=0.55 (unchanged from round 1): name = 50*1.1*0.55
  // ≈ 30, ruleW ≈ 133, tagGap ≈ 9, tag ≈ 9.
  //
  // Emblem is NOT sized off embBoxH (130*1.4=182 — that figure describes the
  // UNTRIMMED 1254² export canvas; applying it to the already-trimmed asset
  // shrinks the artwork a second time, which is what made round-2's emblem
  // read as too small against the reference). Sized by WIDTH instead,
  // directly against the rendered wordmark: target ratio 0.65 (Brad's
  // measurement off his reference, brad-footer-reference.png) × the
  // Playwright-measured rendered wordmark width at text-[30px] Lora
  // (255.39px) ≈ 166px; height derived from the asset's own 640×618
  // (1.0356:1) aspect ≈ 160px. Verified on the rendered page (Playwright):
  // emblemWidth 166 / wordmarkWidth 255.39 = 0.65.
  return (
    <Link
      href="/"
      aria-label={ACCESSIBLE_LABEL}
      className={[LINK_CLASSES, 'flex flex-col items-center', className ?? ''].join(' ')}
    >
      <span aria-hidden="true" className="flex flex-col items-center">
        <span className="relative shrink-0 w-[166px] h-[160px]">
          <Image src={emblemSrc} alt="" fill sizes="166px" className="object-contain" priority={priority} />
        </span>
        <span
          className={[lora.className, 'mt-[12px] text-[30px] leading-[1.02] whitespace-nowrap'].join(' ')}
          style={{ letterSpacing: '-0.005em', color: col.name }}
        >
          {WORDMARK}
        </span>
        <span className="mt-[8px] h-px w-[133px]" style={{ background: col.rule }} />
        <span
          className="mt-[9px] font-mono font-medium uppercase text-[9px] leading-[1.3] whitespace-nowrap"
          style={{ letterSpacing: '0.22em', color: col.tag }}
        >
          {TAGLINE}
        </span>
      </span>
    </Link>
  );
}
