# p3-pre-existing-next-image-warning-on-co

**[P3] Pre-existing `next/image` warning on `components/chrome/Header.tsx`**
  (`/images/saoc-logo-ink-paper.png` has width-or-height modified but not both — Tailwind
  preflight's global `img{height:auto}` fighting next/image's explicit props). Confirmed
  unchanged since the component's scaffold commit, unrelated to F8, fires site-wide.
