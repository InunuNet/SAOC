# header-lockup-webp-24kb-heavier-than-the

**Header lockup webp (24KB) heavier than the hero (19KB)** (2026-10-28, from F1e) — candidate for resizing to served px. — 2026-11-07 assessed: already served through next/image with sizes="(min-width: 780px) 405px, …" (components/chrome/Header.tsx:106-113), so the optimiser already resizes to served px; the 24KB is the 2x variant of a fine-text logo. Further cuts mean lower quality or a re-export, a visual call; left for NOS Design if wanted.
