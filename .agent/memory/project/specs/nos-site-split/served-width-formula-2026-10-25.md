# Corrected served-width formula (NOS Design ruling, 2026-10-25, verbatim substance)

For every <img> rendered with object-fit: cover:
  rendered_css_w = max(boxW, boxH × srcW / srcH)
  required_px    = rendered_css_w × DPR
  PASS iff served width ≥ required_px

- srcW/srcH = aspect of the SERVED file/cut (not the original) if a cut is derived.
- served = naturalWidth of currentSrc loaded into a bare `new Image()` (img.naturalWidth on srcset is density-corrected — don't use it).
- Viewports: 2056@2, 1440@2, 1280@2, 1023@2, 768@2, 390@3 (1023/768 = tall boxes go height-driven).
- object-fit: contain / no cover: required = boxW × DPR (unchanged).
- A box wider than the source aspect reduces to the old formula; nothing correctly passed before flips.
Applies to: SAOC audit hero-width gate, NOS #76, H-a, HM-1 mirror.
